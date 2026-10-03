import * as THREE from "three";
import {
  BLOCK_META,
  Block,
  Dimension,
  GameMode,
  Item,
  MINE_TIME_MS,
  isBlock,
} from "./constants.js";
import { Controls } from "./controls.js";
import { Inventory } from "./inventory.js";
import { Equipment } from "./equipment.js";
import { buildSave, hydrateFromSave, loadSave, writeSave } from "./storage.js";
import { VoxelWorld, surfaceSpawnY } from "./world.js";
import { voxelRaycast } from "./raycast.js";
import { activatePortal3D, findPortalInner3D, playerInPortal3D } from "./portal3d.js";
import { bindModals, refreshHotbarEl } from "./ui.js";
import { Player } from "./player.js";

export class Game {
  constructor(container, ui) {
    this.ui = ui;
    this.container = container;
    this.equipment = new Equipment();
    this.toast = "";
    this.toastUntil = 0;
    this.mineTarget = null;
    this.mineProgress = 0;
    this.gameMode = GameMode.SURVIVAL;
    this.dimension = Dimension.OVERWORLD;
    this.overworldSeed = 0;
    this.editsCache = { overworld: [], nether: [] };
    this.teleportCooldown = 0;
    this.running = false;
    this.highlight = null;

    this.initRenderer();
    this.controls = new Controls(this.renderer.domElement, ui);
    this.player = new Player(8, 70, 8);

    this.bindUi();
    bindModals(this);
    this.loop = this.loop.bind(this);
    window.addEventListener("resize", () => this.onResize());
    this.onResize();
  }

