// Inline SVG mark for Rolle Management Group.
// A square monolith with a single horizontal "channel" — read as
// "build the channel" / category leadership. Monochrome, currentColor.
export default function Logo({ size = 26 }: { size?: number }) {
  return (
    <span className="m-logo" aria-label="Rolle Management Group home">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="26" height="26" stroke="currentColor" strokeWidth="2" />
        <rect x="9" y="14" width="14" height="4" fill="currentColor" />
        <rect x="9" y="9" width="4" height="3" fill="currentColor" />
      </svg>
      <span>Rolle Management Group</span>
    </span>
  );
}
