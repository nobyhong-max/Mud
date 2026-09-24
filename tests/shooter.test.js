import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("characters module exports three distinct agents", async () => {
  const src = readFileSync(join(root, "js/game/characters.js"), "utf8");
  assert.match(src, /id:\s*"blitz"/);
  assert.match(src, /id:\s*"vapor"/);
  assert.match(src, /id:\s*"surge"/);
  assert.match(src, /ability:\s*"flash"/);
  assert.match(src, /ability:\s*"smoke"/);
  assert.match(src, /ability:\s*"dash"/);
});

test("maps module exports two arenas", () => {
  const src = readFileSync(join(root, "js/game/maps.js"), "utf8");
  assert.match(src, /id:\s*"yard"/);
  assert.match(src, /id:\s*"corridors"/);
  assert.match(src, /function buildYard/);
  assert.match(src, /function buildCorridors/);
});

test("index wires menu, HUD, and three.js import map", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  assert.match(html, /screen-menu/);
  assert.match(html, /char-grid/);
  assert.match(html, /map-grid/);
  assert.match(html, /minimap/);
  assert.match(html, /vendor\/three\.module\.js/);
  assert.match(html, /js\/game\/main\.js/);
});

test("package start script serves static files", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.match(pkg.scripts.start, /http\.server/);
});
