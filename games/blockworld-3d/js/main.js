import { Game } from "./game.js";

const ui = {
  app: document.getElementById("app"),
  hotbar: document.getElementById("hotbar"),
  btnMode: document.getElementById("btn-mode"),
  btnSave: document.getElementById("btn-save"),
  btnNew: document.getElementById("btn-new"),
  joystick: document.getElementById("joystick"),
  jumpBtn: document.getElementById("btn-jump"),
};

const game = new Game(document.getElementById("stage-wrap"), ui);

document.querySelectorAll("[data-start]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.start;
    const cont = btn.dataset.continue === "1";
    game.startFromMenu(mode, cont);
  });
});

document.getElementById("btn-mode-mobile")?.addEventListener("click", () => game.cycleInteractMode());
