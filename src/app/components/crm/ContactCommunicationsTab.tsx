import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Pause,
  Play,
  AlertTriangle,
  Mail,
  MessageSquare,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Calendar,
  Users,
  Phone,
  Clock,
  CheckCircle2,
  Circle,
  SkipForward,
  RotateCcw,
} from "lucide-react";
import { useAppData } from "@/app/contexts/AppDataContext";
import { mergeSteps } from "@/app/lib/workflowUtils";
import { getContactSegments } from "@/app/lib/segmentUtils";
import type { WorkflowEnrollment, Workflow as WorkflowType, WorkflowStep, EmailRecord } from "@/app/types";
import { PauseAllCommsModal } from "./PauseAllCommsModal";
import { optOutSourceLabel } from "@/app/lib/optOutUtils";

type ChannelFilter = "all" | "email" | "sms";

interface ContactCommunicationsTabProps {
  contactId: string;
  contactOptedOut: boolean;
  highlightEnrollmentId?: string | null;
  onHighlightConsumed?: () => void;
}

interface ScheduledMessage {
  id: string;
  enrollmentId: string;
  workflowName: string;
  stepName: string;
  subject: string;
  channel: "email" | "sms";
  senderIdentity?: string;
  scheduledAt: Date;
  enrollmentStatus: "active" | "paused";
}

function formatShortDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

function getEnrollmentProgress(enrollment: WorkflowEnrollment, workflow: WorkflowType) {
  const allSteps = mergeSteps(workflow.steps, enrollment.customSteps);
  const actionSteps = allSteps.filter(s => s.actionType !== "delay" && s.actionType !== "conditional");
  const doneCount = enrollment.stepProgress.filter(p => p.status === "done" || p.status === "skipped").length;
  const pct = enrollment.stepProgress.length > 0
    ? Math.round((doneCount / enrollment.stepProgress.length) * 100)
    : enrollment.status === "completed" ? 100 : 0;
  return { total: actionSteps.length, done: doneCount, pct };
}

function stepTypeIcon(actionType: WorkflowStep["actionType"]) {
  switch (actionType) {
    case "email": return <Mail className="w-3.5 h-3.5" />;
    case "sms": return <MessageSquare className="w-3.5 h-3.5" />;
    case "call-reminder":
    case "voicemail-reminder": return <Phone className="w-3.5 h-3.5" />;
    case "delay": return <Clock className="w-3.5 h-3.5" />;
    default: return <Circle className="w-3.5 h-3.5" />;
  }
}

function stepTypeLabel(actionType: WorkflowStep["actionType"]) {
  switch (actionType) {
    case "email": return "Email";
    case "sms": return "SMS";
    case "call-reminder": return "Call";
    case "voicemail-reminder": return "Voicemail";
    case "delay": return "Wait";
    case "conditional": return "Condition";
    default: return "Step";
  }
}

// ── Workflow Journey Modal ────────────────────────────────────────────────────

interface WorkflowJourneyModalProps {
  enrollment: WorkflowEnrollment;
  workflow: WorkflowType;
  contactId: string;
  contactOptedOut: boolean;
  onClose: () => void;
}

