import type { QuickChatTemplate } from "./quick-chat-templates";

/** Premium quick-chat lines unlocked by Team Comms Pack. */
export const PREMIUM_QUICK_CHAT_TEMPLATES: QuickChatTemplate[] = [
  { id: "knight_incoming", label: "Knight!", text: "Knight incoming!" },
  { id: "save_queen", label: "Save queen", text: "Save the queen!" },
  { id: "low_time", label: "Low time", text: "I'm low on time" },
  { id: "one_tempo", label: "One tempo", text: "One more tempo" },
  { id: "brutal_drop", label: "Brutal drop", text: "Brutal drop!" },
];

export const PREMIUM_CHAT_PACK_ID = "chat_team_comms";

export interface MatchEmote {
  id: string;
  label: string;
  glyph: string;
}

export const MATCH_EMOTES: MatchEmote[] = [
  { id: "emote_fire", label: "Fire", glyph: "🔥" },
  { id: "emote_thumbs", label: "Nice", glyph: "👍" },
  { id: "emote_sweat", label: "Sweat", glyph: "😅" },
  { id: "emote_sleep", label: "Sleep", glyph: "😴" },
  { id: "emote_knight", label: "Knight", glyph: "♞" },
  { id: "emote_gg", label: "GG", glyph: "🤝" },
];

export function getEmoteById(emoteId: string): MatchEmote | undefined {
  return MATCH_EMOTES.find((emote) => emote.id === emoteId);
}
