export interface QuickChatTemplate {
  id: string;
  label: string;
  text: string;
}

export const QUICK_CHAT_TEMPLATES: QuickChatTemplate[] = [
  { id: "hold", label: "Hold — waiting for piece", text: "Hold — waiting for a piece" },
  { id: "drop_knight", label: "Drop the knight!", text: "Drop the knight!" },
  { id: "drop_queen", label: "Drop the queen!", text: "Drop the queen!" },
  { id: "go_mate", label: "Go for mate", text: "Go for mate!" },
  { id: "need_piece", label: "Need a pawn", text: "Can you get me a pawn?" },
  { id: "nice", label: "Nice!", text: "Nice!" },
  { id: "gg", label: "GG", text: "GG" },
];
