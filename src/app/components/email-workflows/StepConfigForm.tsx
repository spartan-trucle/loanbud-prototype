/* eslint-disable react-refresh/only-export-components */
import { Mail, MessageSquare, Phone, Clock, Voicemail } from "lucide-react";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useAppData } from "../../contexts/AppDataContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionType = "email" | "sms" | "call-reminder" | "voicemail-reminder";

export interface StepDraft {
  name: string;
  actionType: ActionType;
  templateId?: string;
  templateName?: string;
  senderIdentity?: string;
  subject?: string;
  body?: string;
  smsTemplateId?: string;
  smsTemplateName?: string;
  message?: string;
  note?: string;
  reminderDaysBefore?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const STEP_DEFAULTS: Record<ActionType | "delay", string> = {
  email: "Send Email Step",
  sms: "Send SMS Step",
  "call-reminder": "Call Reminder Step",
  "voicemail-reminder": "Voicemail Reminder Step",
  delay: "Wait",
};

export const TYPE_OPTIONS: { value: ActionType; label: string }[] = [
  { value: "email", label: "Send Email" },
  { value: "sms", label: "Send SMS" },
  { value: "call-reminder", label: "Call Reminder" },
];

export const TYPE_ICON_STYLE: Record<ActionType | "delay", string> = {
  email: "border-blue-400 text-blue-600",
  sms: "border-violet-400 text-violet-600",
  "call-reminder": "border-amber-400 text-amber-600",
  "voicemail-reminder": "border-teal-400 text-teal-600",
  delay: "border-border text-muted-foreground",
};

export const TYPE_ICON_BG: Record<ActionType | "delay", string> = {
  email: "bg-blue-100 text-blue-600",
  sms: "bg-violet-100 text-violet-600",
  "call-reminder": "bg-amber-100 text-amber-600",
  "voicemail-reminder": "bg-teal-100 text-teal-600",
  delay: "bg-muted text-muted-foreground",
};

export const TYPE_HOVER_STYLE: Record<ActionType | "delay", string> = {
  email: "hover:border-blue-300 hover:bg-blue-50/40",
  sms: "hover:border-violet-300 hover:bg-violet-50/40",
  "call-reminder": "hover:border-amber-300 hover:bg-amber-50/40",
  "voicemail-reminder": "hover:border-teal-300 hover:bg-teal-50/40",
  delay: "hover:border-border hover:bg-muted/40",
};

export const TYPE_BADGE_STYLE: Record<ActionType | "delay", string> = {
  email: "bg-blue-50 text-blue-700 border border-blue-200",
  sms: "bg-violet-50 text-violet-700 border border-violet-200",
  "call-reminder": "bg-amber-50 text-amber-700 border border-amber-200",
  "voicemail-reminder": "bg-teal-50 text-teal-700 border border-teal-200",
  delay: "bg-muted text-muted-foreground border border-border",
};

// ─── StepTypeIcon ─────────────────────────────────────────────────────────────

export function StepTypeIcon({ type, size = "md" }: { type: ActionType | "delay"; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  if (type === "email") return <Mail className={cls} />;
  if (type === "sms") return <MessageSquare className={cls} />;
  if (type === "delay") return <Clock className={cls} />;
  if (type === "voicemail-reminder") return <Voicemail className={cls} />;
  return <Phone className={cls} />;
}

// ─── FieldLabel ───────────────────────────────────────────────────────────────

export function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-sm font-medium text-foreground mb-1.5 block">
      {children}
      {required && <span className="text-destructive ml-1">*</span>}
    </label>
  );
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{children}</p>;
}

// ─── EmailPreview ─────────────────────────────────────────────────────────────

export function EmailPreview({ subject, body }: { subject: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-muted/40 flex items-center gap-2">
        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preview</span>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <span className="text-xs font-medium text-muted-foreground">Subject</span>
          <p className="text-sm font-medium text-foreground mt-0.5">{subject}</p>
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground">Body</span>
          <div className="prose prose-sm max-w-none text-sm text-foreground mt-0.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: body }} />
        </div>
      </div>
    </div>
  );
}

// ─── SmsPreview ───────────────────────────────────────────────────────────────

export function SmsPreview({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-muted/40 flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preview</span>
      </div>
      <div className="p-4">
        <div className="inline-block max-w-xs bg-primary text-primary-foreground rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed">
          {message}
        </div>
      </div>
    </div>
  );
}

// ─── StepConfigLeft ───────────────────────────────────────────────────────────

