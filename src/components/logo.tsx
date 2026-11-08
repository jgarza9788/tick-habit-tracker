/** The Tick mascot (matches public/tick.svg), drawn with theme colors so it works in light and dark. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <g transform="translate(256 256) scale(0.373) translate(-600 -650)">
        <g fill="none" stroke="currentColor" strokeWidth="100" strokeLinecap="round" strokeLinejoin="round">
          <path d="M200 200 C200 270 240 320 295 340 L520 420" />
          <path d="M100 435 C170 480 250 505 330 512 L470 525" />
          <path d="M100 650 L420 650" />
          <path d="M390 765 C280 790 200 870 200 960 C200 1020 210 1060 220 1100" />
          <path d="M1000 200 C1000 270 960 320 905 340 L680 420" />
          <path d="M1100 435 C1030 480 950 505 870 512 L730 525" />
          <path d="M1100 650 L780 650" />
          <path d="M810 765 C920 790 1000 870 1000 960 C1000 1020 990 1060 980 1100" />
          <path d="M500 200 C500 280 530 350 600 400 C670 350 700 280 700 200" />
        </g>
        <ellipse cx="600" cy="420" rx="110" ry="90" fill="currentColor" />
        <ellipse cx="600" cy="710" rx="262" ry="290" fill="currentColor" />
        <path
          d="M470 720 L570 820 L740 620"
          fill="none"
          stroke="var(--background)"
          strokeWidth="90"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}
