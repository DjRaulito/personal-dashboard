/** Maniquí neutro (viewBox 200×500): hombros en y=84, cintura en y=235, tobillos en y=470. */
export function Mannequin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 500" aria-hidden="true" className={className}>
      <g fill="var(--surface-2)" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinejoin="round">
        {/* Brazos */}
        <path d="M58 88 Q40 94 37 120 L29 250 Q29 263 38 263 Q46 263 47 250 L60 132 Z" />
        <path d="M142 88 Q160 94 163 120 L171 250 Q171 263 162 263 Q154 263 153 250 L140 132 Z" />
        {/* Piernas y pies */}
        <ellipse cx="80" cy="486" rx="17" ry="8" />
        <ellipse cx="120" cy="486" rx="17" ry="8" />
        <path d="M60 228 L101 228 L97 470 Q97 481 88 481 L76 481 Q67 481 67 470 Z" />
        <path d="M99 228 L140 228 L133 470 Q133 481 124 481 L112 481 Q103 481 103 470 Z" />
        {/* Cuello, tronco y cabeza */}
        <rect x="90" y="60" width="20" height="26" rx="6" />
        <path d="M62 84 Q100 72 138 84 Q146 88 146 100 L141 236 Q100 246 59 236 L54 100 Q54 88 62 84 Z" />
        <ellipse cx="100" cy="38" rx="22" ry="27" />
      </g>
    </svg>
  );
}
