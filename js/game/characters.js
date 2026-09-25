/** Agent definitions — Valorant-style simple abilities */

export const CHARACTERS = [
  {
    id: "blitz",
    name: "BLITZ",
    role: "控制器",
    effectTag: "致盲",
    color: 0xffc857,
    abilityName: "致盲闪光",
    abilityKey: "Q",
    cooldown: 5,
    description: "投掷致盲闪光，干扰敌人瞄准约 2.5 秒。冷却 5 秒。",
    ability: "flash",
  },
  {
    id: "vapor",
    name: "VAPOR",
    role: "控场",
    effectTag: "烟雾",
    color: 0x6ec6ff,
    abilityName: "烟雾遮挡",
    abilityKey: "Q",
    cooldown: 5,
    description: "在准星落点生成浓烟屏障，遮挡视线约 8 秒。冷却 5 秒。",
    ability: "smoke",
  },
  {
    id: "surge",
    name: "SURGE",
    role: "决斗",
    effectTag: "冲刺",
    color: 0x2ee6a6,
    abilityName: "冲刺腾空",
    abilityKey: "Q",
    cooldown: 5,
    description: "向前冲刺一段距离，落地回复少量生命。冷却 5 秒。",
    ability: "dash",
  },
];

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}
