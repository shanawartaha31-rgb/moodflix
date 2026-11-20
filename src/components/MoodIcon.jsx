/**
 * Hand-drawn style mood illustrations (original SVGs).
 * They're still by default and animate when their tile is hovered, focused or selected
 * (see the .mi-* rules in styles.css). Colour comes from currentColor (the mood colour).
 */
const ICONS = {
  happy: (
    <>
      <g className="mi-rays">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line key={a} x1="24" y1="7" x2="24" y2="11.5" transform={`rotate(${a} 24 24)`} />
        ))}
      </g>
      <circle className="mi-sun" cx="24" cy="24" r="9" fill="currentColor" fillOpacity="0.22" />
      <circle cx="20.8" cy="22" r="1" fill="currentColor" stroke="none" />
      <circle cx="27.2" cy="22" r="1" fill="currentColor" stroke="none" />
      <path d="M20 25.8q4 3.6 8 0" />
    </>
  ),
  down: (
    <>
      <path className="mi-steam s1" d="M19 17c-2-2.5 2-3.5 0-6.5" />
      <path className="mi-steam s2" d="M24 17c-2-2.5 2-3.5 0-6.5" />
      <path className="mi-steam s3" d="M29 17c-2-2.5 2-3.5 0-6.5" />
      <path d="M12 21h22v9a9 9 0 0 1-9 9h-4a9 9 0 0 1-9-9z" fill="currentColor" fillOpacity="0.22" />
      <path d="M34 24h2.5a4.5 4.5 0 0 1 0 9H33" />
      <path d="M17 29.5q1.5 1.5 3 0M26 29.5q1.5 1.5 3 0" />
    </>
  ),
  cry: (
    <>
      <path d="M15 29a7 7 0 0 1 .8-13.9A9.5 9.5 0 0 1 33.6 16 6.5 6.5 0 0 1 33 29z" fill="currentColor" fillOpacity="0.22" />
      <path className="mi-drop d1" d="M18 33.5v4" />
      <path className="mi-drop d2" d="M24 33.5v4" />
      <path className="mi-drop d3" d="M30 33.5v4" />
    </>
  ),
  pumped: (
    <>
      <path className="mi-speed l1" d="M5 17h7" />
      <path className="mi-speed l2" d="M3 24h8" />
      <path className="mi-speed l3" d="M6 31h6" />
      <path className="mi-bolt" d="M28 5 15 26h9l-3 17 14-22h-9z" fill="currentColor" fillOpacity="0.3" />
    </>
  ),
  spooky: (
    <g className="mi-ghost">
      <path d="M14 41V22a10 10 0 0 1 20 0v19l-3.3-3-3.4 3-3.3-3-3.3 3-3.4-3z" fill="currentColor" fillOpacity="0.22" />
      <g className="mi-eyes">
        <ellipse cx="20.5" cy="23" rx="1.6" ry="2.4" fill="currentColor" stroke="none" />
        <ellipse cx="27.5" cy="23" rx="1.6" ry="2.4" fill="currentColor" stroke="none" />
      </g>
      <ellipse cx="24" cy="29.5" rx="1.6" ry="2" />
    </g>
  ),
  curious: (
    <>
      <g className="mi-atom">
        <ellipse cx="24" cy="24" rx="17" ry="6.5" />
        <ellipse cx="24" cy="24" rx="17" ry="6.5" transform="rotate(60 24 24)" />
        <ellipse cx="24" cy="24" rx="17" ry="6.5" transform="rotate(120 24 24)" />
      </g>
      <circle cx="24" cy="24" r="3.2" fill="currentColor" stroke="none" />
    </>
  ),
  romantic: (
    <>
      <path className="mi-heart-mini" d="M35 13.5s-3.5-2.2-3.5-4.7a1.9 1.9 0 0 1 3.5-1 1.9 1.9 0 0 1 3.5 1c0 2.5-3.5 4.7-3.5 4.7z" fill="currentColor" fillOpacity="0.4" />
      <path className="mi-heart" d="M24 39s-13-8-13-17.2a7 7 0 0 1 13-3.8 7 7 0 0 1 13 3.8C37 31 24 39 24 39z" fill="currentColor" fillOpacity="0.25" />
    </>
  ),
  chill: (
    <>
      <path className="mi-moon" d="M27 11a14 14 0 1 0 10 23.5A12 12 0 0 1 27 11z" fill="currentColor" fillOpacity="0.22" />
      <path className="mi-z z1" d="M31 16h4l-4 4h4" />
      <path className="mi-z z2" d="M37 9h3l-3 3h3" />
    </>
  ),
  surprise: (
    <g className="mi-die">
      <rect x="11" y="11" width="26" height="26" rx="6" fill="currentColor" fillOpacity="0.22" />
      {[[17.5, 17.5], [30.5, 17.5], [24, 24], [17.5, 30.5], [30.5, 30.5]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2" fill="currentColor" stroke="none" />
      ))}
    </g>
  ),
};

export default function MoodIcon({ mood, size = 48, className = '' }) {
  const icon = ICONS[mood];
  if (!icon) return null;
  return (
    <svg
      className={`mi mi-${mood} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {icon}
    </svg>
  );
}
