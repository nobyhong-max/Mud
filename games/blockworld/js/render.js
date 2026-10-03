import { BLOCK_META, Block, TILE, WORLD_H, WORLD_W } from "./constants.js";

const SKY_TOP = "#87c8f5";
const SKY_BOTTOM = "#c8e8ff";

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cam = { x: 0, y: 0 };
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = rect.width;
    this.viewH = rect.height;
  }

  follow(player) {
    const cx = player.x + player.w * 0.5;
    const cy = player.y + player.h * 0.5;
    const worldW = WORLD_W * TILE;
    const worldH = WORLD_H * TILE;
    this.cam.x = Math.max(0, Math.min(cx - this.viewW * 0.5, worldW - this.viewW));
    this.cam.y = Math.max(0, Math.min(cy - this.viewH * 0.45, worldH - this.viewH));
  }

  worldToScreen(wx, wy) {
    return { x: wx - this.cam.x, y: wy - this.cam.y };
  }

  screenToWorld(sx, sy) {
    return { x: sx + this.cam.x, y: sy + this.cam.y };
  }

  drawSky() {
    const g = this.ctx.createLinearGradient(0, 0, 0, this.viewH);
    g.addColorStop(0, SKY_TOP);
    g.addColorStop(1, SKY_BOTTOM);
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, this.viewW, this.viewH);
  }

  drawWorld(world) {
    const x0 = Math.max(0, Math.floor(this.cam.x / TILE) - 1);
    const x1 = Math.min(WORLD_W - 1, Math.ceil((this.cam.x + this.viewW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(this.cam.y / TILE) - 1);
    const y1 = Math.min(WORLD_H - 1, Math.ceil((this.cam.y + this.viewH) / TILE) + 1);

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const id = world.getBlock(tx, ty);
        if (id === Block.AIR) continue;
        this.drawBlock(tx, ty, id, world, ty);
      }
    }
  }

  drawBlock(tx, ty, id, world, surfaceHint) {
    const meta = BLOCK_META[id];
    const px = tx * TILE - this.cam.x;
    const py = ty * TILE - this.cam.y;
    this.ctx.fillStyle = meta.color;
    this.ctx.fillRect(px, py, TILE, TILE);

    if (id === Block.GRASS) {
      this.ctx.fillStyle = meta.top;
      this.ctx.fillRect(px, py, TILE, 4);
    }

    this.ctx.strokeStyle = "rgba(0,0,0,0.15)";
    this.ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);

    if (id === Block.STONE) {
      this.ctx.fillStyle = "rgba(255,255,255,0.06)";
      this.ctx.fillRect(px + 3, py + 4, 4, 3);
    }
  }

  drawPlayer(player) {
    const sx = player.x - this.cam.x;
    const sy = player.y - this.cam.y;
    this.ctx.fillStyle = "#3d2914";
    this.ctx.fillRect(sx + 2, sy + TILE * 0.35, player.w - 4, player.h - TILE * 0.35);
    this.ctx.fillStyle = "#f5c99a";
    this.ctx.fillRect(sx + player.w * 0.2, sy, player.w * 0.6, TILE * 0.55);
    this.ctx.fillStyle = "#5d4037";
    const eyeX = player.facing > 0 ? sx + player.w * 0.65 : sx + player.w * 0.25;
    this.ctx.fillRect(eyeX, sy + 8, 3, 3);
  }

  drawTargetHighlight(tx, ty, progress) {
    const px = tx * TILE - this.cam.x;
    const py = ty * TILE - this.cam.y;
    this.ctx.strokeStyle = progress > 0 ? "#ffd54f" : "rgba(255,255,255,0.85)";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
    if (progress > 0) {
      this.ctx.fillStyle = "rgba(255,213,79,0.35)";
      this.ctx.fillRect(px, py + TILE - 3, TILE * progress, 3);
    }
    this.ctx.lineWidth = 1;
  }

  drawHud({ inventory, mode, seed, toast }) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = "12px PingFang SC, Microsoft YaHei, sans-serif";
    ctx.fillStyle = "rgba(13,28,18,0.55)";
    ctx.fillRect(8, 8, 168, 36);
    ctx.fillStyle = "#e8f5e9";
    ctx.fillText(`模式：${mode === "mine" ? "挖掘" : "放置"}`, 16, 26);
    ctx.fillStyle = "#a5d6a7";
    ctx.fillText(`种子 ${seed}`, 16, 40);

    if (toast) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(this.viewW * 0.5 - 80, 12, 160, 28);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(toast, this.viewW * 0.5, 30);
      ctx.textAlign = "left";
    }
    ctx.restore();
  }
}
