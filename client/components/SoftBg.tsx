import { useEffect, useState } from 'react';
import { Cube } from './Cube';

const randomFaces = () => Array.from({ length: 5 }, () => 1 + Math.floor(Math.random() * 6));

/** Soft lavender stage with floating decorative dice (visual only). */
export function SoftBg({ interactive = false }: { interactive?: boolean }) {
  const [faces, setFaces] = useState([6, 5, 4, 3, 2]);
  const [spin, setSpin] = useState(0);
  useEffect(() => setSpin(1), []);

  const tumble = () => {
    if (!interactive) return;
    setFaces(randomFaces());
    setSpin((s) => s + 1);
  };

  return (
    <div className="soft-bg" aria-hidden="true">
      <i className="soft-star s1" />
      <i className="soft-star s2" />
      <i className="soft-star s3" />
      <i className="soft-blob b1" />
      <i className="soft-blob b2" />
      {faces.slice(0, 3).map((v, i) => (
        <button
          key={i}
          type="button"
          className={`soft-die d${i + 1}`}
          onClick={tumble}
          tabIndex={interactive ? 0 : -1}
          disabled={!interactive}
          aria-label={interactive ? 'Tumble the dice' : undefined}
        >
          <span className="cube-wrap">
            <Cube value={v} spinKey={spin} />
          </span>
        </button>
      ))}
    </div>
  );
}
