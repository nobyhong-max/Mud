import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_URL = new URL("../models/fitness-hero.glb", import.meta.url).href;

/** @typedef {{ root: THREE.Group, joints: Record<string, THREE.Object3D>, barbells: THREE.Object3D[] }} HeroRig */

/** @type {HeroRig | null} */
let rig = null;
/** @type {THREE.WebGLRenderer | null} */
let renderer = null;
/** @type {THREE.Scene | null} */
let scene = null;
/** @type {THREE.PerspectiveCamera | null} */
let camera = null;
/** @type {HTMLCanvasElement | null} */
let glCanvas = null;
/** @type {HTMLCanvasElement | null} */
let bgCanvas = null;

function findByName(root, name) {
  let found = null;
  root.traverse((o) => {
    if (o.name === name) found = o;
  });
  return found;
}

function collectBarbells(root) {
  const list = [];
  root.traverse((o) => {
    if (o.name === "Barbell") list.push(o);
  });
  return list;
}

/**
 * @param {HTMLCanvasElement} overlayCanvas
 * @param {HTMLCanvasElement} backgroundCanvas
 */
export async function initHero3D(overlayCanvas, backgroundCanvas) {
  glCanvas = overlayCanvas;
  bgCanvas = backgroundCanvas;
  syncCanvasSize();

  renderer = new THREE.WebGLRenderer({
    canvas: glCanvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x152238, 0.9);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 0.95);
  key.position.set(1.2, 2.5, 2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffb347, 0.22);
  fill.position.set(-2, 1, -1);
  scene.add(fill);

  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
  camera.position.set(0, 1.02, 2.35);
  camera.lookAt(0, 0.88, 0);

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(MODEL_URL);
  const root = gltf.scene;
  root.scale.setScalar(1.05);
  scene.add(root);

  const jointNames = [
    "Hips",
    "Spine",
    "Chest",
    "Neck",
    "Head",
    "UpperArmL",
    "LowerArmL",
    "UpperArmR",
    "LowerArmR",
    "UpperLegL",
    "LowerLegL",
    "UpperLegR",
    "LowerLegR",
  ];
  /** @type {Record<string, THREE.Object3D>} */
  const joints = {};
  for (const n of jointNames) {
    const j = findByName(root, n);
    if (j) joints[n] = j;
  }
  rig = { root, joints, barbells: collectBarbells(root) };
  rig.barbells.forEach((b) => {
    b.visible = false;
  });

  window.addEventListener("resize", syncCanvasSize);
}

function syncCanvasSize() {
  if (!glCanvas || !bgCanvas || !renderer || !camera) return;
  const rect = bgCanvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  glCanvas.width = w;
  glCanvas.height = h;
  glCanvas.style.width = `${w}px`;
  glCanvas.style.height = `${h}px`;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

const bindRot = (obj, x = 0, y = 0, z = 0) => {
  if (!obj) return;
  obj.rotation.set(x, y, z);
};

/**
 * @param {string | null} action training id or idle
 * @param {number} phase animation phase
 */
export function updateHero3D(action, phase) {
  if (!rig || !renderer || !scene || !camera) return;
  syncCanvasSize();

  const a = action || "idle";
  const bounce = Math.sin(phase) * (a === "run" ? 0.04 : 0.015);
  const armSwing = Math.sin(phase * 1.6);
  const legSwing = Math.sin(phase * 1.8);

  rig.barbells.forEach((b) => {
    b.visible = a === "lift";
  });

  bindRot(rig.joints.Hips, 0, 0, 0);
  rig.root.position.y = bounce;

  bindRot(rig.joints.Spine, a === "yoga" ? -0.12 : 0, 0, 0);
  bindRot(rig.joints.Chest, 0, 0, 0);
  bindRot(rig.joints.Neck, 0, 0, 0);
  bindRot(rig.joints.Head, 0, 0, 0);

  if (a === "pushup") {
    bindRot(rig.joints.Hips, 0.95, 0, 0);
    bindRot(rig.joints.Spine, 0.15, 0, 0);
    bindRot(rig.joints.UpperArmL, 0.9, 0, -0.35);
    bindRot(rig.joints.UpperArmR, 0.9, 0, 0.35);
    bindRot(rig.joints.LowerArmL, 0.1, 0, 0);
    bindRot(rig.joints.LowerArmR, 0.1, 0, 0);
    bindRot(rig.joints.UpperLegL, -0.15, 0, -0.08);
    bindRot(rig.joints.UpperLegR, -0.15, 0, 0.08);
    bindRot(rig.joints.LowerLegL, 0.05, 0, 0);
    bindRot(rig.joints.LowerLegR, 0.05, 0, 0);
  } else if (a === "lift") {
    bindRot(rig.joints.UpperArmL, -1.35 - armSwing * 0.15, 0, -0.25);
    bindRot(rig.joints.UpperArmR, -1.35 + armSwing * 0.15, 0, 0.25);
    bindRot(rig.joints.LowerArmL, -0.35, 0, 0);
    bindRot(rig.joints.LowerArmR, -0.35, 0, 0);
    bindRot(rig.joints.UpperLegL, 0.08, 0, -0.05);
    bindRot(rig.joints.UpperLegR, 0.08, 0, 0.05);
    bindRot(rig.joints.LowerLegL, -0.05, 0, 0);
    bindRot(rig.joints.LowerLegR, -0.05, 0, 0);
  } else if (a === "run") {
    bindRot(rig.joints.UpperArmL, 0.55 + armSwing * 0.45, 0, -0.15);
    bindRot(rig.joints.UpperArmR, 0.55 - armSwing * 0.45, 0, 0.15);
    bindRot(rig.joints.LowerArmL, -0.35, 0, 0);
    bindRot(rig.joints.LowerArmR, -0.35, 0, 0);
    bindRot(rig.joints.UpperLegL, -0.45 + legSwing * 0.35, 0, 0);
    bindRot(rig.joints.UpperLegR, -0.45 - legSwing * 0.35, 0, 0);
    bindRot(rig.joints.LowerLegL, 0.35, 0, 0);
    bindRot(rig.joints.LowerLegR, 0.35, 0, 0);
  } else if (a === "yoga") {
    bindRot(rig.joints.UpperArmL, 0.15, 0, -1.35);
    bindRot(rig.joints.UpperArmR, 0.15, 0, 1.35);
    bindRot(rig.joints.LowerArmL, -0.2, 0, 0);
    bindRot(rig.joints.LowerArmR, -0.2, 0, 0);
    bindRot(rig.joints.UpperLegL, -0.55, 0, -0.2);
    bindRot(rig.joints.UpperLegR, -0.55, 0, 0.2);
    bindRot(rig.joints.LowerLegL, 0.65, 0, 0);
    bindRot(rig.joints.LowerLegR, 0.65, 0, 0);
  } else {
    bindRot(rig.joints.UpperArmL, 0.12, 0, -0.22);
    bindRot(rig.joints.UpperArmR, 0.12, 0, 0.22);
    bindRot(rig.joints.LowerArmL, -0.15, 0, 0);
    bindRot(rig.joints.LowerArmR, -0.15, 0, 0);
    bindRot(rig.joints.UpperLegL, 0.05, 0, -0.04);
    bindRot(rig.joints.UpperLegR, 0.05, 0, 0.04);
    bindRot(rig.joints.LowerLegL, -0.03, 0, 0);
    bindRot(rig.joints.LowerLegR, -0.03, 0, 0);
  }

  renderer.render(scene, camera);
}

export function hero3DReady() {
  return rig !== null;
}
