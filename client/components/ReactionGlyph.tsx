import donkeyImg from '../assets/donkey.png';

/** Renders a reaction glyph — uses the donkey asset for that throwable. */
export function ReactionGlyph({ id, emoji, className }: { id: string; emoji: string; className?: string }) {
  if (id === 'donkey') {
    return (
      <span className={`reaction-glyph reaction-glyph-donkey ${className ?? ''}`} aria-hidden="true">
        <img src={donkeyImg} alt="" draggable={false} />
      </span>
    );
  }

  return (
    <span className={className} aria-hidden="true">
      {emoji}
    </span>
  );
}
