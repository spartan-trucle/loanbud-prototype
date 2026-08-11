import type { WorkflowStep } from "../../types";

/** Strip HTML tags/entities to a single-line plain-text preview. */
function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5 text-xs leading-snug min-w-0">
      <span className="text-muted-foreground/60 flex-shrink-0">{label}</span>
      <span className="text-muted-foreground truncate">{value}</span>
    </div>
  );
}

/**
 * Compact, scannable summary of a workflow step shown under its name on the
 * editor timeline card. Email shows sender / template / subject / a truncated
 * body preview; SMS and call/voicemail show their key fields. Delay and
 * conditional steps render nothing.
 */
export function StepSummary({ step }: { step: WorkflowStep }) {
  if (step.actionType === "email") {
    const body = step.body ? htmlToText(step.body) : "";
    return (
      <div className="flex flex-col gap-0.5 mt-1 min-w-0">
        {step.senderIdentity && <SummaryRow label="From:" value={step.senderIdentity} />}
        {step.templateName && <SummaryRow label="Template:" value={step.templateName} />}
        {step.subject && <SummaryRow label="Subject:" value={step.subject} />}
        {body && (
          <p className="text-xs text-muted-foreground/80 leading-snug line-clamp-2 mt-0.5">{body}</p>
        )}
      </div>
    );
  }

  if (step.actionType === "sms") {
    return (
      <div className="flex flex-col gap-0.5 mt-1 min-w-0">
        {step.smsTemplateName && <SummaryRow label="Template:" value={step.smsTemplateName} />}
        {step.message && (
          <p className="text-xs text-muted-foreground/80 leading-snug line-clamp-2">{step.message}</p>
        )}
      </div>
    );
  }

  if (step.actionType === "call-reminder" || step.actionType === "voicemail-reminder") {
    if (!step.note) return null;
    return <p className="text-xs text-muted-foreground/80 leading-snug line-clamp-2 mt-1 min-w-0">{step.note}</p>;
  }

  return null;
}
