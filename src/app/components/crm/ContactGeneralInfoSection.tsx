import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useAppData } from "@/app/contexts/AppDataContext";
import {
  displayedQualification,
  formatFicoRange,
} from "@/app/data/leadQualification";
import type { Contact } from "@/app/types";

const CAPTION = "text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5";
const INLINE_SELECT =
  "!border-0 !bg-transparent !shadow-none !px-0 !py-0 !h-auto !ring-0 !ring-offset-0 " +
  "!justify-start !gap-1 text-sm w-full min-w-0 [&>span]:truncate";

const LEAD_TYPES: Contact["userType"][] = [
  "Broker",
  "Lender",
  "Partner",
  "Borrower",
  "Co-Borrower",
];

const OWNERS = ["Andy Officer", "Sarah Manager", "John Lead", "Maria Broker"];

/** Radix rejects an empty option value, so unassigning needs a sentinel of its own. */
const UNASSIGNED = "__unassigned__";

/**
 * The five fields sales acts on, and nothing else.
 *
 * FICO sits here rather than under Inbound Details even though it is, by origin, an
 * answer on a lead form: it is the underwriting cut-off, so it has to be visible
 * next to the phone number rather than three sections down.
 *
 * The value follows the display rule, not the filter rule: an application's checked
 * figure wins, and the band the lead typed into an ad only fills the gap for people
 * who have not applied. The row says which one it is showing, because "660" from
 * underwriting and "660" off a Facebook form are not the same claim.
 */
export function ContactGeneralInfoSection({ contact }: { contact: Contact }) {
  const { handleUpdateContact, applications } = useAppData();
  const [open, setOpen] = useState(true);

  const qualification = displayedQualification(contact, applications);
  const fico = formatFicoRange(qualification.fico);

  return (
    <div className="px-5 py-5 border-b border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full mb-3"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          General Info
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="space-y-4">
          {/* Short fields pair up; only the email, which can run to forty
              characters, still needs the full column. */}
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <p className={CAPTION}>Lead Type</p>
              <Select
                value={contact.userType}
                onValueChange={(v) =>
                  handleUpdateContact(contact.id, {
                    userType: v as Contact["userType"],
                  })
                }
              >
                <SelectTrigger className={INLINE_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0">
              <p className={CAPTION}>Contact owner</p>
              <Select
                value={contact.loanOfficer ?? UNASSIGNED}
                onValueChange={(v) =>
                  handleUpdateContact(contact.id, {
                    loanOfficer: v === UNASSIGNED ? undefined : v,
                  })
                }
              >
                <SelectTrigger className={`${INLINE_SELECT} text-primary font-medium`}>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {/* Replaces the old "Clear" button — at a third of the column
                      there is no room for a control beside the caption. */}
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {OWNERS.map((owner) => (
                    <SelectItem key={owner} value={owner}>
                      {owner}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <p className={CAPTION}>Email</p>
            <span className="text-sm break-all">{contact.email}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={CAPTION}>Phone Number</p>
              <span className="text-sm text-primary">{contact.phone || "—"}</span>
            </div>

            <div>
              <p className={CAPTION}>FICO Score</p>
              {fico ? (
                <>
                  <span className="text-sm">{fico}</span>
                  <p className="text-[10px] text-muted-foreground">
                    {qualification.ficoSource === "application"
                      ? "From application"
                      : "Self-reported"}
                  </p>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Not answered</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
