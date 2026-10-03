import {
  BLOCK_META,
  Block,
  Dimension,
  GameMode,
  Item,
  MINE_TIME_MS,
  REACH,
  TILE,
  WORLD_H,
  WORLD_W,
  isBlock,
} from "./constants.js";
import { Input } from "./input.js";
import { Inventory } from "./inventory.js";
import { Player } from "./player.js";
import { Renderer } from "./render.js";
import { Equipment } from "./equipment.js";
import { buildSave, hydrateFromSave, loadSave, writeSave } from "./storage.js";
import { World, pickTileFromWorld } from "./world.js";
import { surfaceHeight } from "./noise.js";
import { activatePortal, findPortalInner, playerInPortal } from "./portal.js";
import { bindModals, refreshHotbarEl } from "./ui.js";

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas, ui.joystick, ui.jumpBtn);
    this.equipment = new Equipment();
    this.toast = "";
    this.toastUntil = 0;
    this.mineTarget = null;
    this.mineProgress = 0;
    this.jumpLatch = false;
    this.gameMode = GameMode.SURVIVAL;
    this.dimension = Dimension.OVERWORLD;
    this.overworldSeed = 0;
    this.baselines = {};
    this.editsCache = { overworld: [], nether: [] };
    this.portalLinks = {};
    this.teleportCooldown = 0;
    this.running = false;
    this.useHeldLatch = false;

    this.bindUi();
    bindModals(this);
    this.loop = this.loop.bind(this);
    window.addEventListener("resize", () => this.renderer.resize());
    this.renderer.resize();
  }

  startFromMenu(mode, continueSave) {
    this.gameMode = mode;
    this.ui.app.hidden = false;
    document.getElementById("main-menu").hidden = true;

    if (continueSave) {
      const saved = loadSave();
      if (saved?.seed) {
        this.overworldSeed = saved.seed;
        this.player = new Player(TILE * 8, TILE * 40);
        hydrateFromSave(this, saved);
        this.showToast("已加载存档");
      } else {
        this.bootNewWorld((Date.now() >>> 0), true);
      }
    } else {
      this.bootNewWorld((Math.random() * 1e9) >>> 0, true);
    }

    if (!this.running) {
      this.running = true;
      requestAnimationFrame(this.loop);
      setInterval(() => this.autoSave(), 45000);
    }
    this.refreshHotbar();
  }

  bootNewWorld(seed, msg) {
    this.overworldSeed = seed;
    this.dimension = Dimension.OVERWORLD;
    this.baselines = {
      [Dimension.OVERWORLD]: World.baseline(seed, Dimension.OVERWORLD),
      [Dimension.NETHER]: World.baseline(seed, Dimension.NETHER),
    };
    this.editsCache = { overworld: [], nether: [] };
    this.world = new World(seed, Dimension.OVERWORLD);
    const spawnX = Math.floor(WORLD_W * 0.25);
    const surface = surfaceHeight(spawnX, seed);
    this.player = new Player(spawnX * TILE + TILE * 0.2, (surface - 3) * TILE);
    this.inventory = new Inventory();
    this.equipment = new Equipment();
    if (this.gameMode === GameMode.CREATIVE) {
      this.player.flying = true;
    }
    if (msg) this.showToast(`新地图 · ${this.gameMode === GameMode.CREATIVE ? "创造" : "生存"}`);
  }

  bindUi() {
    this.ui.btnSave?.addEventListener("click", () => this.save());
    this.ui.btnNew?.addEventListener("click", () => {
      if (confirm("生成新地图？可先保存。")) this.bootNewWorld((Math.random() * 1e9) >>> 0, true);
    });
    this.ui.btnMode?.addEventListener("click", () => this.cycleInteractMode());
    this.ui.hotbar?.addEventListener("click", (e) => {
      const slot = e.target.closest("[data-slot]");
      if (slot) this.inventory.select(Number(slot.dataset.slot));
      this.refreshHotbar();
    });
  }

  cycleInteractMode() {
    const order = ["mine", "place", "use"];
    const i = order.indexOf(this.input.mode);
    this.setInteractMode(order[(i + 1) % order.length]);
  }

  setInteractMode(mode) {
    this.input.setMode(mode);
    this.refreshHotbar();
  }

  nearCraftingTable() {
    if (this.gameMode === GameMode.CREATIVE) return true;
    const c = this.player.center();
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        const tx = Math.floor(c.x / TILE) + dx;
        const ty = Math.floor(c.y / TILE) + dy;
        if (this.world.getBlock(tx, ty) === Block.CRAFTING_TABLE) return true;
      }
    }
    return false;
  }

  showToast(msg) {
    this.toast = msg;
    this.toastUntil = performance.now() + 2400;
  }

  cacheEditsBeforeSwitch() {
    const baseline = this.baselines[this.dimension];
    this.editsCache[this.dimension] = this.world.collectEdits(baseline);
  }

  save() {
    this.cacheEditsBeforeSwitch();
    const ok = writeSave(buildSave(this));
    this.showToast(ok ? "已保存到本机" : "保存失败");
  }

  autoSave() {
    if (!this.running) return;
    this.cacheEditsBeforeSwitch();
    writeSave(buildSave(this));
  }

  pickTargetTile() {
    if (this.input.pointer.active) {
      const w = this.renderer.screenToWorld(this.input.pointer.viewX, this.input.pointer.viewY);
      return pickTileFromWorld(w.x, w.y, TILE);
    }
    const c = this.player.center();
    return pickTileFromWorld(c.x + this.player.facing * TILE * 1.5, c.y + TILE * 0.25, TILE);
  }

  inReach(tx, ty) {
    const c = this.player.center();
    const bx = tx * TILE + TILE * 0.5;
    const by = ty * TILE + TILE * 0.5;
    return Math.hypot(bx - c.x, by - c.y) <= REACH * TILE;
  }

  mineDuration(blockId) {
    const meta = BLOCK_META[blockId];
    let ms = MINE_TIME_MS * (meta?.hardness || 1);
    const hot = this.inventory.selectedStack();
    ms /= this.equipment.mineMultiplier(hot);
    if (this.gameMode === GameMode.CREATIVE) return 40;
    return ms;
  }

  updateMining(dt) {
    const active = this.input.mine && this.input.mode === "mine";
    if (!active) {
      this.mineTarget = null;
      this.mineProgress = 0;
      return null;
    }
    const { tx, ty } = this.pickTargetTile();
    const id = this.world.getBlock(tx, ty);
    const meta = BLOCK_META[id];
    if (!meta?.mineable || !this.inReach(tx, ty)) {
      this.mineTarget = null;
      this.mineProgress = 0;
      return null;
    }
    const key = `${tx},${ty}`;
    if (this.mineTarget !== key) {
      this.mineTarget = key;
      this.mineProgress = 0;
    }
    const need = this.mineDuration(id);
    this.mineProgress += dt / need;
    if (this.mineProgress >= 1) {
      const drop = meta.drop ?? id;
      if (this.gameMode !== GameMode.CREATIVE) this.inventory.add(drop, 1);
      this.world.setBlock(tx, ty, Block.AIR);
      this.mineProgress = 0;
      this.mineTarget = null;
      this.refreshHotbar();
    }
    return { tx, ty, progress: Math.min(1, this.mineProgress) };
  }

  tryPlace() {
    if (!this.input.place || this.input.mode !== "place") return null;
    const { tx, ty } = this.pickTargetTile();
    if (this.world.getBlock(tx, ty) !== Block.AIR) return null;
    if (!this.inReach(tx, ty)) return null;
    if (this.player.blocksPlacement(tx, ty)) return null;

    const stack = this.inventory.selectedStack();
    if (!isBlock(stack)) {
      this.showToast("当前选中不是方块");
      return null;
    }
    const creative = this.gameMode === GameMode.CREATIVE;
    if (!this.inventory.canPlace(stack, creative)) {
      this.showToast("背包数量不足");
      return null;
    }
    this.inventory.use(stack, creative);
    this.world.setBlock(tx, ty, stack);
    this.refreshHotbar();
    return { tx, ty };
  }

  tryUse() {
    if (this.input.mode !== "use") return;
    const { tx, ty } = this.pickTargetTile();
    if (!this.inReach(tx, ty)) return;
    const stack = this.inventory.selectedStack();
    const block = this.world.getBlock(tx, ty);

    if (stack === Item.FLINT_STEEL) {
      const inner = findPortalInner(this.world, tx, ty);
      if (!inner) {
        this.showToast("需要黑曜石框（内空至少 4×5）");
        return;
      }
      const center = activatePortal(this.world, inner);
      const key = `${this.dimension}:${inner.innerLeft},${inner.innerTop}`;
      this.portalLinks[key] = center;
      this.showToast("下界门已点燃！走进紫色传送门");
      return;
    }

    if (block === Block.CRAFTING_TABLE) {
      document.getElementById("btn-craft")?.click();
    }
  }

  updatePortalTeleport(dt) {
    if (this.teleportCooldown > 0) {
      this.teleportCooldown -= dt;
      return;
    }
    if (!playerInPortal(this.world, this.player, TILE)) return;

    this.cacheEditsBeforeSwitch();
    if (this.dimension === Dimension.OVERWORLD) {
      this.dimension = Dimension.NETHER;
      this.world = new World(this.overworldSeed, Dimension.NETHER);
      this.world.applyEdits(this.editsCache.nether);
      this.player.x = 64 * TILE;
      this.player.y = 50 * TILE;
      this.showToast("进入下界");
    } else {
      this.dimension = Dimension.OVERWORLD;
      this.world = new World(this.overworldSeed, Dimension.OVERWORLD);
      this.world.applyEdits(this.editsCache.overworld);
      this.player.x = Math.floor(WORLD_W * 0.25) * TILE;
      this.player.y = 40 * TILE;
      this.showToast("返回主世界");
    }
    this.teleportCooldown = 2000;
  }

  refreshHotbar() {
    refreshHotbarEl(this);
  }

  loop(now) {
    if (!this.running) return;
    const dt = Math.min(32, now - (this.lastNow || now));
    this.lastNow = now;

    const { hotbarKey, flyToggle } = this.input.poll();
    if (hotbarKey !== undefined) {
      this.inventory.select(hotbarKey);
      this.refreshHotbar();
    }

    const jumpNow = this.input.jump;
    const jumpEdge = jumpNow && !this.jumpLatch;
    this.jumpLatch = jumpNow;
    this.player.update(this.world, { ...this.input, jump: jumpEdge }, {
      creative: this.gameMode === GameMode.CREATIVE,
      flyToggle,
    });

    if (this.input.mode === "use") {
      if ((this.input.pointer.down && !this.useHeldLatch) || this.input.use) {
        this.tryUse();
        this.useHeldLatch = true;
        this.input.use = false;
      }
    } else {
      this.useHeldLatch = false;
    }
    if (!this.input.pointer.down) this.useHeldLatch = false;

    const mineVis = this.updateMining(dt);
    const placed = this.tryPlace();
    this.updatePortalTeleport(dt);

    this.renderer.follow(this.player);
    this.renderer.drawSky(this.dimension);
    this.renderer.drawWorld(this.world, now);
    this.renderer.drawPlayer(this.player, this.equipment);

    if (mineVis) this.renderer.drawTargetHighlight(mineVis.tx, mineVis.ty, mineVis.progress);
    else if (placed) this.renderer.drawTargetHighlight(placed.tx, placed.ty, 0);
    else {
      const { tx, ty } = this.pickTargetTile();
      if (this.inReach(tx, ty)) this.renderer.drawTargetHighlight(tx, ty, 0);
    }

    const toast = performance.now() < this.toastUntil ? this.toast : "";
    this.renderer.drawHud({
      mode: this.input.mode,
      seed: this.overworldSeed,
      dimension: this.dimension,
      gameMode: this.gameMode,
      toast,
      flying: this.player.flying,
    });

    requestAnimationFrame(this.loop);
  }
}
