import { Game } from "./game.js";

const canvas = document.getElementById("game");
const ui = {
  joystick: document.getElementById("joystick"),
  jumpBtn: document.getElementById("btn-jump"),
  btnSave: document.getElementById("btn-save"),
  btnNew: document.getElementById("btn-new"),
  btnMode: document.getElementById("btn-mode"),
  hotbar: document.getElementById("hotbar"),
};

const game = new Game(canvas, ui);
game.refreshHotbar();

document.getElementById("btn-mode-mobile")?.addEventListener("click", () => game.toggleMode());