function WorkflowJourneyModal({ enrollment, workflow, contactId, contactOptedOut, onClose }: WorkflowJourneyModalProps) {
  const { handleSetEnrollmentStatus, emailHistory, contactActivity } = useAppData();
  const navigate = useNavigate();
  const now = new Date();
  const isPaused = enrollment.status === "paused";
  const isCompleted = enrollment.status === "completed";
  const isOverdue = isPaused && enrollment.pausedUntil && new Date(enrollment.pausedUntil) <= now;
  const prog = getEnrollmentProgress(enrollment, workflow);

  const allSteps = mergeSteps(workflow.steps, enrollment.customSteps);

  // Match email/SMS records for this workflow
  const workflowEmails = emailHistory.filter(
    e => e.contactId === contactId && (e.workflowId === workflow.id || e.workflowName === workflow.name),
  );

  // Match call/task activity records for this workflow
  const workflowActivity = contactActivity.filter(
    a => a.contactId === contactId && (a.source === workflow.name) && a.type === "task_completed",
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold truncate">{workflow.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? "bg-border" : isPaused ? "bg-amber-400" : "bg-green-500"}`} />
                <span className={`text-xs font-medium ${isCompleted ? "text-muted-foreground" : isPaused ? "text-amber-600" : "text-green-600"}`}>
                  {isCompleted ? "Completed" : isPaused ? (isOverdue ? "Overdue" : "Paused") : "Active"}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">· {prog.done}/{prog.total} steps · {prog.pct}%</span>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-5 pt-3 pb-1 shrink-0">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isCompleted ? "bg-muted-foreground/40" : "bg-primary"}`}
              style={{ width: `${prog.pct}%` }}
            />
          </div>
        </div>

        {/* Paused warning */}
        {isPaused && (
          <div className="px-5 pt-2 shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {enrollment.pausedUntil
                ? isOverdue
                  ? "Resume date passed — workflow is still paused"
                  : `Paused until ${formatShortDate(enrollment.pausedUntil)}${enrollment.pauseReason ? ` · ${enrollment.pauseReason}` : ""}`
                : "Workflow is paused"}
            </div>
          </div>
        )}

        {/* Journey steps — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contact Journey</p>
          <div className="space-y-1">
            {allSteps.map((step, idx) => {
              const progress = enrollment.stepProgress.find(p => p.stepId === step.id);
              const stepStatus = progress?.status ?? "pending";
              const isDone = stepStatus === "done";
              const isSkipped = stepStatus === "skipped";
              const isPending = stepStatus === "pending";
              const isDelay = step.actionType === "delay";
              const isConditional = step.actionType === "conditional";

              // Match email record for this step
              const emailRecord = (step.actionType === "email" || step.actionType === "sms")
                ? workflowEmails.find(e => e.stepName === step.name || e.stepName === `Day ${step.dayOffset} ${stepTypeLabel(step.actionType)}`)
                : null;

              // Match call activity for this step
              const callRecord = (step.actionType === "call-reminder" || step.actionType === "voicemail-reminder")
                ? workflowActivity.find(a => a.stepName === step.name || a.stepName === `Day ${step.dayOffset} Call`)
                : null;

              return (
                <div key={step.id} className="flex gap-3">
                  {/* Timeline connector */}
                  <div className="flex flex-col items-center shrink-0 w-6">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      isDone ? "bg-green-100 text-green-600" :
                      isSkipped ? "bg-muted text-muted-foreground/40" :
                      isDelay || isConditional ? "bg-muted/50 text-muted-foreground/50" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                       isSkipped ? <SkipForward className="w-3 h-3" /> :
                       stepTypeIcon(step.actionType)}
                    </div>
                    {idx < allSteps.length - 1 && (
                      <div className="w-px flex-1 bg-border/60 my-1" />
                    )}
                  </div>

                  {/* Step content */}
                  <div className={`flex-1 pb-4 min-w-0 ${idx < allSteps.length - 1 ? "" : ""}`}>
                    <div className="flex items-start justify-between gap-2 pt-0.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs font-medium ${isSkipped ? "line-through text-muted-foreground/50" : isDone ? "text-foreground" : isDelay ? "text-muted-foreground/60" : "text-foreground/70"}`}>
                            {step.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground/50">Day {step.dayOffset}</span>
                        </div>

                        {/* Email record */}
                        {emailRecord && isDone && (
                          <div className="mt-1.5 text-xs text-muted-foreground space-y-0.5">
                            <div className="font-medium text-foreground/80 truncate">{emailRecord.subject}</div>
                            <div className="text-[10px] flex items-center gap-1.5">
                              <span>{emailRecord.senderIdentity}</span>
                              <span>·</span>
                              <span>{formatShortDate(emailRecord.sentAt)}</span>
                              {emailRecord.status && (
                                <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                                  emailRecord.status === "Opened" ? "bg-green-100 text-green-700" :
                                  emailRecord.status === "Delivered" ? "bg-blue-100 text-blue-600" :
                                  emailRecord.status === "Bounced" || emailRecord.status === "Failed" ? "bg-red-100 text-red-600" :
                                  "bg-muted text-muted-foreground"
                                }`}>{emailRecord.status}</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Call activity record */}
                        {callRecord && isDone && (
                          <div className="mt-1.5 text-xs space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                callRecord.disposition === "Answered" ? "bg-green-100 text-green-700" :
                                callRecord.disposition === "Voicemail Left" ? "bg-blue-100 text-blue-600" :
                                "bg-muted text-muted-foreground"
                              }`}>{callRecord.disposition ?? "Logged"}</span>
                              <span className="text-[10px] text-muted-foreground">{formatShortDate(callRecord.timestamp)}</span>
                            </div>
                            {callRecord.note && (
                              <p className="text-[11px] text-muted-foreground line-clamp-2 italic">"{callRecord.note}"</p>
                            )}
                          </div>
                        )}

                        {/* Delay display */}
                        {isDelay && (
                          <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                            Wait {step.delayDays ? `${step.delayDays}d` : ""}{step.delayHours ? ` ${step.delayHours}h` : ""}{step.delayMinutes ? ` ${step.delayMinutes}m` : ""}
                          </p>
                        )}
                      </div>

                      {/* Status badge */}
                      <div className="shrink-0 pt-0.5">
                        {isDone && !emailRecord && !callRecord && (
                          <span className="text-[10px] text-green-600 font-medium">Done</span>
                        )}
                        {isPending && !isDelay && !isConditional && (
                          <span className="text-[10px] text-muted-foreground/60">Pending</span>
                        )}
                        {isSkipped && (
                          <span className="text-[10px] text-muted-foreground/40">Skipped</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer actions */}
        {!isCompleted && !contactOptedOut && (
          <div className="flex items-center gap-2 px-5 py-3 border-t border-border shrink-0">
            <button
              onClick={() => {
                handleSetEnrollmentStatus(enrollment.id, isPaused ? "active" : "paused");
                onClose();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                isPaused
                  ? "border-green-300 text-green-700 hover:bg-green-50"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {isPaused ? <><Play className="w-3 h-3" /> Resume</> : <><Pause className="w-3 h-3" /> Pause</>}
            </button>
            <button
              onClick={() => navigate(`/email-workflows/flows/${workflow.id}/board`, {
                state: { openContactId: contactId, openEnrollmentId: enrollment.id },
              })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            >
              Open workflow <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const CARDS_VISIBLE = 4;

export function ContactCommunicationsTab({
  contactId,
  contactOptedOut,
}: ContactCommunicationsTabProps) {
  const {
    workflows,
    workflowEnrollments,
    emailHistory,
    contacts,
    segments,
    applications,
    handlePauseAllEnrollments,
    handleResendMessage,
  } = useAppData();

  const [showPauseModal, setShowPauseModal] = useState(false);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [showAllCards, setShowAllCards] = useState(false);
  const [journeyEnrollmentId, setJourneyEnrollmentId] = useState<string | null>(null);

  const allEnrollments = workflowEnrollments.filter(e => e.contactId === contactId);
  const activeCount = allEnrollments.filter(e => e.status === "active").length;
  const visibleCards = showAllCards ? allEnrollments : allEnrollments.slice(0, CARDS_VISIBLE);

  // User Segments
  const contact = contacts.find(c => c.id === contactId);
  const contactSegments = contact
    ? getContactSegments(contact, segments, applications)
    : [];

  // Scheduled Messages
  const allScheduledMessages: ScheduledMessage[] = [];
  for (const enrollment of allEnrollments) {
    if (enrollment.status === "completed") continue;
    const workflow = workflows.find(w => w.id === enrollment.workflowId);
    if (!workflow) continue;
    const mergedSteps = mergeSteps(workflow.steps, enrollment.customSteps);
    const startDate = new Date(enrollment.startDate);
    for (const step of mergedSteps) {
      if (step.actionType !== "email" && step.actionType !== "sms") continue;
      const progress = enrollment.stepProgress.find(p => p.stepId === step.id);
      if (progress && progress.status !== "pending") continue;
      const scheduledAt = new Date(startDate.getTime() + step.dayOffset * 24 * 60 * 60 * 1000);
      allScheduledMessages.push({
        id: `${enrollment.id}-${step.id}`,
        enrollmentId: enrollment.id,
        workflowName: workflow.name,
        stepName: step.name,
        subject: step.subject ?? step.templateName ?? step.smsTemplateName ?? step.name,
        channel: step.actionType,
        senderIdentity: step.senderIdentity,
        scheduledAt,
        enrollmentStatus: enrollment.status,
      });
    }
  }
  allScheduledMessages.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  const filteredScheduledMessages = allScheduledMessages.filter(msg => {
    if (channelFilter === "email" && msg.channel !== "email") return false;
    if (channelFilter === "sms" && msg.channel !== "sms") return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        msg.subject.toLowerCase().includes(q) ||
        msg.workflowName.toLowerCase().includes(q) ||
        msg.stepName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Failed Messages
  const failedStatuses = new Set<EmailRecord["status"]>(["Failed", "Bounced", "Undelivered"]);
  const allFailedMessages = emailHistory
    .filter(e =>
      e.contactId === contactId &&
      (e.direction === "outbound" || e.direction === undefined) &&
      failedStatuses.has(e.status),
    )
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

  const filteredFailedMessages = allFailedMessages.filter(msg => {
    if (channelFilter === "email" && msg.channel !== "email") return false;
    if (channelFilter === "sms" && msg.channel !== "sms") return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (msg.subject ?? "").toLowerCase().includes(q) ||
        (msg.senderIdentity ?? "").toLowerCase().includes(q) ||
        (msg.workflowName ?? "").toLowerCase().includes(q) ||
        (msg.stepName ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCardClick = (enrollmentId: string) => {
    setJourneyEnrollmentId(enrollmentId);
  };

  const journeyEnrollment = allEnrollments.find(e => e.id === journeyEnrollmentId) ?? null;
  const journeyWorkflow = journeyEnrollment ? workflows.find(w => w.id === journeyEnrollment.workflowId) ?? null : null;

  return (
    <div className="space-y-5">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search messages…"
            className="w-full pl-8 pr-7 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5 bg-background">
          {(["all", "email", "sms"] as ChannelFilter[]).map(ch => (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors font-medium ${
                channelFilter === ch ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ch === "all" ? "All" : ch === "email" ? "Email" : "SMS"}
            </button>
          ))}
        </div>
        {!contactOptedOut && activeCount > 0 && (
          <button
            onClick={() => setShowPauseModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors whitespace-nowrap"
          >
            <Pause className="w-3.5 h-3.5" /> Pause All
          </button>
        )}
      </div>

      {/* ── Workflow cards ── */}
      {allEnrollments.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Workflows</p>
          <div className="grid grid-cols-4 gap-2">
            {visibleCards.map(enrollment => {
              const workflow = workflows.find(w => w.id === enrollment.workflowId);
              if (!workflow) return null;
              const now = new Date();
              const isPaused = enrollment.status === "paused";
              const isCompleted = enrollment.status === "completed";
              const isOverdue = isPaused && enrollment.pausedUntil && new Date(enrollment.pausedUntil) <= now;
              const prog = getEnrollmentProgress(enrollment, workflow);
              const unreadCount = emailHistory.filter(
                e => e.contactId === contactId && (e.workflowId === workflow.id || e.workflowName === workflow.name) && e.direction === "inbound" && !e.read
              ).length;
              return (
                <button
                  key={enrollment.id}
                  onClick={() => handleCardClick(enrollment.id)}
                  className="text-left px-3 py-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <span className="text-xs font-medium leading-snug line-clamp-2 flex-1">{workflow.name}</span>
                    {unreadCount > 0 && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-semibold shrink-0 mt-0.5">
                        <span className="w-1 h-1 rounded-full bg-green-500" />
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full ${isCompleted ? "bg-muted-foreground/30" : "bg-primary/60"}`}
                      style={{ width: `${prog.pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? "bg-border" : isPaused ? "bg-amber-400" : "bg-green-500"}`} />
                      <span className={`text-[10px] font-medium ${isCompleted ? "text-muted-foreground/50" : isPaused ? "text-amber-600" : "text-green-600"}`}>
                        {isCompleted ? "Done" : isPaused ? (isOverdue ? "Overdue" : "Paused") : "Active"}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/50">{prog.done}/{prog.total}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {allEnrollments.length > CARDS_VISIBLE && (
            <button
              onClick={() => setShowAllCards(v => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAllCards ? (
                <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
              ) : (
                <><ChevronDown className="w-3.5 h-3.5" /> View all ({allEnrollments.length})</>
              )}
            </button>
          )}
        </div>
      )}

      {/* ── Failed Messages ── */}
      {filteredFailedMessages.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Failed Messages</p>
            <span className="text-[10px] text-red-600/60 font-medium">({filteredFailedMessages.length})</span>
          </div>
          <div className="divide-y divide-border border border-red-200 rounded-xl overflow-hidden">
            {filteredFailedMessages.map(msg => {
              const channel = msg.channel ?? "email";
              const channelOptOut = channel === "sms" ? contact?.smsOptOut : contact?.emailOptOut;
              const resendBlocked = contactOptedOut || channelOptOut?.optedOut === true;
              const resendTitle = resendBlocked
                ? `Cannot resend — contact has opted out of ${channel}`
                : `Resend ${channel}`;
              return (
                <div key={msg.id} className="flex items-start gap-3 px-4 py-3.5 bg-card">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-red-100 text-red-600">
                    {channel === "sms" ? <MessageSquare className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm truncate text-foreground/80">{msg.subject}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600">
                          {msg.status}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatShortDate(msg.sentAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {msg.senderIdentity && (
                        <span className="text-xs text-muted-foreground">{msg.senderIdentity}</span>
                      )}
                      {msg.workflowName && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                          {msg.workflowName}
                        </span>
                      )}
                      {channel === "sms" && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 font-medium">SMS</span>
                      )}
                      {msg.stepName && (
                        <span className="text-[11px] text-muted-foreground/60">{msg.stepName}</span>
                      )}
                    </div>
                    {resendBlocked && channelOptOut?.optedOut && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {optOutSourceLabel(channelOptOut.source)}
                        {channelOptOut.optedOutAt ? ` · ${formatShortDate(channelOptOut.optedOutAt)}` : ""}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => !resendBlocked && handleResendMessage(msg.id)}
                    disabled={resendBlocked}
                    title={resendTitle}
                    className={`flex items-center gap-1 text-xs font-medium mt-0.5 shrink-0 ${resendBlocked ? "text-muted-foreground cursor-not-allowed" : "text-primary hover:underline"}`}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Resend
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── User Segments ── */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">User Segments</p>
        {contactSegments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Users className="w-7 h-7 mb-2 opacity-20" />
            <p className="text-sm">Not in any segments.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {contactSegments.map(segment => (
              <div key={segment.id} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-full bg-background">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                <span className="text-xs font-medium">{segment.name}</span>
                <span className="text-xs text-muted-foreground">({segment.contactCount})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Scheduled Messages ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scheduled Messages</p>
          {filteredScheduledMessages.length > 0 && (
            <span className="text-[10px] text-muted-foreground/60 font-medium">({filteredScheduledMessages.length})</span>
          )}
        </div>

        {filteredScheduledMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Calendar className="w-8 h-8 mb-2.5 opacity-20" />
            <p className="text-sm">{search ? `No scheduled messages match "${search}"` : "No scheduled messages."}</p>
          </div>
        ) : (
          <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
            {filteredScheduledMessages.map(msg => {
              const isPaused = msg.enrollmentStatus === "paused";
              return (
                <div key={msg.id} className="flex items-start gap-3 px-4 py-3.5 bg-card">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-muted text-muted-foreground">
                    {msg.channel === "sms" ? <MessageSquare className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm truncate text-foreground/80">{msg.subject}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          isPaused ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-600"
                        }`}>
                          {isPaused ? "Paused" : "Scheduled"}
                        </span>
                        {!isPaused && (
                          <span className="text-xs text-muted-foreground">{formatShortDate(msg.scheduledAt)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {msg.senderIdentity && (
                        <span className="text-xs text-muted-foreground">{msg.senderIdentity}</span>
                      )}
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                        {msg.workflowName}
                      </span>
                      {msg.channel === "sms" && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 font-medium">SMS</span>
                      )}
                      <span className="text-[11px] text-muted-foreground/60">{msg.stepName}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Workflow journey modal ── */}
      {journeyEnrollment && journeyWorkflow && (
        <WorkflowJourneyModal
          enrollment={journeyEnrollment}
          workflow={journeyWorkflow}
          contactId={contactId}
          contactOptedOut={contactOptedOut}
          onClose={() => setJourneyEnrollmentId(null)}
        />
      )}

      <PauseAllCommsModal
        isOpen={showPauseModal}
        contactName=""
        activeEnrollmentCount={activeCount}
        onConfirm={(pausedUntil, reason) => {
          handlePauseAllEnrollments(contactId, pausedUntil, reason);
          setShowPauseModal(false);
        }}
        onClose={() => setShowPauseModal(false)}
      />
    </div>
  );
}
