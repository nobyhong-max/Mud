/** Agent definitions — Valorant-style simple abilities */

export const CHARACTERS = [
  {
    id: "blitz",
    name: "BLITZ",
    nameCn: "闪光",
    role: "控场",
    effectTag: "致盲",
    color: 0xffc857,
    abilityName: "闪光",
    abilityKey: "Q",
    cooldown: 5,
    description: "扔闪光弹，近处敌人瞎瞄约 2.5 秒。",
    ability: "flash",
  },
  {
    id: "vapor",
    name: "VAPOR",
    nameCn: "烟幕",
    role: "遮挡",
    effectTag: "烟雾",
    color: 0x6ec6ff,
    abilityName: "烟雾",
    abilityKey: "Q",
    cooldown: 5,
    description: "准星落点起烟墙，挡视线约 8 秒。",
    ability: "smoke",
  },
  {
    id: "surge",
    name: "SURGE",
    nameCn: "疾风",
    role: "机动",
    effectTag: "冲刺",
    color: 0x2ee6a6,
    abilityName: "冲刺",
    abilityKey: "Q",
    cooldown: 5,
    description: "向前突进一段，落地回一点血。",
    ability: "dash",
  },
];

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}
