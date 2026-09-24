/** Agent definitions — Valorant-style simple abilities */

export const CHARACTERS = [
  {
    id: "blitz",
    name: "BLITZ",
    role: "控制器 · 闪光",
    color: 0xffc857,
    abilityName: "FLASH",
    abilityKey: "Q",
    cooldown: 8,
    description: "投掷致盲闪光，干扰敌人瞄准约 2.5 秒。",
    ability: "flash",
  },
  {
    id: "vapor",
    name: "VAPOR",
    role: "控场 · 烟雾",
    color: 0x6ec6ff,
    abilityName: "SMOKE",
    abilityKey: "Q",
    cooldown: 10,
    description: "在准星落点生成浓烟屏障，遮挡视线约 8 秒。",
    ability: "smoke",
  },
  {
    id: "surge",
    name: "SURGE",
    role: "决斗 · 冲刺",
    color: 0x2ee6a6,
    abilityName: "DASH",
    abilityKey: "Q",
    cooldown: 6,
    description: "向前冲刺一段距离，落地回复少量生命。",
    ability: "dash",
  },
];

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}
