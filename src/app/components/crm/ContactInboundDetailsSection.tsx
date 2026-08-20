import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Info } from "lucide-react";
import { useAppData } from "@/app/contexts/AppDataContext";
import { activeFields } from "@/app/data/customFieldUsage";
import {
  inboundAnswers,
  inboundSectionTitle,
  leadFormById,
} from "@/app/data/leadFormUtils";
import type { Contact } from "@/app/types";

/**
 * What the form asked, and what this lead answered.
 *
 * Labels are the platform's own question text, not the CRM field label: the section
 * is about the form, and two forms can ask for the same field in different words.
 * Questions the lead skipped stay visible as "Not answered" — the form having asked
 * is itself information.
 *
 * Gated on the contact having answered a form, not on their lead source: most leads
 * that filled a form did not arrive through a channel the CRM can see, so gating on
 * paid-social would hide the majority of the answers we hold.
 *
 * The form comes from the ANSWER rows, not from the contact. Somebody who answered
 * two forms has each answer labelled with the wording of the form it came from — a
 * single form id on the person would mislabel half of them.
 */
export function ContactInboundDetailsSection({ contact }: { contact: Contact }) {
  const { leadForms, customFieldDefinitions, contactLeadAnswers } = useAppData();
  const [open, setOpen] = useState(true);

  const answeredFormId = contactLeadAnswers.find(
    (a) => a.contactId === contact.id && a.leadFormId,
  )?.leadFormId;
  const form = leadFormById(leadForms, answeredFormId);
  if (!form) return null;

  // Archived fields are hidden here as everywhere else — the answer is kept, the row
  // is not shown until someone restores the field.
  const live = new Map(
    activeFields(customFieldDefinitions).map((f) => [f.key, f]),
  );
  const rows = inboundAnswers(contact, form, contactLeadAnswers).filter(
    (row) => !row.customFieldKey || live.has(row.customFieldKey),
  );

  return (
    <div className="px-5 py-5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full gap-2 mb-3"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-left">
          {inboundSectionTitle(form)}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div>
          <p className="text-xs text-muted-foreground mb-3">{form.name}</p>

          <div className="space-y-3">
            {rows.map((row) => {
              const definition = live.get(row.customFieldKey);
              return (
              <div key={row.externalKey}>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {row.question}
                  {definition?.description && (
                    <span title={definition.description}>
                      <Info className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                    </span>
                  )}
                </p>
                {row.answer ? (
                  <p className="text-sm mt-0.5">{row.answer}</p>
                ) : (
                  <p className="text-sm mt-0.5 text-muted-foreground/70">
                    Not answered
                  </p>
                )}
              </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
