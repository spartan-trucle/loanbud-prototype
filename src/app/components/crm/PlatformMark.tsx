/**
 * Platform marks, drawn inline.
 *
 * Inline SVG rather than image files: these render at four sizes across three levels
 * of the Lead syncing screen, and a stroked path stays crisp at every one of them
 * without shipping an asset per platform. The second platform slots in beside Meta
 * here — the grouping already expects one.
 */
export function PlatformMark({
  platform,
  className = "w-5 h-5",
}: {
  platform: string;
  className?: string;
}) {
  if (platform === "meta") {
    return (
      <svg
        viewBox="0 0 36 24"
        className={className}
        fill="none"
        aria-hidden="true"
        role="img"
      >
        {/* Meta's double loop, as two mirrored arcs. */}
        <path
          d="M2.5 15.5c0-6 3-11 7-11 3.2 0 5.2 2.8 7 6.4l2 4c1.8 3.6 3.3 5.6 5.6 5.6 3 0 4.4-3 4.4-7s-1.6-7-4.4-7c-2.3 0-4.2 1.8-6.1 4.6"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M2.5 15.5c0 3.6 1.6 5 3.6 5 2.3 0 4-1.8 6.1-5.2"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <span
      className={`${className} inline-flex items-center justify-center rounded bg-muted text-[9px] font-semibold uppercase text-muted-foreground`}
    >
      {platform.slice(0, 2)}
    </span>
  );
}

/** Green when syncing, grey when paused. The dot carries the state, the text the time. */
export function SyncDot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${
        active ? "bg-emerald-500" : "bg-muted-foreground/40"
      }`}
    />
  );
}
