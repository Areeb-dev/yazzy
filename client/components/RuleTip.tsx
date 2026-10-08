import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Category } from '@game/types';

export type TipTarget = Category | 'bonus';

/** What each row means, in plain words: "if this comes up, you get this number". */
const RULES: Record<TipTarget, { title: string; score: string }> = {
  ones: { title: 'All the 1s', score: 'Score: 1 for each 1' },
  twos: { title: 'All the 2s', score: 'Score: 2 for each 2' },
  threes: { title: 'All the 3s', score: 'Score: 3 for each 3' },
  fours: { title: 'All the 4s', score: 'Score: 4 for each 4' },
  fives: { title: 'All the 5s', score: 'Score: 5 for each 5' },
  sixes: { title: 'All the 6s', score: 'Score: 6 for each 6' },
  three_of_a_kind: { title: '3 of the same number', score: 'Score: total of all dice' },
  four_of_a_kind: { title: '4 of the same number', score: 'Score: total of all dice' },
  full_house: { title: '3 of one number and 2 of another', score: 'Score: 25' },
  small_straight: { title: 'Sequence of 4', score: 'Score: 30' },
  large_straight: { title: 'Sequence of 5', score: 'Score: 40' },
  yazzy: { title: '5 of the same number', score: 'Score: 50' },
  chance: { title: 'Any dice', score: 'Score: total of all dice' },
  bonus: { title: 'Upper bonus', score: 'Get 63 or more in the top boxes: +35' },
};

interface Props {
  target: TipTarget;
  /** Viewport rectangle of the tapped tile. */
  rect: DOMRect;
  onClose: () => void;
}

/** A speech bubble pointing at the tapped tile, over a dimmed screen. Tap anywhere to dismiss. */
export function RuleTip({ target, rect, onClose }: Props) {
  const bubble = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; arrowX: number; above: boolean } | null>(null);
  const rule = RULES[target];

  useLayoutEffect(() => {
    const el = bubble.current;
    if (!el) return;
    const bw = el.offsetWidth;
    const bh = el.offsetHeight;
    const gap = el.offsetWidth * 0.06 + 6;
    const margin = 8;
    const cx = rect.left + rect.width / 2;
    const above = rect.top - bh - gap >= margin;
    const left = Math.min(Math.max(cx - bw / 2, margin), window.innerWidth - bw - margin);
    setPos({
      left,
      top: above ? rect.top - bh - gap : rect.bottom + gap,
      arrowX: Math.min(Math.max(cx - left, 22), bw - 22),
      above,
    });
  }, [rect, target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="tip-backdrop" onClick={onClose} role="presentation">
      <div
        ref={bubble}
        className="tip"
        role="dialog"
        aria-label={`${rule.title}. ${rule.score}`}
        data-pos={pos?.above === false ? 'below' : 'above'}
        style={{
          left: pos?.left ?? 0,
          top: pos?.top ?? 0,
          visibility: pos ? 'visible' : 'hidden',
          ['--ax' as string]: `${pos?.arrowX ?? 0}px`,
        }}
      >
        <h3>{rule.title}</h3>
        <p>{rule.score}</p>
      </div>
    </div>
  );
}
