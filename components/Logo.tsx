// Brand mark for the Mail Triage dashboard.
// Minimal Apple-app-icon feel: rounded square, warm envelope glyph with a
// mustard "triage" dot. Monochrome-friendly (uses explicit warm tokens).

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="11" fill="#2a2620" />
      <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#lm-g)" fillOpacity="0.5" />
      {/* envelope */}
      <rect x="9" y="12.5" width="22" height="16" rx="3.4" stroke="#faf8f2" strokeWidth="1.9" />
      <path d="M9.8 14.6 L20 22 L30.2 14.6" stroke="#faf8f2" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      {/* triage dot */}
      <circle cx="30.5" cy="11.5" r="5" fill="#c0871f" stroke="#2a2620" strokeWidth="1.6" />
      <defs>
        <linearGradient id="lm-g" x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5b5a31" />
          <stop offset="1" stopColor="#2a2620" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function Wordmark() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7 }}>
      <span style={{ fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
        Mail Triage
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '-0.01em' }}>
        메일 트리아지
      </span>
    </span>
  )
}
