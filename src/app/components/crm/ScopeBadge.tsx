/**
 * The prototype deliberately shows more than the first release delivers, so a screen
 * that is designed but not yet scheduled has to say so on itself. Without this an
 * engineer opens the prototype, sees every screen, and builds all of them at once —
 * which is the failure this marker exists to prevent, not the file's existence.
 */
const TONE = {
  2: "bg-blue-50 text-blue-700 border-blue-200",
  3: "bg-amber-50 text-amber-800 border-amber-200",
  4: "bg-gray-100 text-gray-600 border-gray-200",
} as const;

export type Wave = keyof typeof TONE;

export function ScopeBadge({ wave }: { wave: Wave }) {
  return (
    <span
      className={`ml-1.5 rounded border px-1 py-px text-[10px] font-medium leading-none ${TONE[wave]}`}
    >
      W{wave}
    </span>
  );
}

export function ScopeBanner({ wave, children }: { wave: Wave; children: React.ReactNode }) {
  return (
    <div className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${TONE[wave]}`}>
      <span className="font-semibold">Wave {wave} — not in the first release.</span>{" "}
      {children}
    </div>
  );
}
