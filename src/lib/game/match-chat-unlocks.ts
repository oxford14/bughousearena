import type { UserProfile } from "@/types/firestore";
import { QUICK_CHAT_TEMPLATES, type QuickChatTemplate } from "./quick-chat-templates";
import {
  MATCH_EMOTES,
  PREMIUM_CHAT_PACK_ID,
  PREMIUM_QUICK_CHAT_TEMPLATES,
  type MatchEmote,
} from "./match-emotes";
import { hasUnlock } from "@/lib/shop/inventory";

export function getAvailableQuickChatTemplates(
  profile: UserProfile | null | undefined
): QuickChatTemplate[] {
  const templates = [...QUICK_CHAT_TEMPLATES];
  if (hasUnlock(profile, PREMIUM_CHAT_PACK_ID)) {
    templates.push(...PREMIUM_QUICK_CHAT_TEMPLATES);
  }
  return templates;
}

export function getAvailableEmotes(
  profile: UserProfile | null | undefined
): MatchEmote[] {
  return MATCH_EMOTES.filter((emote) => hasUnlock(profile, emote.id));
}

export function getEquippedEmotes(profile: UserProfile | null | undefined): MatchEmote[] {
  const equippedIds = profile?.equippedEmoteIds ?? [];
  const available = getAvailableEmotes(profile);
  if (equippedIds.length === 0) {
    return available.slice(0, 2);
  }
  return equippedIds
    .map((id) => available.find((emote) => emote.id === id))
    .filter((emote): emote is MatchEmote => Boolean(emote));
}
