/**
 * Procedural low-poly fitness protagonist → GLB (+ optional preview PNG).
 * Run from repo root: npm run models:fitness-hero
 * Preview: node games/fitness-trainer/scripts/build-fitness-hero-glb.mjs --preview /path/to.png
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class FileReader {
    _finish(buf) {
      this.result = buf;
      this.onloadend?.();
    }

    readAsArrayBuffer(blob) {
      Promise.resolve(typeof blob.arrayBuffer === "function" ? blob.arrayBuffer() : blob)
        .then((buf) => this._finish(buf))
        .catch((err) => this.onerror?.(err));
    }

    readAsDataURL(blob) {
      this.readAsArrayBuffer(blob);
      const prev = this.onloadend;
      this.onloadend = () => {
        const b = Buffer.from(this.result);
        this.result = `data:application/octet-stream;base64,${b.toString("base64")}`;
        prev?.();
      };
    }
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.join(__dirname, "..");
const outGlb = path.join(gameRoot, "models/fitness-hero.glb");

const SKIN = 0xffb347;
const SHIRT = 0x3b82f6;
const SHORTS = 0x1e3a5f;
const SHOE = 0xf8fafc;

function boxMesh(w, h, d, color, metalness = 0.05, roughness = 0.72) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, metalness, roughness })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addPart(parent, mesh, ox = 0, oy = 0, oz = 0) {
  mesh.position.set(ox, oy, oz);
  parent.add(mesh);
  return mesh;
}

function joint(name, parent, y = 0, x = 0, z = 0) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/** Low-poly humanoid with named joints for runtime pose (idle / train). */
export function buildFitnessHero() {
  const root = new THREE.Group();
  root.name = "FitnessHero";

  const hips = joint("Hips", root, 0.92);

  const upperLegL = joint("UpperLegL", hips, 0, -0.07, 0);
  addPart(upperLegL, boxMesh(0.1, 0.22, 0.1, SHORTS), 0, -0.11, 0);
  const lowerLegL = joint("LowerLegL", upperLegL, -0.22);
  addPart(lowerLegL, boxMesh(0.09, 0.24, 0.09, SHORTS), 0, -0.12, 0);
  addPart(lowerLegL, boxMesh(0.11, 0.06, 0.14, SHOE), 0, -0.27, 0.02);

  const upperLegR = joint("UpperLegR", hips, 0, 0.07, 0);
  addPart(upperLegR, boxMesh(0.1, 0.22, 0.1, SHORTS), 0, -0.11, 0);
  const lowerLegR = joint("LowerLegR", upperLegR, -0.22);
  addPart(lowerLegR, boxMesh(0.09, 0.24, 0.09, SHORTS), 0, -0.12, 0);
  addPart(lowerLegR, boxMesh(0.11, 0.06, 0.14, SHOE), 0, -0.27, 0.02);

  const spine = joint("Spine", hips, 0.08);
  addPart(spine, boxMesh(0.24, 0.2, 0.13, SHIRT), 0, 0.1, 0);

  const chest = joint("Chest", spine, 0.18);
  addPart(chest, boxMesh(0.26, 0.14, 0.14, SHIRT), 0, 0.06, 0);

  const neck = joint("Neck", chest, 0.12);
  const head = joint("Head", neck, 0.06);
  addPart(head, boxMesh(0.17, 0.17, 0.17, SKIN), 0, 0.08, 0);

  const upperArmL = joint("UpperArmL", chest, 0.04, -0.16, 0);
  addPart(upperArmL, boxMesh(0.08, 0.18, 0.08, SHIRT), 0, -0.09, 0);
  const lowerArmL = joint("LowerArmL", upperArmL, -0.18);
  addPart(lowerArmL, boxMesh(0.07, 0.16, 0.07, SKIN), 0, -0.08, 0);

  const upperArmR = joint("UpperArmR", chest, 0.04, 0.16, 0);
  addPart(upperArmR, boxMesh(0.08, 0.18, 0.08, SHIRT), 0, -0.09, 0);
  const lowerArmR = joint("LowerArmR", upperArmR, -0.18);
  addPart(lowerArmR, boxMesh(0.07, 0.16, 0.07, SKIN), 0, -0.08, 0);

  const barbell = boxMesh(0.52, 0.05, 0.05, 0x64748b, 0.45, 0.5);
  barbell.name = "Barbell";
  barbell.visible = false;
  barbell.position.set(0, -0.12, 0.08);
  lowerArmL.add(barbell.clone());
  const barbellR = barbell.clone();
  lowerArmR.add(barbellR);

  root.userData.polyCount = countTriangles(root);
  return root;
}

function countTriangles(obj) {
  let n = 0;
  obj.traverse((c) => {
    if (c.isMesh && c.geometry) {
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
          fs.writeFileSync(filePath.replace(".glb", ".gltf"), JSON.stringify(result, null, 2));
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
    ({ createCanvas } = await import("canvas"));
  } catch {
    console.warn('Skip preview: npm package "canvas" not installed');
    return;
  }
  const w = 640;
  const h = 480;
  const canvas = createCanvas(w, h);
  canvas.addEventListener = () => {};
  canvas.removeEventListener = () => {};
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setClearColor(0x1b2a45, 1);

  const scene = new THREE.Scene();
  const clone = group.clone(true);
  scene.add(clone);

  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x223044, 0.85);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.05);
  key.position.set(2, 4, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffb347, 0.25);
  rim.position.set(-2, 2, -3);
  scene.add(rim);

  const cam = new THREE.PerspectiveCamera(38, w / h, 0.05, 20);
  cam.position.set(0.35, 1.05, 1.55);
  cam.lookAt(0, 0.85, 0);

  clone.rotation.y = -0.35;
  renderer.render(scene, cam);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, canvas.toBuffer("image/png"));
  renderer.dispose();
}

async function main() {
  const hero = buildFitnessHero();
  const tris = hero.userData.polyCount;
  await exportGlb(hero, outGlb);
  console.log(`Wrote ${outGlb} (~${tris} tris)`);

  const previewArg = process.argv.indexOf("--preview");
  if (previewArg !== -1 && process.argv[previewArg + 1]) {
    await renderPreview(hero, process.argv[previewArg + 1]);
    console.log(`Preview ${process.argv[previewArg + 1]}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
