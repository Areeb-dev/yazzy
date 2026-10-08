/** Brand mark matching the soft-UI mockup: yellow bubble letters + crown. */
export function Logo({ className = 'logo' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 300 110" role="img" aria-label="Yazzy">
      <defs>
        <filter id="logo-soft" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#1e3a5f" floodOpacity="0.25" />
        </filter>
      </defs>
      <g filter="url(#logo-soft)">
        <path
          d="M148 8 L156 22 L172 20 L162 32 L168 48 L148 38 L128 48 L134 32 L124 20 L140 22 Z"
          fill="#FFD54A"
          stroke="#1E3A5F"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <text
          x={150}
          y={92}
          textAnchor="middle"
          fontFamily="'Lilita One','Baloo 2',sans-serif"
          fontSize={82}
          fill="#FFD54A"
          stroke="#1E3A5F"
          strokeWidth={9}
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          YAZZY
        </text>
      </g>
    </svg>
  );
}
