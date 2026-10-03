import { RECIPES, applyCraft, canCraft } from "./crafting.js";
import { ITEM_META, isBlock, isItem, stackColor, stackName } from "./constants.js";

export function bindModals(game) {
  const craftModal = document.getElementById("modal-craft");
  const equipModal = document.getElementById("modal-equip");
  const craftList = document.getElementById("craft-recipes");
  const equipSlots = document.getElementById("equip-slots");
  const invList = document.getElementById("equip-inventory");

  document.getElementById("btn-craft")?.addEventListener("click", () => {
    if (!game.nearCraftingTable()) {
      game.showToast("请靠近工作台（3 格内）");
      return;
    }
    openCraft(game, craftModal, craftList);
  });

  document.getElementById("btn-equip")?.addEventListener("click", () => {
    openEquip(game, equipModal, equipSlots, invList);
  });

  craftModal?.querySelector(".close")?.addEventListener("click", () => closeModal(craftModal, game));
  equipModal?.querySelector(".close")?.addEventListener("click", () => closeModal(equipModal, game));

  document.getElementById("btn-mode-use")?.addEventListener("click", () => game.setInteractMode("use"));
  document.getElementById("btn-fly")?.addEventListener("click", () => {
    if (game.gameMode !== "creative") return;
    game.player.flying = !game.player.flying;
    game.showToast(game.player.flying ? "飞行：开" : "飞行：关");
  });
  document.getElementById("btn-view")?.addEventListener("click", () => {
    game.player.thirdPerson = !game.player.thirdPerson;
    game.showToast(game.player.thirdPerson ? "第三人称" : "第一人称");
  });
}

function closeModal(modal, game) {
  modal?.classList.remove("open");
  game.controls.uiBlocked = false;
}

function openCraft(game, modal, listEl) {
  game.controls.uiBlocked = true;
  listEl.innerHTML = "";
  for (const recipe of RECIPES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "recipe";
    const inputs = Object.entries(recipe.inputs)
      .map(([id, n]) => `${stackName(Number(id))}×${n}`)
      .join(" + ");
    btn.textContent = `${recipe.name} ← ${inputs}`;
    btn.disabled = !canCraft(recipe, game.inventory.counts);
    btn.addEventListener("click", () => {
      if (applyCraft(recipe, game.inventory)) {
        game.showToast(`合成：${recipe.name}`);
        game.refreshHotbar();
        openCraft(game, modal, listEl);
      }
    });
    listEl.appendChild(btn);
  }
  modal.classList.add("open");
}

function openEquip(game, modal, slotsEl, invEl) {
  game.controls.uiBlocked = true;
  const slotNames = [
    ["head", "头部"],
    ["chest", "胸甲"],
    ["legs", "护腿"],
    ["tool", "工具/武器"],
  ];
  slotsEl.innerHTML = "";
  for (const [key, label] of slotNames) {
    const row = document.createElement("div");
    row.className = "equip-row";
    const id = game.equipment.slots[key];
    row.innerHTML = `<span>${label}</span><button type="button" data-unequip="${key}">${id ? stackName(id) : "空"}</button>`;
    row.querySelector("button").addEventListener("click", () => {
      const prev = game.equipment.unequip(key);
      if (prev) game.inventory.add(prev, 1);
      game.refreshHotbar();
      openEquip(game, modal, slotsEl, invEl);
    });
    slotsEl.appendChild(row);
  }

  invEl.innerHTML = "";
  for (const [idStr, count] of Object.entries(game.inventory.counts)) {
    const id = Number(idStr);
    if (count <= 0 || !isItem(id)) continue;
    const meta = ITEM_META[id];
    if (!meta?.slot && !meta?.tool) continue;
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `${meta.icon || ""}${meta.name} ×${count}`;
    b.addEventListener("click", () => {
      if (!game.inventory.has(id, 1)) return;
      game.inventory.use(id, false);
      const prev = meta.slot ? game.equipment.unequip(meta.slot) : game.equipment.unequip("tool");
      if (prev) game.inventory.add(prev, 1);
      game.equipment.equip(id);
      game.refreshHotbar();
      openEquip(game, modal, slotsEl, invEl);
    });
    invEl.appendChild(b);
  }
  modal.classList.add("open");
}

export function refreshHotbarEl(game) {
  const hotbar = game.ui.hotbar;
  if (!hotbar) return;
  hotbar.querySelectorAll("[data-slot]").forEach((el) => {
    const i = Number(el.dataset.slot);
    const sid = game.inventory.hotbar[i];
    el.classList.toggle("selected", i === game.inventory.selected);
    if (isBlock(sid)) el.style.background = stackColor(sid);
    else el.style.background = "#3a3028";
    el.querySelector(".label").textContent = isItem(sid) ? ITEM_META[sid]?.icon || "道" : stackName(sid).slice(0, 2);
    const c = game.inventory.counts[sid] ?? 0;
    el.querySelector(".count").textContent = game.gameMode === "creative" && isBlock(sid) ? "∞" : c;
  });
  const labels = { mine: "挖掘", place: "放置", use: "使用" };
  game.ui.btnMode.textContent = labels[game.controls.mode] || "挖掘";
  game.ui.btnMode.dataset.mode = game.controls.mode;
}
