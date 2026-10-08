import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Cube, orientOf, pose, prefersReducedMotion } from './Cube';
import type { LastMove } from '../types';

/** Total time before the score number is revealed. Keep in sync with the animation below. */
export const FLIGHT_MS = 1100;
const DURATION = 760;
const STAGGER = 70;

interface Flight {
  left: number;
  top: number;
  size: number;
  dx: number;
  dy: number;
}

/**
 * The scored dice leave the tray, tumble across the board and shrink into the chosen box.
 * Positions are read from the DOM so it works at any screen size.
 */
export function FlyingDice({ move }: { move: LastMove }) {
  const layer = useRef<HTMLDivElement>(null);
  const [flights, setFlights] = useState<Flight[]>([]);

  useLayoutEffect(() => {
    const target = document.querySelector<HTMLElement>(`[data-cell="${move.playerId}:${move.category}"]`);
    const slots = Array.from({ length: 5 }, (_, i) => document.querySelector<HTMLElement>(`[data-slot="${i}"]`));
    if (!target || slots.some((s) => !s)) return;
    const t = target.getBoundingClientRect();
    const tx = t.left + t.width / 2;
    const ty = t.top + t.height / 2;
    setFlights(
      slots.map((el) => {
        const r = el!.getBoundingClientRect();
        return {
          left: r.left,
          top: r.top,
          size: r.width,
          dx: tx - (r.left + r.width / 2),
          dy: ty - (r.top + r.height / 2),
        };
      }),
    );
  }, [move]);

  useEffect(() => {
    if (!flights.length || prefersReducedMotion() || !layer.current) return;
    const anims: Animation[] = [];
    layer.current.querySelectorAll<HTMLElement>('.fly-die').forEach((el, i) => {
      const f = flights[i];
      const k = f.size / 65.7;
      const wobble = (Math.random() - 0.5) * 90 * k;
      const lift = (60 + Math.random() * 70) * k;
      const timing = { duration: DURATION, delay: i * STAGGER, fill: 'both' as const };

      anims.push(
        el.animate(
          [
            { transform: 'translate(0px,0px) scale(1)', opacity: 1, offset: 0 },
            { transform: `translate(${f.dx * 0.45 + wobble}px,${f.dy * 0.45 - lift}px) scale(1.4)`, opacity: 1, offset: 0.45 },
            { transform: `translate(${f.dx}px,${f.dy}px) scale(0.32)`, opacity: 1, offset: 0.9 },
            { transform: `translate(${f.dx}px,${f.dy}px) scale(0.2)`, opacity: 0, offset: 1 },
          ],
          { ...timing, easing: 'cubic-bezier(.45,.05,.55,.95)' },
        ),
      );

      const cube = el.querySelector<HTMLElement>('.cube');
      if (cube) {
        const [rx, ry] = orientOf(move.dice[i]);
        anims.push(
          cube.animate(
            [
              { transform: pose(move.dice[i]) },
              {
                transform: `rotateX(${rx + 360 + 180 * (i % 2)}deg) rotateY(${ry + 300 + 70 * i}deg) rotateZ(${90 + 35 * i}deg)`,
              },
            ],
            { ...timing, easing: 'linear' },
          ),
        );
      }
    });
    return () => anims.forEach((a) => a.cancel());
  }, [flights, move]);

  return (
    <div ref={layer} className="fly-layer" aria-hidden="true">
      {flights.map((f, i) => (
        <div
          key={i}
          className="fly-die"
          style={{ left: f.left, top: f.top, width: f.size, height: f.size, ['--s' as string]: `${f.size}px` } as CSSProperties}
        >
          <div className="cube-wrap">
            <Cube value={move.dice[i]} />
          </div>
        </div>
      ))}
    </div>
  );
}
