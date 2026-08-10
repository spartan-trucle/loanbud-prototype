import type React from "react";
import { useState } from "react";
import { Link } from "react-router";
import { Mail, MessageCircle, Phone, CheckCircle2, Clock, X, Pause, Play, SkipForward, ChevronDown, ChevronRight, User, MapPin, Ban, Check, Plus, Trash2, Pencil, Lock, UserCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { useAppData } from "../../contexts/AppDataContext";
import type { ContactActivityRecord, CustomWorkflowStep } from "../../types";
import { mergeSteps } from "../../lib/workflowUtils";
import { StepConfigFields, STEP_DEFAULTS, TYPE_ICON_BG, StepTypeIcon, type StepDraft } from "./StepConfigForm";
import { toast } from "sonner";
import { effectiveSendMode } from "../../lib/workflowSendScope";
import { getMatchedListings } from "../../lib/segmentUtils";

const USER_TYPE_AVATAR: Record<string, string> = {
  Broker: "bg-blue-100 text-blue-700",
  Lender: "bg-purple-100 text-purple-700",
  Partner: "bg-green-100 text-green-700",
};

const LISTING_STATUS_STYLES: Record<string, string> = {
  New: "bg-sky-100 text-sky-700",
  Draft: "bg-gray-100 text-gray-600",
  Submitted: "bg-indigo-100 text-indigo-700",
  "On Hold": "bg-yellow-100 text-yellow-700",
  Declined: "bg-red-100 text-red-700",
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatDate(date: Date | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
}

function formatDateTime(date: Date | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(date));
}

const STEP_ICON: Record<string, React.ReactNode> = {
  email: <Mail className="h-3.5 w-3.5" />,
  sms: <MessageCircle className="h-3.5 w-3.5" />,
  "call-reminder": <Phone className="h-3.5 w-3.5" />,
};

const STEP_ICON_BG: Record<string, string> = {
  email: "bg-blue-100 text-blue-600",
  sms: "bg-violet-100 text-violet-600",
  "call-reminder": "bg-amber-100 text-amber-600",
};

const EVENT_TYPE_LABEL: Record<string, string> = {
  email_sent: "Email Sent",
  sms_sent: "SMS Sent",
  task_completed: "Task Completed",
  step_skipped: "Step Skipped",
  step_unskipped: "Step Unskipped",
  enrollment_paused: "Flow Paused",
  enrollment_resumed: "Flow Resumed",
  custom_step_added: "Custom Step Added",
  custom_step_removed: "Custom Step Removed",
  contact_moved_to_step: "Moved to Step",
};

function getDetail(entry: ContactActivityRecord): React.ReactNode {
  if (entry.type === "email_sent") {
    return entry.subject
      ? <><span className="font-semibold">Subject</span> — {entry.subject}{entry.stepName ? ` · ${entry.stepName}` : ""}</>
      : entry.stepName ?? "—";
  }
  if (entry.type === "sms_sent") {
    return entry.message
      ? <><span className="font-semibold">Message</span> — {entry.message.slice(0, 80)}{entry.message.length > 80 ? "…" : ""}{entry.stepName ? ` · ${entry.stepName}` : ""}</>
      : entry.stepName ?? "—";
  }
  if (entry.type === "task_completed") {
    const parts: string[] = [];
    if (entry.taskType) parts.push(entry.taskType);
    if (entry.disposition) parts.push(entry.disposition);
    if (entry.stepName) parts.push(entry.stepName);
    return parts.join(" · ") || "—";
  }
  if (entry.type === "step_skipped" || entry.type === "step_unskipped") {
    return entry.stepName
      ? <><span className="font-semibold">Step</span> — {entry.stepName}</>
      : "—";
  }
  if (entry.type === "enrollment_paused" || entry.type === "enrollment_resumed") {
    return entry.type === "enrollment_paused" ? "Contact paused in this flow" : "Contact resumed in this flow";
  }
  if (entry.type === "custom_step_added" || entry.type === "custom_step_removed") {
    return entry.stepName
      ? <><span className="font-semibold">Step</span> — {entry.stepName}</>
      : "—";
  }
  if (entry.type === "contact_moved_to_step") {
    return entry.stepName
      ? <><span className="font-semibold">Target</span> — {entry.stepName}</>
      : "—";
  }
  return "—";
}

interface WorkflowContactPanelProps {
  open: boolean;
  contactId: string | null;
  enrollmentId: string | null;
  workflowId: string;
  onClose: () => void;
}

type TabId = "steps" | "history";

export function WorkflowContactPanel({ open, contactId, enrollmentId, workflowId, onClose }: WorkflowContactPanelProps) {
  const { contacts, workflowEnrollments, workflows, segments, contactActivity, emailHistory, handleSetEnrollmentStatus, handleSkipStep, handleUnskipStep, handleCustomizeDelay, handleMoveToStep, handleAddCustomStep, handleRemoveCustomStep } = useAppData();
  const [activeTab, setActiveTab] = useState<TabId>("steps");
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [selectedStepIds, setSelectedStepIds] = useState<Set<string>>(new Set());
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  // Edit mode: unlocks per-contact journey editing controls
  const [isEditing, setIsEditing] = useState(false);

  // Shared confirmation dialog
  const [confirm, setConfirm] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const askConfirm = (title: string, description: string, onConfirm: () => void) =>
    setConfirm({ title, description, onConfirm });

  const [delayDrafts, setDelayDrafts] = useState<Record<string, { days: number; hours: number; minutes: number }>>({});

  // Inline insert form
  const [activeInsertPoint, setActiveInsertPoint] = useState<string | null | undefined>(undefined);
  const [insertDraft, setInsertDraft] = useState<StepDraft>({ name: "", actionType: "email" });

  // Staged (pending) custom steps — applied on Done Editing confirmation
  const [pendingCustomSteps, setPendingCustomSteps] = useState<Array<{
    tempId: string;
    stepDef: StepDraft;
    insertAfterStepId: string | null;
  }>>([]);

  const defaultInsertDraft = (): StepDraft => ({ name: "", actionType: "email" });

  const resetInsertForm = () => {
    setActiveInsertPoint(undefined);
    setInsertDraft(defaultInsertDraft());
  };

  const fmtDelay = (d: number, h: number, m: number) => {
    const parts: string[] = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    return parts.length ? parts.join(" ") : "0m";
  };

  const exitEditMode = () => {
    const pendingDelays = Object.entries(delayDrafts);
    const hasChanges = pendingDelays.length > 0 || pendingCustomSteps.length > 0;

    if (!hasChanges || !enrollment) {
      setIsEditing(false);
      resetInsertForm();
      setDelayDrafts({});
      setPendingCustomSteps([]);
      return;
    }

    const parts: string[] = [];
    if (pendingCustomSteps.length > 0) {
      parts.push(pendingCustomSteps.map((p) => `Add "${p.stepDef.name || STEP_DEFAULTS[p.stepDef.actionType]}"`).join(", "));
    }
    if (pendingDelays.length > 0) {
      parts.push(
        pendingDelays.map(([stepId, { days, hours, minutes }]) => {
          const step = sortedSteps.find((s) => s.id === stepId);
          return `"${step?.name ?? stepId}" → ${fmtDelay(days, hours, minutes)}`;
        }).join(", "),
      );
    }

    askConfirm(
      "Apply changes?",
      `Save for this contact only: ${parts.join(" · ")}`,
      () => {
        pendingCustomSteps.forEach(({ stepDef, insertAfterStepId }) => {
          handleAddCustomStep(enrollment.id, stepDef, insertAfterStepId);
        });
        pendingDelays.forEach(([stepId, { days, hours, minutes }]) => {
          handleCustomizeDelay(enrollment.id, stepId, days, hours, minutes);
        });
        setIsEditing(false);
        resetInsertForm();
        setDelayDrafts({});
        setPendingCustomSteps([]);
      },
    );
  };

  const contact = contactId ? contacts.find((c) => c.id === contactId) : null;
  const enrollment = enrollmentId ? workflowEnrollments.find((e) => e.id === enrollmentId) : null;
  const workflow = workflows.find((w) => w.id === workflowId);

  const unreadReplies = contactId
    ? emailHistory.filter((e) => e.contactId === contactId && e.direction === "inbound" && !e.read).length
    : 0;

  const sortedSteps = mergeSteps(workflow?.steps ?? [], enrollment?.customSteps);
  const actionSteps = sortedSteps.filter((s) => s.actionType !== "delay");

  const flowActivity = (() => {
    if (!contactId || !workflow) return [];
    return [...contactActivity]
      .filter(
        (a) =>
          a.contactId === contactId &&
          a.sourceType === "flow" &&
          a.source === workflow.name,
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  })();

  if (!open || !contact || !enrollment || !workflow) return null;

  const flowSegment = segments.find((s) => s.id === workflow.segmentId);
  const segmentFilters = flowSegment?.filters ?? [];
  const flowListings = getMatchedListings(contact, segmentFilters);
  // Default to the first listing; fall back gracefully if the selected one no longer matches.
  const activeListing = flowListings.find((l) => l.id === selectedListingId) ?? flowListings[0] ?? null;

  const avatarClass = USER_TYPE_AVATAR[contact.userType] ?? "bg-gray-100 text-gray-700";
  const isPaused = enrollment.status === "paused";
  const isCompleted = enrollment.status === "completed";

  const enrollmentStatusStyle =
    enrollment.status === "active"
      ? "bg-green-100 text-green-700 border border-green-200"
      : enrollment.status === "completed"
      ? "bg-gray-100 text-gray-600 border border-gray-200"
      : "bg-yellow-100 text-yellow-700 border border-yellow-200";

  const firstPendingIdx = sortedSteps.findIndex(
    (step) =>
      step.actionType !== "delay" &&
      enrollment.stepProgress.find((p) => p.stepId === step.id)?.status === "pending",
  );

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "steps", label: "Step Progress" },
    { id: "history", label: "Activity Log", count: flowActivity.length },
  ];

  const toggleSelect = (stepId: string) => {
    setSelectedStepIds((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) { next.delete(stepId); } else { next.add(stepId); }
      return next;
    });
  };

  const handleBulkSkip = () => {
    askConfirm(
      `Skip ${selectedStepIds.size} step${selectedStepIds.size > 1 ? "s" : ""}?`,
      "These steps will be marked as skipped and cannot be automatically undone in bulk.",
      () => {
        selectedStepIds.forEach((stepId) => handleSkipStep(enrollment.id, stepId));
        toast.success(`${selectedStepIds.size} step${selectedStepIds.size > 1 ? "s" : ""} skipped`);
        setSelectedStepIds(new Set());
      },
    );
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-[1200px] p-0 gap-0 flex flex-col bg-white" style={{ height: "85vh" }}>
        {/* Header — full width */}
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold">Contact in Flow</DialogTitle>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        {/* Body: left content + right sidebar */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* LEFT — tabs + scrollable content */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-r border-border">
            {/* Sticky tab bar */}
            <div className="sticky top-0 z-10 border-b border-border bg-background px-6 flex items-center gap-0 shrink-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-1 py-3 mr-6 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      activeTab === tab.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Scrollable tab content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
              {/* Step Progress tab */}
              {activeTab === "steps" && (
                <div className="space-y-2">
                  {/* Listing switcher — view one listing's timeline at a time (CRM-700) */}
                  {flowListings.length > 1 && (
                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                      <span className="text-xs text-muted-foreground mr-1">Listing:</span>
                      {flowListings.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setSelectedListingId(l.id)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            activeListing?.id === l.id
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {l.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Edit Journey banner */}
                  {!isCompleted && (
                    isEditing ? (
                      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 mb-1">
                        <div className="flex items-center gap-2">
                          <Pencil className="h-3.5 w-3.5 text-green-600 shrink-0" />
                          <span className="text-xs text-green-800 font-medium">You're editing the journey. Changes will be saved when you click Done Editing.</span>
                        </div>
                        <button
                          onClick={exitEditMode}
                          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors shrink-0"
                        >
                          <Check className="h-3 w-3" />
                          Done Editing
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-100 border border-gray-200 mb-4">
                        <div className="flex items-center gap-2">
                          <Lock className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                          <span className="text-xs text-gray-700 font-medium">Read-only — click Edit Journey to skip or modify steps.</span>
                        </div>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-gray-700 text-white hover:bg-gray-800 transition-colors shrink-0"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit Journey
                        </button>
                      </div>
                    )
                  )}
                  {/* Bulk skip toolbar */}
                  {selectedStepIds.size > 0 && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/60 border border-border mb-3">
                      <span className="text-xs text-muted-foreground">
                        {selectedStepIds.size} step{selectedStepIds.size > 1 ? "s" : ""} selected
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedStepIds(new Set())}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                        <button
                          onClick={handleBulkSkip}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 transition-colors cursor-pointer"
                        >
                          <SkipForward className="h-3 w-3" />
                          Skip {selectedStepIds.size} step{selectedStepIds.size > 1 ? "s" : ""}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Timeline wrapper */}
                  <div className="relative">
                    <div className="absolute left-4 top-5 bottom-5 w-px bg-border" />

                    {/* Start node */}
                    <div className="relative flex gap-3 mb-3">
                      <div className="flex flex-col items-center shrink-0 pt-2">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 z-10 ring-2 ring-background">
                          <UserCheck className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 rounded-lg border mb-1 border-border bg-muted/20">
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground">
                            <UserCheck className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-sm font-medium text-muted-foreground flex-1">Contact enrolled</span>
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground whitespace-nowrap">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Enrolled · {formatDate(enrollment.startDate)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {sortedSteps.flatMap((step, idx) => {
                      const isLastStep = idx === sortedSteps.length - 1;
                      const showInsertZone = !isCompleted && !isLastStep && isEditing;
                      if (step.actionType === "delay") {
                        const delayProgress = enrollment.stepProgress.find((p) => p.stepId === step.id);
                        const savedDays = delayProgress?.customDelayDays ?? step.delayDays ?? 0;
                        const savedHours = delayProgress?.customDelayHours ?? step.delayHours ?? 0;
                        const savedMinutes = delayProgress?.customDelayMinutes ?? step.delayMinutes ?? 0;
                        const draft = delayDrafts[step.id];
                        const draftDays = draft?.days ?? savedDays;
                        const draftHours = draft?.hours ?? savedHours;
                        const draftMinutes = draft?.minutes ?? savedMinutes;
                        const hasDraft = draft !== undefined && (draftDays !== savedDays || draftHours !== savedHours || draftMinutes !== savedMinutes);

                        const setDraft = (patch: Partial<{ days: number; hours: number; minutes: number }>) =>
                          setDelayDrafts((d) => ({ ...d, [step.id]: { days: draftDays, hours: draftHours, minutes: draftMinutes, ...patch } }));

                        const fmtDelay = (d: number, h: number, m: number) => {
                          const parts: string[] = [];
                          if (d > 0) parts.push(`${d}d`);
                          if (h > 0) parts.push(`${h}h`);
                          if (m > 0) parts.push(`${m}m`);
                          return parts.length ? parts.join(" ") : "0m";
                        };

                        const delayStatus = enrollment.stepProgress.find((p) => p.stepId === step.id)?.status ?? "pending";
                        const delayIsDone = delayStatus === "done";
                        const delayIsCurrent = idx === firstPendingIdx;

                        const delayTimelineNode = delayIsDone ? (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 z-10 ring-2 ring-background">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ) : delayIsCurrent ? (
                          <div className="w-8 h-8 rounded-full bg-muted border-2 border-muted-foreground/30 flex items-center justify-center shrink-0 z-10 ring-2 ring-background">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-background border-2 border-border flex items-center justify-center shrink-0 z-10">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground/40" />
                          </div>
                        );

                        const stepElement = (
                          <div key={step.id} className="relative flex gap-3 mb-3">
                            <div className="flex flex-col items-center shrink-0 pt-2">
                              {delayTimelineNode}
                            </div>
                            <div className={`flex-1 min-w-0 rounded-lg border mb-1 ${delayIsDone ? "border-border bg-muted/20" : "border-border bg-card"}`}>
                              <div className="flex items-center gap-2 px-3 py-2.5">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground">
                                  <Clock className="h-3.5 w-3.5" />
                                </div>
                                <span className="text-sm font-medium text-muted-foreground flex-shrink-0">{step.name}</span>
                                {isEditing ? (
                                  <div className="flex items-center gap-1 ml-1 flex-wrap">
                                    <button type="button" onClick={() => setDraft({ days: Math.max(0, draftDays - 1) })} className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted transition-colors text-sm font-bold text-muted-foreground hover:text-foreground leading-none">−</button>
                                    <span className={`text-sm font-semibold min-w-[16px] text-center ${hasDraft ? "text-primary" : "text-foreground"}`}>{draftDays}</span>
                                    <button type="button" onClick={() => setDraft({ days: draftDays + 1 })} className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted transition-colors text-sm font-bold text-muted-foreground hover:text-foreground leading-none">+</button>
                                    <span className="text-xs text-muted-foreground mr-2">d</span>
                                    <button type="button" onClick={() => setDraft({ hours: Math.max(0, draftHours - 1) })} className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted transition-colors text-sm font-bold text-muted-foreground hover:text-foreground leading-none">−</button>
                                    <span className={`text-sm font-semibold min-w-[16px] text-center ${hasDraft ? "text-primary" : "text-foreground"}`}>{draftHours}</span>
                                    <button type="button" onClick={() => setDraft({ hours: Math.min(23, draftHours + 1) })} className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted transition-colors text-sm font-bold text-muted-foreground hover:text-foreground leading-none">+</button>
                                    <span className="text-xs text-muted-foreground mr-2">h</span>
                                    <button type="button" onClick={() => setDraft({ minutes: Math.max(0, draftMinutes - 5) })} className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted transition-colors text-sm font-bold text-muted-foreground hover:text-foreground leading-none">−</button>
                                    <span className={`text-sm font-semibold min-w-[16px] text-center ${hasDraft ? "text-primary" : "text-foreground"}`}>{draftMinutes}</span>
                                    <button type="button" onClick={() => setDraft({ minutes: Math.min(55, draftMinutes + 5) })} className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted transition-colors text-sm font-bold text-muted-foreground hover:text-foreground leading-none">+</button>
                                    <span className="text-xs text-muted-foreground">m</span>
                                  </div>
                                ) : (
                                  <span className="text-sm font-semibold text-foreground ml-1">{fmtDelay(savedDays, savedHours, savedMinutes)}</span>
                                )}
                                <div className="flex-1" />
                                {delayIsDone && (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground whitespace-nowrap">
                                    <CheckCircle2 className="h-2.5 w-2.5" /> Passed
                                  </span>
                                )}
                                {!delayIsDone && delayIsCurrent && (
                                  <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700 whitespace-nowrap">
                                    Waiting
                                  </span>
                                )}
                                {!delayIsDone && !delayIsCurrent && (
                                  <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground whitespace-nowrap">
                                    Upcoming
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                        // Staged steps to show after this step
                        const stagedAfterThis = pendingCustomSteps.filter((p) => p.insertAfterStepId === step.id);
                        const insertZone = showInsertZone && activeInsertPoint === step.id ? (
                          <div key={`ins-${step.id}`} className="ml-[52px] my-2 rounded-xl border-2 border-primary/30 bg-card shadow-sm z-10 relative">
                            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${insertDraft.actionType === "email" ? "border-emerald-500 text-emerald-600" : insertDraft.actionType === "sms" ? "border-purple-400 text-purple-600" : "border-blue-400 text-blue-600"}`}>
                                  <StepTypeIcon type={insertDraft.actionType} size="sm" />
                                </div>
                                <span className="text-sm font-semibold text-foreground">{insertDraft.name || STEP_DEFAULTS[insertDraft.actionType]}</span>
                              </div>
                              <button onClick={resetInsertForm} className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"><X className="h-4 w-4" /></button>
                            </div>
                            <div className="p-5">
                              <StepConfigFields draft={insertDraft} onChange={(p) => setInsertDraft((d) => ({ ...d, ...p }))} />
                              <div className="flex items-center gap-2 pt-5 mt-5 border-t border-border">
                                <button
                                  type="button"
                                  disabled={!insertDraft.name.trim()}
                                  onClick={() => {
                                    if (!insertDraft.name.trim()) return;
                                    setPendingCustomSteps((prev) => [...prev, { tempId: `tmp-${Date.now()}`, stepDef: { ...insertDraft }, insertAfterStepId: step.id }]);
                                    resetInsertForm();
                                  }}
                                  className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Plus className="h-3.5 w-3.5" /> Stage Step
                                </button>
                                <button type="button" onClick={resetInsertForm} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                              </div>
                            </div>
                          </div>
                        ) : showInsertZone ? (
                          <div key={`ins-${step.id}`} className="group relative h-5 flex items-center -my-0.5 z-10">
                            <div className="absolute left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setActiveInsertPoint(step.id); setInsertDraft(defaultInsertDraft()); }} className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-600 hover:bg-violet-100 shadow-sm whitespace-nowrap cursor-pointer"><Plus className="h-2.5 w-2.5" /> Add step</button>
                            </div>
                          </div>
                        ) : null;

                        const stagedCards = stagedAfterThis.map((pending) => (
                          <div key={pending.tempId} className="relative flex gap-3 mb-3 ml-[44px]">
                            <div className="flex flex-col items-center shrink-0 pt-2">
                              <div className="w-8 h-8 rounded-full bg-background border-2 border-dashed border-violet-400 flex items-center justify-center shrink-0 z-10">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${TYPE_ICON_BG[pending.stepDef.actionType]}`}>
                                  <StepTypeIcon type={pending.stepDef.actionType} size="sm" />
                                </div>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 rounded-lg border border-dashed border-violet-300 bg-violet-50/40 mb-1">
                              <div className="flex items-center gap-2 px-3 py-2.5">
                                <div className="w-3.5 shrink-0" />
                                <span className="text-sm font-medium text-foreground flex-1 truncate">{pending.stepDef.name || STEP_DEFAULTS[pending.stepDef.actionType]}</span>
                                <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium border border-violet-300 text-violet-600 bg-violet-50 whitespace-nowrap">Staged</span>
                                <button
                                  type="button"
                                  onClick={() => setPendingCustomSteps((prev) => prev.filter((p) => p.tempId !== pending.tempId))}
                                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ));

                        return [stepElement, insertZone, ...stagedCards];
                      }
                      const progress = enrollment.stepProgress.find((p) => p.stepId === step.id);
                      const status = progress?.status ?? "pending";
                      const isCurrentStep = idx === firstPendingIdx;
                      const isSkipped = status === "skipped";
                      const isDone = status === "done";
                      const isPending = status === "pending";
                      const isFuture = isPending && idx > firstPendingIdx;
                      const canSkip = isPending && !isCompleted;
                      const isExpanded = expandedSteps.has(step.id);
                      const isSelected = selectedStepIds.has(step.id);

                      const hasDetail = !!(
                        step.subject || step.body || step.templateName ||
                        step.message || step.smsTemplateName ||
                        step.note || step.senderIdentity || step.reminderDaysBefore
                      );

                      const isSendable = step.actionType === "email" || step.actionType === "sms";
                      const isPerListing = isSendable && effectiveSendMode(step) === "per-listing";

                      const timelineNode = isDone && isCompleted ? (
                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center shrink-0 z-10 ring-2 ring-background">
                          <CheckCircle2 className="h-4 w-4 text-gray-500" />
                        </div>
                      ) : isDone ? (
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shrink-0 z-10 ring-2 ring-background">
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        </div>
                      ) : isSkipped ? (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0 z-10 ring-2 ring-background">
                          <Ban className="h-4 w-4 text-gray-400" />
                        </div>
                      ) : isCurrentStep ? (
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 z-10 ring-2 ring-primary/30 ring-offset-1">
                          <MapPin className="h-4 w-4 text-primary-foreground" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-background border-2 border-border flex items-center justify-center shrink-0 z-10">
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                        </div>
                      );

                      const isCustom = !!(step as CustomWorkflowStep).isCustom;

                      const stepElement = (
                        <div key={step.id} className={`relative flex gap-3 mb-3 ${isSkipped ? "opacity-60" : ""}`}>
                          <div className="flex flex-col items-center shrink-0 pt-2">
                            {timelineNode}
                          </div>

                          <div className={`flex-1 min-w-0 rounded-lg border transition-all mb-1 ${
                            isCurrentStep
                              ? "border-primary/50 bg-primary/5 shadow-sm"
                              : isSkipped
                              ? "border-dashed border-gray-200 bg-muted/20"
                              : isCustom
                              ? "border-dashed border-violet-300 bg-violet-50/40"
                              : isSelected
                              ? "border-primary/30 bg-primary/5"
                              : isDone
                              ? "border-border bg-muted/20"
                              : "border-border bg-card"
                          }`}>
                            <div className="flex items-center gap-2 px-3 py-2.5">
                              {isEditing && (canSkip ? (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelect(step.id)}
                                  className="h-3.5 w-3.5 rounded border-gray-300 text-primary accent-primary cursor-pointer shrink-0"
                                />
                              ) : (
                                <div className="w-3.5 shrink-0" />
                              ))}

                              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                                isSkipped ? "bg-gray-100 text-gray-300" : isCustom ? "bg-violet-100 text-violet-600" : STEP_ICON_BG[step.actionType] ?? "bg-muted text-muted-foreground"
                              }`}>
                                {STEP_ICON[step.actionType]}
                              </div>

                              <button
                                onClick={() => {
                                  if (!hasDetail) return;
                                  setExpandedSteps((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(step.id)) { next.delete(step.id); } else { next.add(step.id); }
                                    return next;
                                  });
                                }}
                                disabled={!hasDetail}
                                className={`flex-1 min-w-0 flex items-center gap-2 text-left ${hasDetail ? "cursor-pointer" : "cursor-default"}`}
                              >
                                <span className={`text-sm font-medium truncate ${
                                  isSkipped ? "text-muted-foreground/60 line-through" : "text-foreground"
                                }`}>
                                  {step.name}
                                </span>
                                {isCustom && (
                                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium border border-violet-300 text-violet-600 bg-violet-50">
                                    Custom
                                  </span>
                                )}
                                <span className={`text-[11px] shrink-0 ${isSkipped ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
                                  {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
                                    new Date(new Date(enrollment.startDate).getTime() + step.dayOffset * 86_400_000)
                                  )}
                                </span>
                                {isPerListing && activeListing && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 shrink-0 whitespace-nowrap">
                                    For {activeListing.name}
                                  </span>
                                )}
                                {isPerListing && !activeListing && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 shrink-0 whitespace-nowrap">
                                    No matching listing
                                  </span>
                                )}
                                {hasDetail && !isSkipped && (
                                  isExpanded
                                    ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                                    : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                )}
                              </button>

                              <div className="flex items-center gap-2 shrink-0">
                                {isCurrentStep && (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-primary text-primary-foreground whitespace-nowrap">
                                    <MapPin className="h-2.5 w-2.5" />
                                    Current
                                  </span>
                                )}
                                {isDone && (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground whitespace-nowrap">
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    Done{progress?.completedAt ? ` · ${formatDate(progress.completedAt)}` : ""}
                                  </span>
                                )}
                                {isSkipped && (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-400 whitespace-nowrap">
                                    <Ban className="h-2.5 w-2.5" />
                                    Skipped
                                  </span>
                                )}
                                {isPending && !isCurrentStep && (
                                  <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground whitespace-nowrap">
                                    Upcoming
                                  </span>
                                )}
                                {isCurrentStep && !isDone && !isSkipped && (
                                  <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700 whitespace-nowrap">
                                    Pending
                                  </span>
                                )}

                                {isEditing && canSkip && !isSelected && (
                                  <button
                                    onClick={() => askConfirm(
                                      `Skip "${step.name}"?`,
                                      "This step will be marked as skipped. You can unskip it later.",
                                      () => { handleSkipStep(enrollment.id, step.id); toast.success(`"${step.name}" skipped`); },
                                    )}
                                    className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                                      isFuture
                                        ? "border-gray-200 text-muted-foreground hover:text-foreground hover:bg-muted"
                                        : "border-orange-200 text-orange-600 hover:bg-orange-50"
                                    }`}
                                  >
                                    <SkipForward className="h-3 w-3" />
                                    {isFuture ? "Mark Skip" : "Skip"}
                                  </button>
                                )}

                                {isEditing && isSkipped && (
                                  <button
                                    onClick={() => askConfirm(
                                      `Restore "${step.name}"?`,
                                      "This step will be marked as pending again.",
                                      () => { handleUnskipStep(enrollment.id, step.id); toast.success(`"${step.name}" restored`); },
                                    )}
                                    className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                  >
                                    <SkipForward className="h-3 w-3 rotate-180" />
                                    Unskip
                                  </button>
                                )}

                                {isCustom && (
                                  <button
                                    onClick={() => askConfirm(
                                      `Remove "${step.name}"?`,
                                      "This custom step will be permanently removed from this contact's journey.",
                                      () => { handleRemoveCustomStep(enrollment.id, step.id); toast.success(`"${step.name}" removed`); },
                                    )}
                                    className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>

                            {isExpanded && hasDetail && !isSkipped && (
                              <div className="mx-3 mb-3 rounded-md border border-border p-3 text-xs space-y-2 bg-muted/40">
                                {step.senderIdentity && (
                                  <div className="flex items-start gap-2">
                                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                    <span className="text-muted-foreground">From: <span className="text-foreground font-medium">{step.senderIdentity}</span></span>
                                  </div>
                                )}
                                {(step.templateName || step.smsTemplateName) && (
                                  <div className="flex items-start gap-2">
                                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                    <span className="text-muted-foreground">Template: <span className="text-foreground font-medium">{step.templateName ?? step.smsTemplateName}</span></span>
                                  </div>
                                )}
                                {step.subject && (
                                  <div className="flex items-start gap-2">
                                    <span className="text-muted-foreground shrink-0 font-medium w-14">Subject:</span>
                                    <span className="text-foreground">{step.subject}</span>
                                  </div>
                                )}
                                {step.message && (
                                  <div className="flex items-start gap-2">
                                    <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                    <span className="text-foreground">{step.message}</span>
                                  </div>
                                )}
                                {step.body && (
                                  <div className="pt-1 border-t border-border">
                                    <p className="text-muted-foreground mb-1 font-medium">Body:</p>
                                    <div className="prose prose-sm max-w-none text-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: step.body }} />
                                  </div>
                                )}
                                {step.note && (
                                  <div className="flex items-start gap-2">
                                    <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                    <span className="text-muted-foreground">Note: <span className="text-foreground">{step.note}</span></span>
                                  </div>
                                )}
                                {step.reminderDaysBefore !== undefined && (
                                  <div className="text-muted-foreground">
                                    Reminder <span className="text-foreground font-medium">{step.reminderDaysBefore}</span> day{step.reminderDaysBefore !== 1 ? "s" : ""} before due date
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );

                      // Insert zone between steps (hover "+" connector)
                      const actionInsertZone = showInsertZone && (
                        activeInsertPoint === step.id ? (
                          <div key={`ins-${step.id}`} className="ml-[52px] my-2 rounded-xl border-2 border-primary/30 bg-card shadow-sm z-10 relative">
                            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${insertDraft.actionType === "email" ? "border-emerald-500 text-emerald-600" : insertDraft.actionType === "sms" ? "border-purple-400 text-purple-600" : "border-blue-400 text-blue-600"}`}>
                                  <StepTypeIcon type={insertDraft.actionType} size="sm" />
                                </div>
                                <span className="text-sm font-semibold text-foreground">{insertDraft.name || STEP_DEFAULTS[insertDraft.actionType]}</span>
                              </div>
                              <button onClick={resetInsertForm} className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"><X className="h-4 w-4" /></button>
                            </div>
                            <div className="p-5">
                              <StepConfigFields draft={insertDraft} onChange={(p) => setInsertDraft((d) => ({ ...d, ...p }))} />
                              <div className="flex items-center gap-2 pt-5 mt-5 border-t border-border">
                                <button
                                  type="button"
                                  disabled={!insertDraft.name.trim()}
                                  onClick={() => {
                                    if (!insertDraft.name.trim()) return;
                                    setPendingCustomSteps((prev) => [...prev, { tempId: `tmp-${Date.now()}`, stepDef: { ...insertDraft }, insertAfterStepId: step.id }]);
                                    resetInsertForm();
                                  }}
                                  className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Plus className="h-3.5 w-3.5" /> Stage Step
                                </button>
                                <button type="button" onClick={resetInsertForm} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div key={`ins-${step.id}`} className="group relative h-5 flex items-center -my-0.5 z-10">
                            <div className="absolute left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setActiveInsertPoint(step.id); setInsertDraft(defaultInsertDraft()); }} className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-600 hover:bg-violet-100 shadow-sm whitespace-nowrap cursor-pointer">
                                <Plus className="h-2.5 w-2.5" /> Add step
                              </button>
                            </div>
                          </div>
                        )
                      );

                      const actionStagedCards = pendingCustomSteps.filter((p) => p.insertAfterStepId === step.id).map((pending) => (
                        <div key={pending.tempId} className="relative flex gap-3 mb-3 ml-[44px]">
                          <div className="flex flex-col items-center shrink-0 pt-2">
                            <div className="w-8 h-8 rounded-full bg-background border-2 border-dashed border-violet-400 flex items-center justify-center shrink-0 z-10">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${TYPE_ICON_BG[pending.stepDef.actionType]}`}>
                                <StepTypeIcon type={pending.stepDef.actionType} size="sm" />
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 rounded-lg border border-dashed border-violet-300 bg-violet-50/40 mb-1">
                            <div className="flex items-center gap-2 px-3 py-2.5">
                              <div className="w-3.5 shrink-0" />
                              <span className="text-sm font-medium text-foreground flex-1 truncate">{pending.stepDef.name || STEP_DEFAULTS[pending.stepDef.actionType]}</span>
                              <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium border border-violet-300 text-violet-600 bg-violet-50 whitespace-nowrap">Staged</span>
                              <button type="button" onClick={() => setPendingCustomSteps((prev) => prev.filter((p) => p.tempId !== pending.tempId))} className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ));

                      return [stepElement, actionInsertZone, ...actionStagedCards];
                    })}
                  </div>
                </div>
              )}

              {/* Activity Log tab */}
              {activeTab === "history" && (
                flowActivity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                    <Clock className="h-10 w-10 opacity-25" />
                    <p className="text-sm">No activity logged for this contact in this flow yet.</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#b8d4b8] text-foreground">
                          {["Changed at", "Changed by", "Event Type", "Detail"].map((col) => (
                            <th key={col} className="px-4 py-3 text-left text-xs font-semibold border-r border-[#a0c4a0] last:border-r-0">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-card">
                        {flowActivity.map((entry) => (
                          <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                              {formatDateTime(entry.timestamp)}
                            </td>
                            <td className="px-4 py-3 text-xs text-foreground whitespace-nowrap">
                              {entry.assignee ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-foreground whitespace-nowrap">
                              {EVENT_TYPE_LABEL[entry.type] ?? entry.type}
                            </td>
                            <td className="px-4 py-3 text-xs text-foreground">
                              {getDetail(entry)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          </div>

          {/* RIGHT — contact info sidebar */}
          <div className="w-72 shrink-0 overflow-y-auto px-5 py-5 space-y-5 bg-muted/10">
            {/* Avatar + name + type badge */}
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatarClass}`}>
                {getInitials(contact.firstName, contact.lastName)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to={`/crm/contacts/${contact.id}`}
                    className="text-sm font-semibold text-foreground hover:text-primary hover:underline"
                  >
                    {contact.firstName} {contact.lastName}
                  </Link>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${avatarClass}`}>
                  {contact.userType}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Email + phone */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Contact</p>
              <p className="text-xs text-foreground break-all">{contact.email}</p>
              {contact.phone && <p className="text-xs text-foreground">{contact.phone}</p>}
            </div>

            {/* Listings — all listings associated with this contact */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Listings</p>
              {(contact.listings?.length
                ? contact.listings
                : [{ id: "primary", name: contact.listingName, status: contact.listingStatus }]
              ).map((listing) => (
                <div key={listing.id} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-foreground truncate">{listing.name || "—"}</span>
                  <span className={`flex-shrink-0 inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${LISTING_STATUS_STYLES[listing.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {listing.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Enrollment status + date */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Enrollment</p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${enrollmentStatusStyle}`}>
                {enrollment.status.charAt(0).toUpperCase() + enrollment.status.slice(1)}
              </span>
              <p className="text-xs text-muted-foreground">Enrolled {formatDate(enrollment.startDate)}</p>
            </div>

            {/* Unread reply callout */}
            {unreadReplies > 0 && (
              <Link
                to={`/crm/contacts/${contact.id}`}
                className="flex items-start gap-2.5 w-full px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/25 hover:bg-primary/15 transition-colors text-left"
              >
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Mail className="h-2.5 w-2.5 text-primary-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-primary">
                    {unreadReplies} unread repl{unreadReplies === 1 ? "y" : "ies"}
                  </p>
                  <p className="text-[10px] text-primary/70 mt-0.5">
                    View in contact timeline →
                  </p>
                </div>
              </Link>
            )}

            {/* Pause / Resume */}
            {!isCompleted && (
              <button
                onClick={() => {
                  const next = isPaused ? "active" : "paused";
                  askConfirm(
                    isPaused ? "Resume contact?" : "Pause contact?",
                    isPaused
                      ? "The contact will be re-enrolled and continue from their current step."
                      : "The contact will be paused. No steps will advance until resumed.",
                    () => {
                      handleSetEnrollmentStatus(enrollment.id, next);
                      toast.success(next === "paused" ? "Contact paused in flow" : "Contact resumed in flow");
                    },
                  );
                }}
                className={`w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-md border transition-colors cursor-pointer ${
                  isPaused
                    ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                    : "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100"
                }`}
              >
                {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                {isPaused ? "Resume" : "Pause"}
              </button>
            )}

            {/* Move to step */}
            {!isCompleted && isEditing && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Move to step</p>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    const targetStep = val === "completed" ? null : actionSteps.find((s) => s.id === val);
                    const label = targetStep ? targetStep.name : "Completed";
                    askConfirm(
                      `Move contact to "${label}"?`,
                      "Steps before this will be marked done; steps after will be reset to pending.",
                      () => {
                        handleMoveToStep(enrollment.id, val as string);
                        toast.success(`Contact moved to "${label}"`);
                      },
                    );
                    e.target.value = "";
                  }}
                  className="w-full text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="">Select a step…</option>
                  {actionSteps.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                  <option value="completed">— Mark completed —</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirm !== null} onOpenChange={(v) => { if (!v) setConfirm(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirm(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              confirm?.onConfirm();
              setConfirm(null);
            }}
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