export function StepConfigLeft({
  draft,
  onChange,
}: {
  draft: StepDraft;
  onChange: (patch: Partial<StepDraft>) => void;
}) {
  const { senderIdentities } = useAppData();

  return (
    <div className="space-y-5">
      {/* Sender Identity (email only) */}
      {draft.actionType === "email" && (
        <div>
          <FieldLabel>Sender Identity</FieldLabel>
          <Select
            value={draft.senderIdentity ?? ""}
            onValueChange={(v) => onChange({ senderIdentity: v })}
          >
            <SelectTrigger className="w-full border-gray-200">
              <SelectValue placeholder="— Select identity —" />
            </SelectTrigger>
            <SelectContent>
              {senderIdentities.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.displayName} ({s.emailAddress})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Call reminder timing */}
      {draft.actionType === "call-reminder" && (
        <div>
          <FieldLabel>Remind Before</FieldLabel>
          <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 w-fit">
            <button
              type="button"
              onClick={() => onChange({ reminderDaysBefore: Math.max(0, (draft.reminderDaysBefore ?? 1) - 1) })}
              className="w-6 h-6 flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted font-bold text-sm leading-none"
            >−</button>
            <Input
              type="number"
              min={0}
              value={draft.reminderDaysBefore ?? 1}
              onChange={(e) => onChange({ reminderDaysBefore: Math.max(0, Number(e.target.value)) })}
              className="w-10 text-center border-0 shadow-none p-0 h-auto font-semibold focus-visible:ring-0"
            />
            <button
              type="button"
              onClick={() => onChange({ reminderDaysBefore: (draft.reminderDaysBefore ?? 1) + 1 })}
              className="w-6 h-6 flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted font-bold text-sm leading-none"
            >+</button>
            <span className="text-sm text-muted-foreground pl-1">day(s) before scheduled date</span>
          </div>
        </div>
      )}

      {/* Note / Script — hidden for call-reminder (shown on right panel) */}
      {draft.actionType !== "call-reminder" && (
        <div>
          <FieldLabel>Note / Script</FieldLabel>
          <Textarea
            value={draft.note ?? ""}
            onChange={(e) => onChange({ note: e.target.value })}
            placeholder="Agent notes or message content..."
            rows={4}
            className="border-gray-200"
          />
        </div>
      )}
    </div>
  );
}

// ─── StepConfigRight ──────────────────────────────────────────────────────────

export function StepConfigRight({
  draft,
  onChange,
}: {
  draft: StepDraft;
  onChange: (patch: Partial<StepDraft>) => void;
}) {
  const { adminEmailTemplates, smsTemplates } = useAppData();

  const selectedEmailTpl = adminEmailTemplates.find((t) => t.id === draft.templateId);
  const selectedSmsTpl = smsTemplates.find((t) => t.id === draft.smsTemplateId);

  // Manual-send pickers exclude system templates from new selections, but an
  // already-selected system template (from a prior save) must still render
  // its name in the dropdown instead of going blank.
  const selectableEmailTemplates = adminEmailTemplates.filter((t) => !t.isSystem);
  const emailTemplateOptions =
    selectedEmailTpl?.isSystem && !selectableEmailTemplates.some((t) => t.id === selectedEmailTpl.id)
      ? [selectedEmailTpl, ...selectableEmailTemplates]
      : selectableEmailTemplates;

  if (draft.actionType === "email") {
    return (
      <div className="space-y-4">
        <div>
          <FieldLabel>Email Template</FieldLabel>
          <Select
            value={draft.templateId ?? ""}
            onValueChange={(v) => {
              const tpl = adminEmailTemplates.find((t) => t.id === v);
              const nextSubject = tpl?.subject ?? draft.subject;
              const nextBody = tpl?.body ?? draft.body;
              onChange({
                templateId: v,
                templateName: tpl?.name ?? "",
                subject: nextSubject,
                body: nextBody,
              });
            }}
          >
            <SelectTrigger className="w-full border-gray-200">
              <SelectValue placeholder="— Select a template —" />
            </SelectTrigger>
            <SelectContent>
              {emailTemplateOptions.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedEmailTpl ? (
          <EmailPreview subject={selectedEmailTpl.subject} body={selectedEmailTpl.body} />
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center py-10 text-center gap-2">
            <Mail className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Select a template to preview</p>
          </div>
        )}
      </div>
    );
  }

  if (draft.actionType === "sms") {
    return (
      <div className="space-y-4">
        <div>
          <FieldLabel>SMS Template</FieldLabel>
          <Select
            value={draft.smsTemplateId ?? ""}
            onValueChange={(v) => {
              const tpl = smsTemplates.find((t) => t.id === v);
              const nextMessage = tpl?.message ?? draft.message;
              onChange({
                smsTemplateId: v,
                smsTemplateName: tpl?.name ?? "",
                message: nextMessage,
              });
            }}
          >
            <SelectTrigger className="w-full border-gray-200">
              <SelectValue placeholder="— Select a template —" />
            </SelectTrigger>
            <SelectContent>
              {smsTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedSmsTpl ? (
          <SmsPreview message={selectedSmsTpl.message} />
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center py-10 text-center gap-2">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Select a template to preview</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Call Objective</FieldLabel>
        <Textarea
          value={draft.note ?? ""}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="Describe the goal of this call — what to say, ask, or follow up on…"
          rows={6}
          className="border-gray-200"
        />
      </div>
    </div>
  );
}

// ─── StepConfigFields (kept for backwards compat) ─────────────────────────────

export function StepConfigFields({
  draft,
  onChange,
}: {
  draft: StepDraft;
  onChange: (patch: Partial<StepDraft>) => void;
}) {
  return (
    <div className="grid divide-x divide-border" style={{ gridTemplateColumns: '2fr 3fr' }}>
      <div className="pr-6 min-w-0">
        <StepConfigLeft draft={draft} onChange={onChange} />
      </div>
      <div className="pl-6 min-w-0">
        <StepConfigRight draft={draft} onChange={onChange} />
      </div>
    </div>
  );
}
