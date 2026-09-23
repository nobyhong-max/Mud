import type { BoardId, MainBoardId, SegmentBoardId } from "./types";

export const MAIN_BOARD_IDS: MainBoardId[] = [
  "revenue",
  "buzz",
  "growth",
  "oss-stars",
  "maker-love",
];

export const SEGMENT_BOARD_IDS: SegmentBoardId[] = [
  "vibe-coding",
  "ai-media",
  "ai-agents",
  "local-ai",
  "cn-indie",
  "micro-saas",
];

export const ALL_BOARD_IDS: BoardId[] = [
  ...MAIN_BOARD_IDS,
  ...SEGMENT_BOARD_IDS,
];

export function isBoardId(id: string): id is BoardId {
  return ALL_BOARD_IDS.includes(id as BoardId);
}

export function isSegmentBoard(id: BoardId): id is SegmentBoardId {
  return SEGMENT_BOARD_IDS.includes(id as SegmentBoardId);
}

export function segmentTagFilter(board: SegmentBoardId): (tags: string[]) => boolean {
  switch (board) {
    case "vibe-coding":
      return (tags) => tags.includes("vibe-coding");
    case "ai-media":
      return (tags) =>
        tags.some((t) => ["image", "video", "audio", "ai-media"].includes(t));
    case "ai-agents":
      return (tags) => tags.some((t) => ["agents", "ai-agents"].includes(t));
    case "local-ai":
      return (tags) => tags.some((t) => ["local", "privacy", "local-ai"].includes(t));
    case "cn-indie":
      return (tags) => tags.includes("cn-indie");
    case "micro-saas":
      return (tags) => tags.includes("micro-saas");
    default:
      return () => true;
  }
}

export function defaultSortBoardForSegment(): MainBoardId {
  return "buzz";
}
