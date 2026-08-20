import { Link } from "react-router";
import {
  Layers,
  Workflow as WorkflowIcon,
  AlertCircle,
  PhoneOff,
  Clock,
  PhoneCall,
  CheckCircle2,
  Mail,
  MessageSquare,
  UserPlus,
  Pause,
  Play,
  ArrowRightLeft,
  Info,
  ChevronRight,
} from "lucide-react";
import type { Contact } from "@/app/types";
import { useAppData } from "@/app/contexts/AppDataContext";
import { getContactSegments } from "@/app/lib/segmentUtils";
import { getContactWorkflowContexts } from "@/app/lib/workflowContextUtils";

interface ContactContextPanelProps {
  contact: Contact;
}

const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-100 text-blue-700",
  Draft: "bg-yellow-100 text-yellow-700",
  Submitted: "bg-purple-100 text-purple-700",
  "On Hold": "bg-orange-100 text-orange-700",
  Declined: "bg-red-100 text-red-700",
};

function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

interface MiniTimelineEntry {
  id: string;
  ts: Date;
  icon: React.ElementType;
  iconClass: string;
  label: string;
  sub?: string;
}

/**
 * RFC-008 (story -01): the LO's "who am I calling and what do I say" panel, shown
 * inside the task drawer under V2 — segments, workflow position (with a MANUAL_TASK
 * "Action required" badge), and a recent timeline. Read-only; travels with the task
 * so a reassigned task is self-explanatory.
 */
export function ContactContextPanel({ contact }: ContactContextPanelProps) {
  const { segments, workflowEnrollments, workflows, contactActivity, emailHistory, applications } =
    useAppData();

  const contactSegments = getContactSegments(contact, segments, applications);
  const workflowContexts = getContactWorkflowContexts(contact.id, workflowEnrollments, workflows);

  // ── Recent timeline (activity + comms), newest first — scrollable in the panel ─
  const activityEntries: MiniTimelineEntry[] = contactActivity
    .filter((a) => a.contactId === contact.id)
    .map((a) => {
      const isCall = a.type === "task_completed" && a.taskType === "Call";
      let icon: React.ElementType = Clock;
      let iconClass = "bg-muted text-muted-foreground";
      if (isCall) { icon = PhoneCall; iconClass = "bg-green-100 text-green-600"; }
      else if (a.type === "task_completed") { icon = CheckCircle2; iconClass = "bg-muted text-muted-foreground"; }
      else if (a.type === "enrollment_created") { icon = UserPlus; iconClass = "bg-primary/10 text-primary"; }
      else if (a.type === "enrollment_paused") { icon = Pause; iconClass = "bg-amber-100 text-amber-600"; }
      else if (a.type === "enrollment_resumed") { icon = Play; iconClass = "bg-green-100 text-green-600"; }
      else if (a.type === "status_changed") { icon = ArrowRightLeft; iconClass = "bg-violet-100 text-violet-600"; }
      else if (a.type === "contact_updated") { icon = Info; iconClass = "bg-sky-100 text-sky-600"; }
      const label = isCall
        ? `Call logged${a.disposition ? ` — ${a.disposition}` : ""}`
        : a.type === "task_completed"
          ? `${a.taskType ?? "Task"} completed`
          : a.type === "enrollment_created"
            ? `Enrolled in ${a.source ?? "workflow"}`
            : a.type === "enrollment_paused"
              ? "Workflow paused"
              : a.type === "enrollment_resumed"
                ? "Workflow resumed"
                : a.type === "status_changed"
                  ? `Status ${a.oldStatus ?? ""} → ${a.newStatus ?? ""}`
                  : a.type.replace(/_/g, " ");
      return { id: a.id, ts: new Date(a.timestamp), icon, iconClass, label, sub: a.note ?? a.source };
    });

  const commsEntries: MiniTimelineEntry[] = emailHistory
    .filter((e) => e.contactId === contact.id)
    .map((e) => {
      const isSms = e.channel === "sms";
      const inbound = e.direction === "inbound";
      return {
        id: `eh-${e.id}`,
        ts: new Date(e.sentAt),
        icon: isSms ? MessageSquare : Mail,
        iconClass: inbound ? "bg-blue-100 text-blue-600" : "bg-muted text-muted-foreground",
        label: e.subject ?? (isSms ? "SMS" : "Email"),
        sub: `${inbound ? "Received" : "Sent"}${e.workflowName ? ` · ${e.workflowName}` : ""}`,
      };
    });

  const timeline = [...activityEntries, ...commsEntries]
    .sort((a, b) => b.ts.getTime() - a.ts.getTime())
    .slice(0, 50);

  return (
    <div className="mb-6 rounded-xl border border-primary/20 bg-primary/[0.03] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-primary/15 bg-primary/[0.04]">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Contact Context</span>
        </div>
        <span className="text-[9px] font-bold text-primary/70 uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10">
          RFC-008 · Proposed
        </span>
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* Identity / status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">{contact.firstName} {contact.lastName}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[contact.listingStatus] ?? "bg-muted text-muted-foreground"}`}>
            {contact.listingStatus}
          </span>
          {contact.isDoNotCall && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
              <PhoneOff className="w-2.5 h-2.5" /> Do Not Call
            </span>
          )}
          {contact.loanOfficer && (
            <span className="text-[10px] text-muted-foreground">· LO: {contact.loanOfficer}</span>
          )}
        </div>

        {/* Segments */}
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            <Layers className="w-3 h-3" /> Segments
          </p>
          {contactSegments.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic">Not in any segment</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
              {contactSegments.map((s) => (
                <span key={s.id} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-foreground font-medium">
                  {s.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Workflows */}
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            <WorkflowIcon className="w-3 h-3" /> Workflow position
          </p>
          {workflowContexts.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic">Not enrolled in a workflow</p>
          ) : (
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {workflowContexts.map((ctx) => (
                <Link
                  key={ctx.enrollment.id}
                  to={`/crm/workflows/${ctx.enrollment.workflowId}/board`}
                  state={{ openContactId: ctx.enrollment.contactId, openEnrollmentId: ctx.enrollment.id }}
                  className="block rounded-lg border border-border bg-card px-3 py-2 hover:border-primary/40 transition-colors group"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ctx.status === "paused" ? "bg-amber-400" : "bg-green-500"}`} />
                    <span className="text-xs font-medium text-foreground truncate flex-1">{ctx.workflowName}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary shrink-0" />
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {ctx.nextStep ? (
                      <>
                        <span className="text-[11px] text-muted-foreground">
                          Next: <span className="text-foreground">{ctx.nextStep.name}</span>
                        </span>
                        {ctx.isNextStepManual && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            <AlertCircle className="w-2.5 h-2.5" /> Action required
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">All steps complete</span>
                    )}
                    <span className="text-[10px] text-muted-foreground/60 ml-auto">
                      {ctx.actionStepsDone}/{ctx.actionStepsTotal} steps
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent timeline */}
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            <Clock className="w-3 h-3" /> Recent activity
          </p>
          {timeline.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic">No activity yet</p>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {timeline.map((t) => {
                const Icon = t.icon;
                return (
                  <div key={t.id} className="flex items-start gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${t.iconClass}`}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground truncate">{t.label}</p>
                      {t.sub && <p className="text-[10px] text-muted-foreground truncate">{t.sub}</p>}
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">{formatDate(t.ts)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
