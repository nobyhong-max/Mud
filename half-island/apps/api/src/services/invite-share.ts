import type { InviteShareCard, RelationshipType } from "@half-island/shared";

export function buildInviteShareCard(opts: {
  inviteCode: string;
  relationshipType: RelationshipType;
  baseUrl?: string;
}): InviteShareCard {
  const base = (opts.baseUrl || process.env.PUBLIC_WEB_BASE || "http://localhost:5173").replace(
    /\/$/,
    "",
  );
  const isFriends = opts.relationshipType === "friends";
  return {
    brand: "半个岛",
    slogan: "你来了，岛才完整。",
    sloganEn: "You arrive — the island becomes whole.",
    title: isFriends ? "来密友岛坐坐" : "来拼一座情侣岛",
    titleEn: isFriends ? "Join a friends island" : "Join a couple island",
    description: isFriends
      ? "岛上有新动静——先上岛，再一起写今日题。分享卡不暴露任何答案。"
      : "另一半半岛在等你。上岛后先写今日题；分享卡不暴露任何答案。",
    descriptionEn: isFriends
      ? "Something new on the island — come aboard, then write today's prompt. No answers on this card."
      : "The other peninsula is waiting. Write today's prompt after joining. No answers on this card.",
    inviteCode: opts.inviteCode,
    relationshipType: opts.relationshipType,
    deepLink: `${base}/invite?code=${encodeURIComponent(opts.inviteCode)}`,
    answersHidden: true,
  };
}
