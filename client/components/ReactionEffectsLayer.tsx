import { useEffect, useState, type CSSProperties } from 'react';
import type { ReactionEventPayload } from '@game/types/protocol';
import { findReaction } from '@game/types/reactions';
import { ReactionGlyph } from './ReactionGlyph';

const EMOJI_MS = 2200;
const THROW_MS = 720;
const IMPACT_MS = 900;

function anchor(id: 'me' | 'opp'): DOMRect | null {
  const el = document.querySelector(`[data-avatar-id="${id}"] .avatar-ring`);
  return el?.getBoundingClientRect() ?? null;
}

function seat(payload: ReactionEventPayload, meId: string): { from: 'me' | 'opp'; to: 'me' | 'opp' } {
  const from = payload.fromPlayerId === meId ? 'me' : 'opp';
  const to = payload.toPlayerId === meId ? 'me' : 'opp';
  return { from, to };
}

/** Keep emoji pops below the safe top edge so they never clip the screen. */
function emojiOrigin(rect: DOMRect, from: 'me' | 'opp'): CSSProperties {
  const safeTop = 56;
  const side = from === 'me' ? 1 : -1;
  const left = rect.left + rect.width / 2 + side * (rect.width * 0.55);
  const top = Math.max(safeTop, rect.bottom + 10);
  return {
    left,
    top,
    ['--emoji-drift-x' as string]: `${side * 18}px`,
  };
}

function EmojiBurst({
  event,
  meId,
  onDone,
}: {
  event: ReactionEventPayload;
  meId: string;
  onDone: () => void;
}) {
  const def = findReaction(event.reactionId, event.kind);
  const { from } = seat(event, meId);
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 });

  useEffect(() => {
    const rect = anchor(from);
    if (!rect || !def) {
      onDone();
      return;
    }
    setStyle(emojiOrigin(rect, from));
    const t = setTimeout(onDone, EMOJI_MS);
    return () => clearTimeout(t);
  }, [from, def, onDone]);

  if (!def) return null;

  return (
    <div className="reaction-fx reaction-fx-emoji" style={style} aria-hidden="true">
      <ReactionGlyph id={def.id} emoji={def.emoji} className="reaction-fx-emoji-inner" />
    </div>
  );
}

function ThrowableFx({
  event,
  meId,
  onDone,
}: {
  event: ReactionEventPayload;
  meId: string;
  onDone: () => void;
}) {
  const def = findReaction(event.reactionId, event.kind);
  const { from, to } = seat(event, meId);
  const [phase, setPhase] = useState<'fly' | 'impact' | 'done'>('fly');
  const [flyStyle, setFlyStyle] = useState<CSSProperties>({});
  const [impactStyle, setImpactStyle] = useState<CSSProperties>({});

  useEffect(() => {
    const a = anchor(from);
    const b = anchor(to);
    if (!a || !b || !def) {
      onDone();
      return;
    }
    const x0 = a.left + a.width / 2;
    const y0 = a.top + a.height / 2;
    const x1 = b.left + b.width / 2;
    const y1 = b.top + b.height / 2;
    const dx = x1 - x0;
    const dy = y1 - y0;
    setFlyStyle({
      left: x0,
      top: y0,
      ['--throw-dx' as string]: `${dx}px`,
      ['--throw-dy' as string]: `${dy}px`,
    });
    setImpactStyle({ left: x1, top: y1 });
    const flyEnd = setTimeout(() => setPhase('impact'), THROW_MS);
    const impactEnd = setTimeout(() => {
      setPhase('done');
      onDone();
    }, THROW_MS + IMPACT_MS);
    return () => {
      clearTimeout(flyEnd);
      clearTimeout(impactEnd);
    };
  }, [from, to, def, onDone]);

  if (!def || phase === 'done') return null;

  return (
    <>
      {phase === 'fly' && (
        <div className="reaction-fx reaction-fx-throw" style={flyStyle} aria-hidden="true">
          <ReactionGlyph id={def.id} emoji={def.emoji} className="reaction-fx-throw-inner" />
        </div>
      )}
      {phase === 'impact' && (
        <div
          className={`reaction-fx reaction-fx-impact reaction-fx-${event.reactionId}`}
          style={impactStyle}
          aria-hidden="true"
        >
          <ReactionGlyph id={def.id} emoji={def.emoji} className="reaction-fx-impact-emoji" />
          <i className="reaction-fx-splash" />
          <i className="reaction-fx-splash reaction-fx-splash-2" />
          <i className="reaction-fx-splash reaction-fx-splash-3" />
        </div>
      )}
    </>
  );
}

export function ReactionEffectsLayer({
  events,
  meId,
  onDone,
}: {
  events: ReactionEventPayload[];
  meId: string;
  onDone: (eventId: string) => void;
}) {
  if (!events.length) return null;

  return (
    <div className="reaction-fx-layer" aria-hidden="true">
      {events.map((event) =>
        event.kind === 'emoji' ? (
          <EmojiBurst key={event.eventId} event={event} meId={meId} onDone={() => onDone(event.eventId)} />
        ) : (
          <ThrowableFx key={event.eventId} event={event} meId={meId} onDone={() => onDone(event.eventId)} />
        ),
      )}
    </div>
  );
}
