/** Remappable keyboard binds — persisted in localStorage */

const STORAGE_KEY = "pulse-strike-binds-v1";

export const BIND_ACTIONS = [
  { id: "forward", label: "前进", defaultCode: "KeyW" },
  { id: "back", label: "后退", defaultCode: "KeyS" },
  { id: "left", label: "左移", defaultCode: "KeyA" },
  { id: "right", label: "右移", defaultCode: "KeyD" },
  { id: "shoot", label: "开火", defaultCode: "Mouse0" },
  { id: "reload", label: "换弹", defaultCode: "KeyR" },
  { id: "ability", label: "技能", defaultCode: "KeyQ" },
  { id: "pause", label: "暂停", defaultCode: "Escape" },
];

const DEFAULTS = Object.fromEntries(BIND_ACTIONS.map((a) => [a.id, a.defaultCode]));

export function loadBinds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveBinds(binds) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(binds));
}

export function resetBinds() {
  localStorage.removeItem(STORAGE_KEY);
  return { ...DEFAULTS };
}

export function codeLabel(code) {
  if (!code) return "—";
  if (code === "Mouse0") return "鼠左";
  if (code === "Mouse2") return "鼠右";
  if (code === "Escape") return "Esc";
  if (code === "Space") return "空格";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Arrow")) return code.slice(5);
  return code;
}

export function prettyBindsHelp(binds) {
  const L = (id) => codeLabel(binds[id]);
  return `${L("forward")}${L("left")}${L("back")}${L("right")} 移动 · ${L("shoot")} 开火 · ${L("reload")} 换弹 · ${L("ability")} 技能 · ${L("pause")} 暂停`;
}
