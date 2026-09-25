/**
 * Procedural low-poly tactical rifle → GLB (+ optional preview PNG).
 * Run: node scripts/build-rifle-glb.mjs [--preview /path/to.png]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';

/** GLTFExporter expects browser FileReader when embedding buffers. */
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    _finish(buf) {
      this.result = buf;
      this.onloadend?.();
    }

    readAsArrayBuffer(blob) {
      Promise.resolve(typeof blob.arrayBuffer === 'function' ? blob.arrayBuffer() : blob)
        .then((buf) => this._finish(buf))
        .catch((err) => this.onerror?.(err));
    }

    readAsDataURL(blob) {
      this.readAsArrayBuffer(blob);
      const prev = this.onloadend;
      this.onloadend = () => {
        const b = Buffer.from(this.result);
        this.result = `data:application/octet-stream;base64,${b.toString('base64')}`;
        prev?.();
      };
    }
  };
}
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outGlb = path.join(root, 'public/models/tactical-rifle.glb');

function box(w, h, d, color, metalness = 0.35, roughness = 0.55) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, metalness, roughness })
  );
  m.castShadow = true;
  return m;
}

function cyl(rTop, rBot, h, seg, color, metalness = 0.5, roughness = 0.45) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBot, h, seg),
    new THREE.MeshStandardMaterial({ color, metalness, roughness })
  );
  m.castShadow = true;
  return m;
}

/** Builds 弧光-style assault rifle; +Z = muzzle (viewmodel rotated in game). */
export function buildTacticalRifle() {
  const rifle = new THREE.Group();
  rifle.name = 'TacticalRifle';

  const receiver = box(0.06, 0.11, 0.32, 0x2a3238, 0.55, 0.42);
  receiver.position.set(0, 0, 0.02);
  rifle.add(receiver);

  const barrel = cyl(0.018, 0.018, 0.38, 8, 0x1a1f24, 0.7, 0.35);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, 0.36);
  rifle.add(barrel);

  const muzzleBrake = cyl(0.024, 0.02, 0.05, 6, 0x111518, 0.75, 0.3);
  muzzleBrake.rotation.x = Math.PI / 2;
  muzzleBrake.position.set(0, 0.02, 0.58);
  rifle.add(muzzleBrake);

  const handguard = box(0.055, 0.075, 0.22, 0x3d4a38, 0.25, 0.65);
  handguard.position.set(0, -0.01, 0.22);
  rifle.add(handguard);

  const rail = box(0.035, 0.018, 0.18, 0x252a30, 0.6, 0.4);
  rail.position.set(0, 0.055, 0.2);
  rifle.add(rail);

  const optic = box(0.04, 0.035, 0.12, 0x0d0f12, 0.65, 0.35);
  optic.position.set(0, 0.09, 0.08);
  rifle.add(optic);

  const mag = box(0.035, 0.14, 0.07, 0x1e2428, 0.5, 0.5);
  mag.position.set(0, -0.12, -0.02);
  mag.rotation.x = 0.22;
  rifle.add(mag);

  const grip = box(0.045, 0.12, 0.05, 0x2c3530, 0.15, 0.75);
  grip.position.set(0, -0.1, -0.1);
  grip.rotation.x = -0.35;
  rifle.add(grip);

  const stock = box(0.05, 0.08, 0.2, 0x3a3028, 0.1, 0.8);
  stock.position.set(0, 0.01, -0.22);
  rifle.add(stock);

  const accent = box(0.062, 0.008, 0.08, 0x2ad4ff, 0.2, 0.4);
  accent.position.set(0, 0.042, 0.05);
  rifle.add(accent);

  rifle.userData.polyCount = countTriangles(rifle);
  return rifle;
}

function countTriangles(obj) {
  let n = 0;
  obj.traverse((c) => {
    if (c.isMesh?.geometry) {
      const g = c.geometry;
      if (g.index) n += g.index.count / 3;
      else if (g.attributes.position) n += g.attributes.position.count / 3;
    }
  });
  return Math.round(n);
}

function exportGlb(group, filePath) {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      group,
      (result) => {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        if (result instanceof ArrayBuffer) {
          fs.writeFileSync(filePath, Buffer.from(result));
        } else {
          fs.writeFileSync(filePath.replace('.glb', '.gltf'), JSON.stringify(result, null, 2));
        }
        resolve();
      },
      (err) => reject(err),
      { binary: true }
    );
  });
}

async function renderPreview(group, filePath) {
  let createCanvas;
  try {
    ({ createCanvas } = await import('canvas'));
  } catch {
    console.warn('Skip preview: npm package "canvas" not installed');
    return;
  }
  const w = 960;
  const h = 540;
  const canvas = createCanvas(w, h);
  canvas.addEventListener = () => {};
  canvas.removeEventListener = () => {};
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setClearColor(0x0a1218, 1);

  const scene = new THREE.Scene();
  const clone = group.clone(true);
  scene.add(clone);

  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x223044, 0.9);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(2, 4, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x2ad4ff, 0.35);
  rim.position.set(-3, 1, -2);
  scene.add(rim);

  const cam = new THREE.PerspectiveCamera(42, w / h, 0.01, 20);
  cam.position.set(0.55, 0.18, 0.75);
  cam.lookAt(0, 0, 0.15);

  clone.rotation.set(-0.15, -Math.PI * 0.65, 0.08);
  clone.position.set(-0.05, -0.02, 0);

  renderer.render(scene, cam);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, canvas.toBuffer('image/png'));
  renderer.dispose();
}

async function main() {
  const rifle = buildTacticalRifle();
  const tris = rifle.userData.polyCount;
  await exportGlb(rifle, outGlb);
  console.log(`Wrote ${outGlb} (~${tris} tris)`);

  const previewArg = process.argv.indexOf('--preview');
  if (previewArg !== -1 && process.argv[previewArg + 1]) {
    await renderPreview(rifle, process.argv[previewArg + 1]);
    console.log(`Preview ${process.argv[previewArg + 1]}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
