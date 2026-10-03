import { Game } from "./game.js";
import { GameMode } from "./constants.js";

const canvas = document.getElementById("game");
const ui = {
  app: document.getElementById("app"),
  joystick: document.getElementById("joystick"),
  jumpBtn: document.getElementById("btn-jump"),
  btnSave: document.getElementById("btn-save"),
  btnNew: document.getElementById("btn-new"),
  btnMode: document.getElementById("btn-mode"),
  hotbar: document.getElementById("hotbar"),
};

const game = new Game(canvas, ui);

document.getElementById("btn-mode-mobile")?.addEventListener("click", () => game.cycleInteractMode());

document.querySelectorAll("[data-start]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.start;
    const cont = btn.dataset.continue === "1";
    game.startFromMenu(mode === "creative" ? GameMode.CREATIVE : GameMode.SURVIVAL, cont);
  });
});