  initRenderer() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x87ceeb, 24, 90);
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 140);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.id = "game-canvas";
    this.container.appendChild(this.renderer.domElement);

    const amb = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(amb);
    this.sun = new THREE.DirectionalLight(0xfff5e6, 0.85);
    this.sun.position.set(40, 80, 20);
    this.scene.add(this.sun);

    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
    );
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    this.playerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1.7, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xc49a6c })
    );
    this.playerMesh.visible = false;
    this.scene.add(this.playerMesh);
  }

  onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  startFromMenu(mode, continueSave) {
    this.gameMode = mode;
    this.ui.app.hidden = false;
    document.getElementById("main-menu").hidden = true;

    if (continueSave) {
      const saved = loadSave();
      if (saved?.seed) {
        this.overworldSeed = saved.seed;
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
      this.lastNow = performance.now();
      requestAnimationFrame(this.loop);
      setInterval(() => this.autoSave(), 45000);
    }
    this.refreshHotbar();
  }

  bootNewWorld(seed, msg) {
    this.overworldSeed = seed;
    this.dimension = Dimension.OVERWORLD;
    this.editsCache = { overworld: [], nether: [] };
    const sx = 8;
    const sz = 8;
    const sy = surfaceSpawnY(sx, sz, seed);
    this.player = new Player(sx, sy, sz);
    this.inventory = new Inventory();
    this.equipment = new Equipment();
    this.loadDimension(Dimension.OVERWORLD);
    this.world.updateAround(sx, sz);
    if (this.gameMode === GameMode.CREATIVE) this.player.flying = true;
    if (msg) this.showToast(`新地图 · ${this.gameMode === GameMode.CREATIVE ? "创造" : "生存"}`);
  }

  loadDimension(dim) {
    this.dimension = dim;
    for (const m of [...this.scene.children]) {
      if (m.userData?.chunkKey) {
        this.scene.remove(m);
        m.geometry?.dispose();
      }
    }
    this.world = new VoxelWorld(this.overworldSeed, dim, this.scene);
    this.world.applyEditsList(this.editsCache[dim]);
    this.world.updateAround(this.player?.pos.x ?? 0, this.player?.pos.z ?? 0);
    this.setSky(dim);
  }

  setSky(dim) {
    if (dim === Dimension.NETHER) {
      this.scene.background = new THREE.Color(0x3a1018);
      this.scene.fog.color.set(0x3a1018);
      this.sun.intensity = 0.45;
    } else {
      this.scene.background = new THREE.Color(0x87ceeb);
      this.scene.fog.color.set(0x87ceeb);
      this.sun.intensity = 0.85;
    }
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
    const jumpBtn = this.ui.jumpBtn;
    jumpBtn?.addEventListener("pointerdown", () => jumpBtn.classList.add("active"));
    jumpBtn?.addEventListener("pointerup", () => jumpBtn.classList.remove("active"));
    jumpBtn?.addEventListener("pointercancel", () => jumpBtn.classList.remove("active"));
  }

  cycleInteractMode() {
    const order = ["mine", "place", "use"];
    const i = order.indexOf(this.controls.mode);
    this.setInteractMode(order[(i + 1) % order.length]);
  }

  setInteractMode(mode) {
    this.controls.setMode(mode);
    this.refreshHotbar();
  }

  nearCraftingTable() {
    if (this.gameMode === GameMode.CREATIVE) return true;
    const p = this.player.pos;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dz = -3; dz <= 3; dz++) {
          if (this.world.getBlock(Math.floor(p.x) + dx, Math.floor(p.y) + dy, Math.floor(p.z) + dz) === Block.CRAFTING_TABLE) {
            return true;
          }
        }
      }
    }
    return false;
  }

  showToast(msg) {
    this.toast = msg;
    this.toastUntil = performance.now() + 2400;
  }

  cacheEditsBeforeSwitch() {
    if (!this.world) return;
    this.editsCache[this.dimension] = this.world.collectEdits();
  }

  save() {
    const ok = writeSave(buildSave(this));
    this.showToast(ok ? "已保存到本机" : "保存失败");
  }

  autoSave() {
    if (!this.running) return;
    writeSave(buildSave(this));
  }

  lookDir() {
    const yaw = this.player.yaw;
    const pitch = this.player.pitch;
    return new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch)
    ).normalize();
  }

  pickRay() {
    const eye = this.player.eyePosition();
    const origin = new THREE.Vector3(eye.x, eye.y, eye.z);
    return voxelRaycast(this.world, origin, this.lookDir());
  }

  mineDuration(blockId) {
    const meta = BLOCK_META[blockId];
    let ms = MINE_TIME_MS * (meta?.hardness || 1);
    const hot = this.inventory.selectedStack();
    ms /= this.equipment.mineMultiplier(hot);
    if (this.gameMode === GameMode.CREATIVE) return 35;
    return ms;
  }

  updateMining(dt) {
    const active = this.controls.mine && this.controls.mode === "mine";
    if (!active) {
      this.mineTarget = null;
      this.mineProgress = 0;
      return null;
    }
    const hit = this.pickRay();
    if (!hit?.hit) {
      this.mineTarget = null;
      this.mineProgress = 0;
      return null;
    }
    const { x, y, z, id } = hit.hit;
    const meta = BLOCK_META[id];
    if (!meta?.mineable) {
      this.mineTarget = null;
      this.mineProgress = 0;
      return null;
    }
    const key = `${x},${y},${z}`;
    if (this.mineTarget !== key) {
      this.mineTarget = key;
      this.mineProgress = 0;
    }
    const need = this.mineDuration(id);
    this.mineProgress += dt / need;
    if (this.mineProgress >= 1) {
      const drop = meta.drop ?? id;
      if (this.gameMode !== GameMode.CREATIVE) this.inventory.add(drop, 1);
      this.world.setBlock(x, y, z, Block.AIR);
      this.mineProgress = 0;
      this.mineTarget = null;
      this.refreshHotbar();
    }
    return { x, y, z, progress: Math.min(1, this.mineProgress) };
  }

  tryPlace() {
    if (!this.controls.place || this.controls.mode !== "place") return null;
    const hit = this.pickRay();
    if (!hit?.place) return null;
    const { x, y, z } = hit.place;
    if (this.world.getBlock(x, y, z) !== Block.AIR) return null;
    if (this.player.blocksPlacement(this.world, x, y, z)) return null;
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
    this.world.setBlock(x, y, z, stack);
    this.refreshHotbar();
    return { x, y, z };
  }

  tryUse() {
    if (this.controls.mode !== "use") return;
    const hit = this.pickRay();
    if (!hit?.hit) return;
    const { x, y, z } = hit.hit;
    const stack = this.inventory.selectedStack();
    const block = this.world.getBlock(x, y, z);

    if (stack === Item.FLINT_STEEL) {
      const inner = findPortalInner3D(this.world, x, y, z);
      if (!inner) {
        this.showToast("需要黑曜石框（内空至少 4×5）");
        return;
      }
      activatePortal3D(this.world, inner);
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
    const p = this.player.pos;
    if (!playerInPortal3D(this.world, p.x, p.y + 1, p.z)) return;

    this.cacheEditsBeforeSwitch();
    if (this.dimension === Dimension.OVERWORLD) {
      this.loadDimension(Dimension.NETHER);
      this.player.pos.x = 8;
      this.player.pos.y = 55;
      this.player.pos.z = 8;
      this.showToast("进入下界");
    } else {
      this.loadDimension(Dimension.OVERWORLD);
      this.player.pos.x = 8;
      this.player.pos.y = surfaceSpawnY(8, 8, this.overworldSeed);
      this.player.pos.z = 8;
      this.showToast("返回主世界");
    }
    this.world.updateAround(this.player.pos.x, this.player.pos.z);
    this.teleportCooldown = 2000;
  }

  refreshHotbar() {
    refreshHotbarEl(this);
  }

  updateCamera() {
    const eye = this.player.eyePosition();
    if (this.player.thirdPerson) {
      const dist = 4.2;
      const dir = this.lookDir();
      this.camera.position.set(eye.x - dir.x * dist, eye.y - dir.y * dist + 0.4, eye.z - dir.z * dist);
      this.camera.lookAt(eye.x, eye.y, eye.z);
      this.playerMesh.visible = true;
      this.playerMesh.position.set(this.player.pos.x, this.player.pos.y + 0.85, this.player.pos.z);
    } else {
      this.camera.position.set(eye.x, eye.y, eye.z);
      const look = this.lookDir();
      this.camera.lookAt(eye.x + look.x, eye.y + look.y, eye.z + look.z);
      this.playerMesh.visible = false;
    }
  }

  updateHighlight() {
    const hit = this.pickRay();
    if (hit?.hit) {
      this.highlight.visible = true;
      this.highlight.position.set(hit.hit.x + 0.5, hit.hit.y + 0.5, hit.hit.z + 0.5);
    } else {
      this.highlight.visible = false;
    }
  }

  drawHud() {
    const el = document.getElementById("hud-toast");
    if (el) {
      el.textContent = performance.now() < this.toastUntil ? this.toast : "";
    }
    const info = document.getElementById("hud-info");
    if (info) {
      info.textContent = `${this.dimension === Dimension.NETHER ? "下界" : "主世界"} · ${this.gameMode === GameMode.CREATIVE ? "创造" : "生存"}${this.player.flying ? " · 飞行" : ""}`;
    }
  }

  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - (this.lastNow || now)) / 1000);
    this.lastNow = now;

    const { flyToggle, viewToggle, hotbarKey, use } = this.controls.poll();
    if (hotbarKey !== undefined) {
      this.inventory.select(hotbarKey);
      this.refreshHotbar();
    }
    if (flyToggle && this.gameMode === GameMode.CREATIVE) {
      this.player.flying = !this.player.flying;
      this.showToast(this.player.flying ? "飞行：开" : "飞行：关");
    }
    if (viewToggle) {
      this.player.thirdPerson = !this.player.thirdPerson;
    }

    const look = this.controls.consumeLook();
    this.player.yaw -= look.dx;
    this.player.pitch = Math.max(-1.45, Math.min(1.45, this.player.pitch - look.dy));

    this.player.update(this.world, this.controls, {
      creative: this.gameMode === GameMode.CREATIVE,
      dt,
    });

    if (this.controls.mode === "use" && use) this.tryUse();

    this.updateMining(dt * 1000);
    this.tryPlace();
    this.updatePortalTeleport(dt * 1000);

    this.world.updateAround(this.player.pos.x, this.player.pos.z);
    this.updateCamera();
    this.updateHighlight();
    this.drawHud();

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  }
}
