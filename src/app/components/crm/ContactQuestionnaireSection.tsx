import { useState } from "react";
import { ChevronDown, ChevronRight, Settings2 } from "lucide-react";
import { useNavigate } from "react-router";
import { useAppData } from "@/app/contexts/AppDataContext";
import type { Contact } from "@/app/types";

/**
 * Renders whatever fields an admin has turned on — nothing here is hard-coded.
 * A new marketing form can add questions and they appear once someone flips the
 * field to visible in Settings → Custom Fields.
 */
export function ContactQuestionnaireSection({ contact }: { contact: Contact }) {
  const { customFieldDefinitions } = useAppData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  const answers = contact.customFields ?? {};
  const visible = customFieldDefinitions.filter((f) => f.isVisible);
  const hiddenWithAnswers = customFieldDefinitions.filter(
    (f) => !f.isVisible && answers[f.key],
  );

  // Group by section so one contact can carry several questionnaires.
  const sections = [...new Set(visible.map((f) => f.section))];

  if (visible.length === 0 && hiddenWithAnswers.length === 0) return null;

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <h3 className="text-sm font-semibold">Questionnaire</h3>
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {sections.map((section) => {
            const fields = visible.filter((f) => f.section === section);
            const answered = fields.filter((f) => answers[f.key]);

            return (
              <div key={section} className="space-y-2">
                {sections.length > 1 && (
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {section}
                  </p>
                )}
                {answered.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No answers captured for this contact.
                  </p>
                ) : (
                  answered.map((field) => (
                    <div key={field.id} className="flex items-start justify-between gap-3">
                      <span className="text-sm text-muted-foreground">
                        {field.label}
                      </span>
                      <span className="text-sm text-right">{answers[field.key]}</span>
                    </div>
                  ))
                )}
              </div>
            );
          })}

          {hiddenWithAnswers.length > 0 && (
            <button
              onClick={() => navigate("/crm/settings")}
              className="flex items-start gap-2 w-full rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-left"
            >
              <Settings2 className="w-3.5 h-3.5 text-amber-700 mt-0.5 shrink-0" />
              <span className="text-xs text-amber-900">
                {hiddenWithAnswers.length} more answer
                {hiddenWithAnswers.length > 1 ? "s were" : " was"} captured from a form
                but {hiddenWithAnswers.length > 1 ? "are" : "is"} hidden. Turn{" "}
                {hiddenWithAnswers.length > 1 ? "them" : "it"} on in Settings.
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
