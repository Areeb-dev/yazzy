import { CATEGORY_LABELS, type Category } from '@game/types';
import { PIPS } from './Cube';

const FACE_VALUE: Partial<Record<Category, number>> = {
  ones: 1,
  twos: 2,
  threes: 3,
  fours: 4,
  fives: 5,
  sixes: 6,
};

function Cards({ outlined, label }: { outlined: number; label: string }) {
  return (
    <div className="cards">
      <svg viewBox="0 0 44 30" aria-hidden="true">
        {Array.from({ length: outlined }, (_, i) => (
          <rect
            key={i}
            x={5 + i * 4}
            y={4}
            width={9}
            height={22}
            rx={2.5}
            fill="#fff"
            stroke="#1e3a5f"
            strokeWidth={2.4}
            transform={`rotate(${-28 + i * 9} ${10 + i * 4} 26)`}
          />
        ))}
        <rect x={22} y={3} width={15} height={21} rx={3} fill="#1e3a5f" transform="rotate(14 29 24)" />
      </svg>
      <span>{label}</span>
    </div>
  );
}

/** The white icon tile at the start of every board row. Tap it to see how the box scores. */
export function CategoryTile({
  category,
  onInfo,
}: {
  category: Category;
  onInfo: (category: Category, rect: DOMRect) => void;
}) {
  const face = FACE_VALUE[category];
  let content;
  if (face) {
    content = (
      <div className="mini" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (PIPS[face].includes(i) ? <i key={i} /> : <span key={i} />))}
      </div>
    );
  } else {
    switch (category) {
      case 'three_of_a_kind':
        content = <span aria-hidden="true">3x</span>;
        break;
      case 'four_of_a_kind':
        content = <span aria-hidden="true">4x</span>;
        break;
      case 'full_house':
        content = (
          <svg className="tile-house" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 4 L3 15.5 H7 V27 H25 V15.5 H29 Z" fill="#1e3a5f" stroke="#1e3a5f" strokeWidth={2.4} strokeLinejoin="round" />
            <rect x={13} y={18} width={6} height={9} rx={1} fill="#fff" />
          </svg>
        );
        break;
      case 'small_straight':
        content = <Cards outlined={3} label="SMALL" />;
        break;
      case 'large_straight':
        content = <Cards outlined={4} label="LARGE" />;
        break;
      case 'yazzy':
        content = (
          <svg className="tile-yazzy" viewBox="0 0 32 32" aria-hidden="true">
            <path
              d="M6 12 L10 8 L16 11 L22 8 L26 12 L23 14 L24 24 H8 L9 14 Z"
              fill="#FFD54A"
              stroke="#1E3A5F"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <rect x="10" y="24" width="12" height="3" rx="1.2" fill="#1E3A5F" />
          </svg>
        );
        break;
      default:
        content = <span aria-hidden="true">?</span>;
    }
  }
  return (
    <button
      type="button"
      className="tile"
      aria-label={`${CATEGORY_LABELS[category]}: show rules`}
      onClick={(e) => onInfo(category, e.currentTarget.getBoundingClientRect())}
    >
      {content}
    </button>
  );
}
