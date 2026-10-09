import { memo, useLayoutEffect, useRef, type CSSProperties } from 'react';

export const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** [rotateX, rotateY] that turns the cube so the given value faces the player. */
const ORIENT: Record<number, [number, number]> = {
  0: [0, 0],
  1: [0, 0],
  2: [-90, 0],
  3: [0, -90],
  4: [0, 90],
  5: [90, 0],
  6: [0, 180],
};

// Opposite faces add up to 7, like a real die.
const FACES = [
  { v: 1, t: 'rotateY(0deg)', f1: '#ffffff', f2: '#eef0f4' },
  { v: 6, t: 'rotateY(180deg)', f1: '#eceff3', f2: '#dde1e8' },
  { v: 3, t: 'rotateY(90deg)', f1: '#f1f3f7', f2: '#e1e5eb' },
  { v: 4, t: 'rotateY(-90deg)', f1: '#e8ebf0', f2: '#d6dae2' },
  { v: 2, t: 'rotateX(90deg)', f1: '#ffffff', f2: '#f3f5f8' },
  { v: 5, t: 'rotateX(-90deg)', f1: '#d9dde4', f2: '#c6ccd5' },
] as const;

export const pose = (value: number): string => {
  const [rx, ry] = ORIENT[value] ?? [0, 0];
  return `rotateX(${rx}deg) rotateY(${ry}deg)`;
};
export const orientOf = (value: number): [number, number] => ORIENT[value] ?? [0, 0];

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

interface CubeProps {
  /** Face to show once settled (the server's value). */
  value: number;
  /** Change this to tumble the cube and land on `value`. */
  spinKey?: number;
  style?: CSSProperties;
}

/**
 * A CSS 3D die. Size comes from the `--s` custom property of the nearest `.cube-wrap`.
 * The tumble is purely visual: it always lands on the value it was given.
 */
function CubeInner({ value, spinKey = 0, style }: CubeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef(spinKey);
  const [rx, ry] = orientOf(value);

  useLayoutEffect(() => {
    if (spinKey === seen.current) return;
    seen.current = spinKey;
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const spinsX = 360 * (1 + Math.floor(Math.random() * 2));
    const spinsY = 360 * (1 + Math.floor(Math.random() * 2));
    const tilt = 20 + Math.random() * 40;
    const anim = el.animate(
      [
        { transform: `rotateX(${rx + spinsX}deg) rotateY(${ry - spinsY}deg) rotateZ(${tilt}deg)` },
        { transform: `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(0deg)` },
      ],
      { duration: 640, easing: 'cubic-bezier(.18,.7,.25,1)' },
    );
    return () => anim.cancel();
  }, [spinKey, rx, ry]);

  return (
    <div className="cube" ref={ref} style={{ transform: pose(value), ...style }}>
      {FACES.map((f) => (
        <div
          key={f.v}
          className="face"
          style={{ transform: `${f.t} translateZ(var(--half))`, ['--f1' as string]: f.f1, ['--f2' as string]: f.f2 }}
        >
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} style={{ display: 'contents' }}>
              {PIPS[f.v].includes(i) ? <i /> : <b style={{ display: 'block' }} />}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export const Cube = memo(CubeInner, (a, b) => a.value === b.value && a.spinKey === b.spinKey);
