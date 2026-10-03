import {
  BLOCK_META,
  Block,
  MINE_TIME_MS,
  REACH,
  TILE,
  WORLD_H,
  WORLD_W,
} from "./constants.js";
import { Input } from "./input.js";
import { Inventory } from "./inventory.js";
import { Player } from "./player.js";
import { Renderer } from "./render.js";
import { applySave, buildSave, loadSave, writeSave } from "./storage.js";
import { World, worldToTile } from "./world.js";
import { surfaceHeight } from "./noise.js";

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas, ui.joystick, ui.jumpBtn);
    this.toast = "";
    this.toastUntil = 0;
    this.mineTarget = null;
    this.mineProgress = 0;
    this.baselineBlocks = null;
    this.jumpLatch = false;

    const saved = loadSave();
    if (saved?.seed) {
      this.world = new World(saved.seed);
      this.baselineBlocks = World.baseline(saved.seed);
      this.world.applyEdits(saved.edits);
      this.inventory = Inventory.fromJSON(saved.inventory);
      this.input.mode = saved.mode || "mine";
      const px = saved.player?.x;
      const py = saved.player?.y;
      this.player = new Player(px ?? TILE * 8, py ?? TILE * 40);
      this.showToast("已加载存档");
    } else {
      this.newWorld(Date.now() >>> 0, false);
    }

    this.bindUi();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    window.addEventListener("resize", () => this.renderer.resize());
    this.renderer.resize();

    setInterval(() => this.autoSave(), 45000);
  }

  bindUi() {
    this.ui.btnSave?.addEventListener("click", () => this.save());
    this.ui.btnNew?.addEventListener("click", () => {
      if (confirm("生成新地图？未保存的修改会丢失（可先点保存）。")) {
        this.newWorld((Math.random() * 1e9) >>> 0, true);
      }
    });
    this.ui.btnMode?.addEventListener("click", () => this.toggleMode());
    this.ui.hotbar?.addEventListener("click", (e) => {
      const slot = e.target.closest("[data-slot]");
      if (slot) this.inventory.select(Number(slot.dataset.slot));
      this.refreshHotbar();
    });
  }

  newWorld(seed, showMsg) {
    this.world = new World(seed);
    this.baselineBlocks = this.world.blocks.slice();
    const spawnX = Math.floor(WORLD_W * 0.25);
    const surface = surfaceHeight(spawnX, seed);
    this.player = new Player(spawnX * TILE + TILE * 0.2, (surface - 3) * TILE);
    this.inventory = new Inventory();
    this.input.mode = "mine";
    this.mineTarget = null;
    this.mineProgress = 0;
    if (showMsg) this.showToast(`新地图 · 种子 ${seed}`);
    this.refreshHotbar();
  }

  toggleMode() {
    this.input.mode = this.input.mode === "mine" ? "place" : "mine";
    this.ui.btnMode.textContent = this.input.mode === "mine" ? "挖掘" : "放置";
    this.refreshHotbar();
  }

  showToast(msg) {
    this.toast = msg;
    this.toastUntil = performance.now() + 2200;
  }

  save() {
    if (!this.baselineBlocks) this.baselineBlocks = World.baseline(this.world.seed);
    const ok = writeSave(buildSave(this));
    this.showToast(ok ? "已保存到本机" : "保存失败");
  }

  autoSave() {
    if (!this.baselineBlocks) this.baselineBlocks = World.baseline(this.world.seed);
    writeSave(buildSave(this));
  }

  pickTargetTile() {
    let wx;
    let wy;
    if (this.input.pointerWorld.active) {
      const w = this.renderer.screenToWorld(this.input.pointerWorld.x, this.input.pointerWorld.y);
      wx = w.x;
      wy = w.y;
    } else {
      const c = this.player.center();
      wx = c.x + this.player.facing * TILE * 1.2;
      wy = c.y;
    }
    const { tx, ty } = worldToTile(wx, wy, TILE);
    return { tx, ty };
  }

  inReach(tx, ty) {
    const c = this.player.center();
    const bx = tx * TILE + TILE * 0.5;
    const by = ty * TILE + TILE * 0.5;
    return Math.hypot(bx - c.x, by - c.y) <= REACH * TILE;
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
    this.mineProgress += dt / MINE_TIME_MS;
    if (this.mineProgress >= 1) {
      const drop = meta.drop ?? id;
      this.world.setBlock(tx, ty, Block.AIR);
      this.inventory.add(drop, 1);
      this.mineProgress = 0;
      this.mineTarget = null;
      this.refreshHotbar();
    }
    return { tx, ty, progress: Math.min(1, this.mineProgress) };
  }

  tryPlace() {
    if (!this.input.place || this.input.mode !== "place") return null;
    const { tx, ty } = this.pickTargetTile();
    const cur = this.world.getBlock(tx, ty);
    if (cur !== Block.AIR) return null;
    if (!this.inReach(tx, ty)) return null;
    if (this.player.intersectsTile(tx, ty)) return null;

    const blockId = this.inventory.selectedBlock();
    if (!this.inventory.canPlace(blockId)) {
      this.showToast("背包数量不足");
      return null;
    }
    this.inventory.use(blockId);
    this.world.setBlock(tx, ty, blockId);
    this.refreshHotbar();
    return { tx, ty };
  }

  refreshHotbar() {
    if (!this.ui.hotbar) return;
    const slots = this.ui.hotbar.querySelectorAll("[data-slot]");
    slots.forEach((el) => {
      const i = Number(el.dataset.slot);
      const bid = this.inventory.hotbar[i];
      const meta = BLOCK_META[bid];
      el.classList.toggle("selected", i === this.inventory.selected);
      el.style.background = meta?.color || "#333";
      el.querySelector(".label").textContent = meta?.name?.slice(0, 2) || "?";
      el.querySelector(".count").textContent = this.inventory.counts[bid] ?? 0;
    });
    if (this.ui.btnMode) {
      this.ui.btnMode.textContent = this.input.mode === "mine" ? "挖掘" : "放置";
      this.ui.btnMode.dataset.mode = this.input.mode;
    }
  }

  loop(now) {
    const dt = Math.min(32, now - (this.lastNow || now));
    this.lastNow = now;

    const { hotbarKey } = this.input.poll();
    if (hotbarKey !== undefined) {
      this.inventory.select(hotbarKey);
      this.refreshHotbar();
    }

    const jumpNow = this.input.jump;
    const jumpEdge = jumpNow && !this.jumpLatch;
    this.jumpLatch = jumpNow;
    this.player.update(this.world, { ...this.input, jump: jumpEdge });
    const mineVis = this.updateMining(dt);
    const placed = this.tryPlace();

    this.renderer.follow(this.player);
    this.renderer.drawSky();
    this.renderer.drawWorld(this.world);
    this.renderer.drawPlayer(this.player);

    if (mineVis) this.renderer.drawTargetHighlight(mineVis.tx, mineVis.ty, mineVis.progress);
    else if (placed) this.renderer.drawTargetHighlight(placed.tx, placed.ty, 0);
    else if (this.input.mode === "place" || this.input.mode === "mine") {
      const { tx, ty } = this.pickTargetTile();
      if (this.inReach(tx, ty)) this.renderer.drawTargetHighlight(tx, ty, 0);
    }

    const toast = performance.now() < this.toastUntil ? this.toast : "";
    this.renderer.drawHud({
      inventory: this.inventory,
      mode: this.input.mode,
      seed: this.world.seed,
      toast,
    });

    requestAnimationFrame(this.loop);
  }
}
