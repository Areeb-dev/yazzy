export type ReactionKind = 'emoji' | 'throwable';

export interface ReactionDef {
  id: string;
  kind: ReactionKind;
  emoji: string;
  label: string;
}

export const EMOJI_REACTIONS: readonly ReactionDef[] = [
  { id: 'laugh', kind: 'emoji', emoji: '😂', label: 'Laugh' },
  { id: 'love', kind: 'emoji', emoji: '😍', label: 'Love' },
  { id: 'angry', kind: 'emoji', emoji: '😡', label: 'Angry' },
  { id: 'cool', kind: 'emoji', emoji: '😎', label: 'Cool' },
  { id: 'clap', kind: 'emoji', emoji: '👏', label: 'Clap' },
  { id: 'cry', kind: 'emoji', emoji: '😭', label: 'Cry' },
  { id: 'fire', kind: 'emoji', emoji: '🔥', label: 'Fire' },
  { id: 'poop_emoji', kind: 'emoji', emoji: '💩', label: 'Poop' },
] as const;

export const THROWABLE_REACTIONS: readonly ReactionDef[] = [
  { id: 'tomato', kind: 'throwable', emoji: '🍅', label: 'Tomato' },
  // 🫏 is missing on many devices; client renders an SVG glyph for this id.
  { id: 'donkey', kind: 'throwable', emoji: '🐴', label: 'Donkey' },
  { id: 'poop_throw', kind: 'throwable', emoji: '💩', label: 'Poop' },
  { id: 'egg', kind: 'throwable', emoji: '🥚', label: 'Egg' },
  { id: 'fish', kind: 'throwable', emoji: '🐟', label: 'Fish' },
  { id: 'glove', kind: 'throwable', emoji: '🥊', label: 'Boxing Glove' },
  { id: 'banana', kind: 'throwable', emoji: '🍌', label: 'Banana' },
  { id: 'water', kind: 'throwable', emoji: '💦', label: 'Water Balloon' },
] as const;

const ALL = [...EMOJI_REACTIONS, ...THROWABLE_REACTIONS];
const BY_ID = new Map(ALL.map((r) => [r.id, r]));

export function findReaction(id: unknown, kind: unknown): ReactionDef | null {
  if (typeof id !== 'string' || (kind !== 'emoji' && kind !== 'throwable')) return null;
  const def = BY_ID.get(id);
  if (!def || def.kind !== kind) return null;
  return def;
}
