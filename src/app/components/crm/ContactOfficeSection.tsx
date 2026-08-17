import type { Company } from "@/app/types";

const CAPTION = "text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5";

/**
 * The apply link is displayed by its slug only (the last path segment), e.g.
 * `https://apply.sbaloan.app/MOCK001-tworld` renders as `MOCK001-tworld`.
 */
function applyLinkLabel(applyLink: string): string {
  return applyLink.replace(/\/+$/, "").split("/").pop() || applyLink;
}

/**
 * Office block on the contact detail — purely presentational, matching
 * frontend-hub PR #1498, which stripped this section back to a read-only view:
 * no office picker, no Assign, no Clear, and only **Name** and **Apply Link**
 * (Brokerage and Office ID are no longer surfaced).
 */
export function ContactOfficeSection({ office }: { office: Company }) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Office
      </p>
      {/* Name takes a third of the row, Apply Link the remaining two thirds. */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className={CAPTION}>Name</p>
          <span className="text-sm">{office.name}</span>
        </div>
        {office.applyLink && (
          <div className="col-span-2">
            <p className={CAPTION}>Apply Link</p>
            <a
              href={office.applyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline break-all"
            >
              {applyLinkLabel(office.applyLink)}
            </a>
          </div>
        )}
      </div>
    </>
  );
}
