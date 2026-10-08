import { useEffect, useRef } from 'react';
import { Cube, prefersReducedMotion } from './Cube';
import type { LastRoll } from '../types';

interface Props {
  dice: number[];
  held: boolean[];
  /** Tapping a die toggles hold. */
  interactive: boolean;
  lastRoll: LastRoll | null;
  /** Tumble the dice for this roll? Off for another human's rolls: they only see the result. */
  animateRolls: boolean;
  /** While the scored dice fly to the board: draw empty slots, keep the hold borders. */
  flyingHeld: boolean[] | null;
  onToggle: (index: number) => void;
}

function Sparkle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 1.2C12.8 7.4 16.6 11.2 22.8 12C16.6 12.8 12.8 16.6 12 22.8C11.2 16.6 7.4 12.8 1.2 12C7.4 11.2 11.2 7.4 12 1.2Z"
        fill="#fff"
        stroke="#fff"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

const SLOT_UNITS = 65.7;

export function DiceTray({ dice, held, interactive, lastRoll, animateRolls, flyingHeld, onToggle }: Props) {
  const slots = useRef<(HTMLButtonElement | null)[]>([]);
  const flying = flyingHeld !== null;

  // Each die keeps its own spin counter, and only dice that were actually rolled get a new one.
  // (Held dice must stay perfectly still, so their counter must not change on a re-roll.)
  const spin = useRef({ nonce: 0, keys: [0, 0, 0, 0, 0] });
  if (lastRoll && lastRoll.nonce !== spin.current.nonce) {
    spin.current = {
      nonce: lastRoll.nonce,
      keys: spin.current.keys.map((k, i) => (animateRolls && lastRoll.indices.includes(i) ? lastRoll.nonce : k)),
    };
  }

  // Dice that were just rolled hop out of their slot while they tumble.
  useEffect(() => {
    if (!lastRoll || !animateRolls || prefersReducedMotion()) return;
    const anims: Animation[] = [];
    for (const i of lastRoll.indices) {
      const el = slots.current[i];
      if (!el) continue;
      const k = el.offsetWidth / SLOT_UNITS;
      el.style.zIndex = '3';
      const a = el.animate(
        [
          { transform: 'translateY(0) scale(1)' },
          { transform: `translateY(${-18 * k}px) scale(1.24)`, offset: 0.4 },
          { transform: 'translateY(0) scale(1)' },
        ],
        { duration: 640, easing: 'cubic-bezier(.3,.7,.3,1)' },
      );
      a.onfinish = a.oncancel = () => {
        el.style.zIndex = '';
      };
      anims.push(a);
    }
    return () => anims.forEach((a) => a.cancel());
  }, [lastRoll, animateRolls]);

  return (
    <div className="tray" role="group" aria-label="Dice">
      {Array.from({ length: 5 }, (_, i) => {
        const value = flying ? 0 : (dice[i] ?? 0);
        const isHeld = flying ? !!flyingHeld?.[i] : !!held[i];
        const spinKey = spin.current.keys[i];
        return (
          <button
            key={i}
            ref={(el) => {
              slots.current[i] = el;
            }}
            type="button"
            className="slot"
            data-slot={i}
            data-held={isHeld}
            data-empty={value === 0}
            data-flying={flying}
            disabled={!interactive || value === 0}
            aria-pressed={interactive ? isHeld : undefined}
            aria-label={value ? `Die ${i + 1}: ${value}${isHeld ? ', held' : ''}` : `Die ${i + 1}: not rolled`}
            onClick={() => onToggle(i)}
          >
            <span className="slot-spark">
              <Sparkle />
            </span>
            <span className="cube-wrap" aria-hidden="true">
              <Cube value={value} spinKey={spinKey} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
