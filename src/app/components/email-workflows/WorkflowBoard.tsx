import { useState, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import { ArrowLeft, LayoutGrid, List, Check, Search, Edit, Mail, MessageCircle, Phone, CheckCircle2, Zap, SkipForward, PauseCircle, X, ChevronDown, Square, Play, History, UserCheck, Clock, Trash2 } from "lucide-react";
import { WorkflowContactPanel } from "./WorkflowContactPanel";
import { toast } from "sonner";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "../ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "../ui/alert-dialog";
import { useAppData } from "../../contexts/AppDataContext";
import type { Application, Contact, WorkflowEnrollment, WorkflowStep } from "../../types";
import { CURRENT_USER } from "../../config/featureFlags";
import { resolveRunLabel, type WorkflowDimension } from "../../lib/workflowDimension";

const CARD_DRAG_TYPE = "WORKFLOW_CONTACT_CARD";

interface DragItem {
  enrollmentId: string;
  currentColumnId: string;
}

// ── helpers ────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  email: "Mark Sent",
  sms: "Mark Sent",
  "call-reminder": "Log Call",
};

const ACTION_TYPE_DISPLAY: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  "call-reminder": "Call Reminder",
};

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

function getCardStatus(opts: {
  enrollmentStatus: string;
  cantSend: boolean;
  isAutoStep: boolean;
  scheduledDate: Date | null;
}): { label: string; dotClass: string } {
  const { enrollmentStatus, cantSend, isAutoStep, scheduledDate } = opts;
  if (enrollmentStatus === "paused") return { label: "Paused", dotClass: "bg-amber-400" };
  if (cantSend) return { label: "Can't Send", dotClass: "bg-red-500" };
  if (!isAutoStep && scheduledDate) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const d = new Date(scheduledDate);
    d.setHours(0, 0, 0, 0);
    if (d <= now) return { label: "Task pending", dotClass: "bg-blue-500" };
  }
  const time = scheduledDate ? `${fmtDate(scheduledDate)}, ${fmtTime(scheduledDate)}` : null;
  const label = isAutoStep
    ? time ? `Will be sent at ${time}` : "Will be sent"
    : time ? `Task will be created at ${time}` : "Task will be created";
  return { label, dotClass: "bg-muted-foreground/40" };
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function getScheduleGroup(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (d < today) return "Overdue";
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

// ── Steps Timeline ─────────────────────────────────────────────────────────

const STEP_TYPE_CONFIG: Record<string, { icon: React.ReactNode; iconBg: string; iconColor: string; dayBg: string; dayColor: string }> = {
  email: {
    icon: <Mail className="h-3.5 w-3.5" />,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    dayBg: "bg-blue-50",
    dayColor: "text-blue-600",
  },
  sms: {
    icon: <MessageCircle className="h-3.5 w-3.5" />,
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    dayBg: "bg-violet-50",
    dayColor: "text-violet-600",
  },
  "call-reminder": {
    icon: <Phone className="h-3.5 w-3.5" />,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    dayBg: "bg-amber-50",
    dayColor: "text-amber-600",
  },
};

function StepsTimeline({ steps, enrollmentStats }: {
  steps: WorkflowStep[];
  enrollmentStats: { total: number; active: number; completed: number; paused: number };
}) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  if (sorted.length === 0) return null;

  const actionSteps = sorted.filter((s) => s.actionType !== "delay");
  const delaySteps = sorted.filter((s) => s.actionType === "delay");
  const totalDays = delaySteps.reduce((sum, s) => sum + (s.delayDays ?? 0), 0);
  const completionRate = enrollmentStats.total > 0
    ? Math.round((enrollmentStats.completed / enrollmentStats.total) * 100)
    : 0;

  const typeCount = actionSteps.reduce<Record<string, number>>((acc, s) => {
    acc[s.actionType] = (acc[s.actionType] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="border-b border-border bg-background">
      {/* Compact summary bar */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 px-6 py-2.5 hover:bg-muted/40 transition-colors text-left"
      >
        {/* Flow shape */}
        <span className="text-xs font-medium text-muted-foreground">{actionSteps.length} steps</span>
        <span className="text-muted-foreground/30 text-xs">·</span>
        <span className="text-xs text-muted-foreground">{totalDays}d total</span>
        <span className="text-muted-foreground/30 text-xs">·</span>
        <div className="flex items-center gap-1.5">
          {Object.entries(typeCount).map(([type, count]) => {
            const cfg = STEP_TYPE_CONFIG[type];
            if (!cfg) return null;
            return (
              <span key={type} className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.iconBg} ${cfg.iconColor}`}>
                {cfg.icon}
                {count}
              </span>
            );
          })}
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-border mx-1" />

        {/* Health stats */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{enrollmentStats.total}</span> enrolled
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-green-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            <span className="font-semibold">{enrollmentStats.active}</span> active
          </span>
          {enrollmentStats.paused > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              <span className="font-semibold">{enrollmentStats.paused}</span> paused
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
            <span className="font-semibold">{enrollmentStats.completed}</span> completed
          </span>
          {enrollmentStats.total > 0 && (
            <span className="text-xs font-semibold text-primary">{completionRate}% done</span>
          )}
        </div>

        <ChevronDown className={`ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
      </button>

      {/* Expanded full timeline */}
      {expanded && (
        <div className="px-6 pb-4 overflow-x-auto border-t border-border/60">
          <div className="flex items-end gap-0 min-w-max pt-3">
            {/* Start node */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 border border-gray-200 bg-white">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100 text-gray-500">
                  <UserCheck className="h-3 w-3" />
                </div>
                <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">Contact enrolled</span>
              </div>
            </div>
            {/* Connector from Start to first step */}
            <div className="flex items-center self-end mb-[22px]">
              <div className="flex items-center w-10">
                <div className="h-px flex-1 bg-border" />
                <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[5px] border-l-border" />
              </div>
            </div>
            {sorted.map((step) => {
              if (step.actionType === "delay") {
                return (
                  <div key={step.id} className="flex flex-col items-center gap-0.5 self-end mb-[22px]">
                    <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 whitespace-nowrap">
                      +{step.delayDays}d wait
                    </span>
                    <div className="flex items-center w-16">
                      <div className="h-px flex-1 bg-amber-300" />
                      <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[5px] border-l-amber-300" />
                    </div>
                  </div>
                );
              }
              const cfg = STEP_TYPE_CONFIG[step.actionType] ?? {
                icon: null,
                iconBg: "bg-muted",
                iconColor: "text-muted-foreground",
              };
              return (
                <div key={step.id} className="w-48 flex flex-col items-center">
                  <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 border border-border bg-card w-full">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.iconBg} ${cfg.iconColor}`}>
                      {cfg.icon}
                    </div>
                    <span className="text-xs font-semibold leading-tight text-foreground">{step.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ContactCard (kanban) ────────────────────────────────────────────────────



function ContactCard({
  contact,
  enrollmentId,
  columnId,
  currentStep,
  scheduledDate,
  enrollmentStatus,
  onCardClick,
  runLabel,
  runSublabel,
  objectKind,
}: {
  contact: Contact;
  enrollmentId: string;
  columnId: string;
  currentStep: WorkflowStep | null;
  scheduledDate: Date | null;
  enrollmentStatus: string;
  onCardClick: () => void;
  runLabel: string;
  runSublabel?: string;
  objectKind: string | null;
}) {
  const avatarClass = USER_TYPE_AVATAR[contact.userType] ?? "bg-gray-100 text-gray-700";
  const isCompleted = columnId === "completed";

  const [{ isDragging }, dragRef] = useDrag<DragItem, unknown, { isDragging: boolean }>({
    type: CARD_DRAG_TYPE,
    item: { enrollmentId, currentColumnId: columnId },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const isAutoStep = currentStep?.actionType === "email" || currentStep?.actionType === "sms";
  const isCallReminder = currentStep?.actionType === "call-reminder";
  const cantSend = isAutoStep && contact.optedOut;
  const accentClass = isCompleted
    ? "border-l-green-300"
    : currentStep?.actionType === "email"
      ? "border-l-blue-300"
      : currentStep?.actionType === "sms"
        ? "border-l-violet-300"
        : currentStep?.actionType === "call-reminder"
          ? "border-l-amber-300"
          : "border-l-border";

  const { label: statusLabel, dotClass } = getCardStatus({ enrollmentStatus, cantSend, isAutoStep, scheduledDate });

  // Show the run's dimension object (CRM-700) — contact, listing, or application depending on workflow.dimension
  const resolvedListing = { name: runLabel, status: runSublabel ?? "" };

  return (
    <div
      ref={dragRef}
      onClick={onCardClick}
      className={`rounded-lg border border-border border-l-2 ${accentClass} bg-card overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer active:cursor-grabbing${isDragging ? " opacity-40" : ""}`}
    >
      {/* Status bar */}
      <div className="px-3 py-2 flex items-center gap-1.5 bg-muted/60 rounded-t-lg border-b border-border/50">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
        <span className="text-[10px] font-medium text-muted-foreground tracking-wide">{statusLabel}</span>
      </div>

      {/* Header: avatar + name/email */}
      <div className="px-3 pt-2.5 pb-3">
        <div className="flex items-center gap-3">
          <div className={`w-[38px] h-[38px] rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatarClass}`}>
            {getInitials(contact.firstName, contact.lastName)}
          </div>
          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCardClick(); }}
              className="text-[15px] font-semibold text-foreground hover:text-primary hover:underline truncate block text-left w-full leading-tight"
            >
              {contact.firstName} {contact.lastName}
            </button>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{contact.email}</p>
          </div>
        </div>
        {((objectKind && resolvedListing.name) || (isCallReminder && !isCompleted)) && (
          <>
            <div className="border-t border-border mt-2.5 mb-2" />
          <div className="flex flex-col gap-1.5">
            {isCallReminder && !isCompleted && (
              <div className="flex gap-4 items-center">
                <span className="text-xs font-medium text-muted-foreground/50 w-[3.25rem] flex-shrink-0">Assignee</span>
                <span className="text-xs text-foreground truncate" title={CURRENT_USER}>{CURRENT_USER}</span>
              </div>
            )}
            {objectKind && resolvedListing.name && (
              <div className="flex gap-4 items-start">
                <span className="text-xs font-medium text-muted-foreground/50 w-[3.25rem] flex-shrink-0 leading-[1.5]">{objectKind}</span>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs text-foreground truncate" title={resolvedListing.name}>{resolvedListing.name}</span>
                    {resolvedListing.status && (
                      <span className={`flex-shrink-0 inline-block text-xs px-1.5 py-0.5 rounded font-medium leading-none ${LISTING_STATUS_STYLES[resolvedListing.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {resolvedListing.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── KanbanColumn ───────────────────────────────────────────────────────────

function KanbanColumn({
  colId,
  label,
  colEnrollments,
  contacts,
  currentStep,
  handleDrop,
  handleCardClick,
  dimension,
  applications,
}: {
  colId: string;
  label: string;
  colEnrollments: WorkflowEnrollment[];
  contacts: Contact[];
  currentStep: WorkflowStep | null;
  handleDrop: (enrollmentId: string, targetStepId: string) => void;
  handleCardClick: (contactId: string, enrollmentId: string) => void;
  dimension: WorkflowDimension;
  applications: Application[];
}) {
  const [{ isOver, canDrop }, dropRef] = useDrop<DragItem, unknown, { isOver: boolean; canDrop: boolean }>({
    accept: CARD_DRAG_TYPE,
    canDrop: (item) => item.currentColumnId !== colId,
    drop: (item) => handleDrop(item.enrollmentId, colId),
    collect: (monitor) => ({ isOver: monitor.isOver(), canDrop: monitor.canDrop() }),
  });

  const isActive = isOver && canDrop;
  const isAutoStep = currentStep && (currentStep.actionType === "email" || currentStep.actionType === "sms");

  return (
    <div className="w-80 flex-shrink-0 flex flex-col bg-white border border-border rounded-xl">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
            {label}
          </h3>
          {isAutoStep && (
            <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 leading-none uppercase tracking-wide">
              Auto
            </span>
          )}
        </div>
        <span className="ml-2 flex-shrink-0 text-xs font-medium bg-muted text-muted-foreground rounded-full px-2 py-0.5">
          {colEnrollments.length}
        </span>
      </div>
      <div
        ref={dropRef}
        className={`flex flex-col gap-2 flex-1 min-h-[120px] px-3 pb-3 rounded-b-xl transition-colors ${
          isActive ? "bg-primary/5 border-t border-dashed border-primary/40" : ""
        }`}
      >
        {colEnrollments.map((enrollment) => {
          const contact = contacts.find((c) => c.id === enrollment.contactId);
          if (!contact) return null;
          const scheduledDate = currentStep
            ? new Date(enrollment.startDate.getTime() + currentStep.dayOffset * 86_400_000)
            : null;
          const run = resolveRunLabel(dimension, enrollment.objectId, contact, applications);
          const objectKind = dimension === "CONTACT" ? null : dimension === "APPLICATION" ? "Application" : "Listing";
          return (
            <ContactCard
              key={enrollment.id}
              contact={contact}
              enrollmentId={enrollment.id}
              columnId={colId}
              currentStep={currentStep}
              scheduledDate={scheduledDate}
              enrollmentStatus={enrollment.status}
              onCardClick={() => handleCardClick(contact.id, enrollment.id)}
              runLabel={run.label}
              runSublabel={run.sublabel}
              objectKind={objectKind}
            />
          );
        })}
        {colEnrollments.length === 0 && (
          <div className={`rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground ${isActive ? "border-primary/40 text-primary/60" : "border-border"}`}>
            {isActive ? "Drop here" : "No contacts"}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Board ─────────────────────────────────────────────────────────────

type ViewMode = "kanban" | "list";

export function WorkflowBoard() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { workflows, workflowEnrollments, contacts, segments, applications, handleActivateWorkflow, handleAdvanceStep, handleMoveToStep, handleUpdateWorkflow, handleDeleteWorkflow, handleSkipStep, handleSetEnrollmentStatus, handleBulkSkipSteps, handleBulkSetEnrollmentStatus } = useAppData();

  const navState = location.state as { openContactId?: string; openEnrollmentId?: string } | null;

  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(navState?.openContactId ?? null);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(navState?.openEnrollmentId ?? null);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [enrollmentHistorySearch, setEnrollmentHistorySearch] = useState("");
  const [enrollmentHistoryStatusFilter, setEnrollmentHistoryStatusFilter] = useState<"all" | "active" | "paused" | "completed">("all");
  const [showAutomationsModal, setShowAutomationsModal] = useState(false);
  const [automationSearch, setAutomationSearch] = useState("");
  const [selectedAutomationKeys, setSelectedAutomationKeys] = useState<Set<string>>(new Set());

  // Shared filters (synced across kanban & list)
  const [search, setSearch] = useState("");
  const [stepFilter, setStepFilter] = useState<string>("all");

  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [boardTab, setBoardTab] = useState<"enrollment" | "settings">("enrollment");
  const [editingGeneral, setEditingGeneral] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [editName, setEditName] = useState(() => workflows.find((wf) => wf.id === id)?.name ?? "");
  const [editDesc, setEditDesc] = useState(() => workflows.find((wf) => wf.id === id)?.description ?? "");

  const [pauseConfirm, setPauseConfirm] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const workflow = workflows.find((wf) => wf.id === id);
  const dimension = useMemo<WorkflowDimension>(() => workflow?.dimension ?? "CONTACT", [workflow]);
  const myEnrollments = workflowEnrollments.filter((e) => e.workflowId === id);
  const sortedSteps = useMemo(
    () => [...(workflow?.steps ?? [])].sort((a, b) => a.order - b.order),
    [workflow],
  );
  const actionSteps = useMemo(
    () => sortedSteps.filter((s) => s.actionType !== "delay"),
    [sortedSteps],
  );

  const segment = segments.find((s) => s.id === workflow?.segmentId);

  // Map enrollment → column (first pending action step, or "completed")
  const getContactColumn = (enrollment: WorkflowEnrollment): string => {
    const firstPending = actionSteps.find(
      (step) => enrollment.stepProgress.find((p) => p.stepId === step.id)?.status === "pending",
    );
    return firstPending?.id ?? "completed";
  };

  const completedCount = useMemo(
    () => myEnrollments.filter((e) => {
      const firstPending = actionSteps.find(
        (step) => e.stepProgress.find((p) => p.stepId === step.id)?.status === "pending",
      );
      return firstPending === undefined;
    }).length,
    [myEnrollments, actionSteps],
  );

  const enrollmentStats = useMemo(() => ({
    total: myEnrollments.length,
    active: myEnrollments.filter((e) => e.status === "active").length,
    paused: myEnrollments.filter((e) => e.status === "paused").length,
    completed: completedCount,
  }), [myEnrollments, completedCount]);

  const handleAdvance = (enrollmentId: string, stepId: string) => {
    handleAdvanceStep(enrollmentId, stepId);
    toast.success("Step completed");
  };

  const handleDrop = (enrollmentId: string, targetStepId: string) => {
    handleMoveToStep(enrollmentId, targetStepId);
    toast.success("Contact moved");
  };


  // ── List view data (must be before any conditional returns) ────────────
  const listRows = useMemo(() => {
    return myEnrollments
      .map((enrollment) => {
        const contact = contacts.find((c) => c.id === enrollment.contactId);
        const firstPending = actionSteps.find(
          (step) => enrollment.stepProgress.find((p) => p.stepId === step.id)?.status === "pending",
        );
        const colStepId = firstPending?.id ?? "completed";
        const currentStep = actionSteps.find((s) => s.id === colStepId) ?? null;
        return { enrollment, contact, currentStep, colStepId };
      })
      .filter(({ contact, colStepId, enrollment }) => {
        if (search) {
          const q = search.toLowerCase();
          const name = contact ? `${contact.firstName} ${contact.lastName}`.toLowerCase() : "";
          const email = contact?.email.toLowerCase() ?? "";
          if (!name.includes(q) && !email.includes(q)) return false;
        }
        if (stepFilter !== "all" && colStepId !== stepFilter) return false;
        if (statusFilter !== "all" && enrollment.status !== statusFilter) return false;
        return true;
      });
  }, [myEnrollments, contacts, actionSteps, search, stepFilter, statusFilter]);

  const allEnrollmentRows = useMemo(() => {
    return myEnrollments
      .filter((e) => {
        const firstPending = actionSteps.find(
          (step) => e.stepProgress.find((p) => p.stepId === step.id)?.status === "pending",
        );
        const displayStatus = firstPending === undefined ? "completed" : e.status;
        if (enrollmentHistoryStatusFilter !== "all" && displayStatus !== enrollmentHistoryStatusFilter) return false;
        if (enrollmentHistorySearch) {
          const contact = contacts.find((c) => c.id === e.contactId);
          const q = enrollmentHistorySearch.toLowerCase();
          const name = contact ? `${contact.firstName} ${contact.lastName}`.toLowerCase() : "";
          const email = contact?.email.toLowerCase() ?? "";
          if (!name.includes(q) && !email.includes(q)) return false;
        }
        return true;
      })
      .map((enrollment) => {
        const contact = contacts.find((c) => c.id === enrollment.contactId);
        const firstPending = actionSteps.find(
          (step) => enrollment.stepProgress.find((p) => p.stepId === step.id)?.status === "pending",
        );
        const displayStatus = firstPending === undefined ? "completed" : enrollment.status;
        return { enrollment, contact, displayStatus };
      });
  }, [myEnrollments, contacts, actionSteps, enrollmentHistorySearch, enrollmentHistoryStatusFilter]);

  const upcomingAutomations = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const items = myEnrollments
      .filter((e) => e.status === "active")
      .map((enrollment) => {
        const contact = contacts.find((c) => c.id === enrollment.contactId);
        const firstPending = actionSteps.find(
          (step) => enrollment.stepProgress.find((p) => p.stepId === step.id)?.status === "pending",
        );
        if (!firstPending || (firstPending.actionType !== "email" && firstPending.actionType !== "sms")) return null;
        const scheduledDate = new Date(enrollment.startDate.getTime() + firstPending.dayOffset * 86_400_000);
        return { enrollment, contact, step: firstPending, scheduledDate };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const upcoming = items
      .filter((r) => r.scheduledDate >= todayStart)
      .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());
    const overdue = items
      .filter((r) => r.scheduledDate < todayStart)
      .sort((a, b) => b.scheduledDate.getTime() - a.scheduledDate.getTime());

    return [...upcoming, ...overdue];
  }, [myEnrollments, contacts, actionSteps]);

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Workflow not found.
      </div>
    );
  }


  return (
    <div className="flex flex-col h-full bg-background">
      {/* Enrollment history modal */}
      <Dialog open={showCompletedModal} onOpenChange={(open) => { setShowCompletedModal(open); if (!open) { setEnrollmentHistorySearch(""); setEnrollmentHistoryStatusFilter("all"); } }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Enrollment History</DialogTitle>
          </DialogHeader>
          {/* Filters */}
          <div className="flex items-center gap-2 mt-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={enrollmentHistorySearch}
                onChange={(e) => setEnrollmentHistorySearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <select
              value={enrollmentHistoryStatusFilter}
              onChange={(e) => setEnrollmentHistoryStatusFilter(e.target.value as "all" | "active" | "paused" | "completed")}
              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="overflow-auto flex-1 mt-2">
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    {["Contact", "Status", "Start Date"].map((col) => (
                      <th key={col} className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {allEnrollmentRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-muted-foreground text-sm">
                        No enrollments found.
                      </td>
                    </tr>
                  ) : (
                    allEnrollmentRows.map(({ enrollment, contact, displayStatus }) => (
                      <tr
                        key={enrollment.id}
                        onClick={() => {
                          if (contact) {
                            setSelectedContactId(contact.id);
                            setSelectedEnrollmentId(enrollment.id);
                            setShowCompletedModal(false);
                          }
                        }}
                        className="hover:bg-muted/10 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3">
                          {contact ? (
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${USER_TYPE_AVATAR[contact.userType] ?? "bg-gray-100 text-gray-700"}`}>
                                {getInitials(contact.firstName, contact.lastName)}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{contact.firstName} {contact.lastName}</p>
                                <p className="text-xs text-muted-foreground">{contact.email}</p>
                                {enrollment.objectId && contact && (() => {
                                  const run = resolveRunLabel(dimension, enrollment.objectId, contact, applications);
                                  return (
                                    <p className="text-[11px] text-muted-foreground/80">
                                      {dimension === "APPLICATION" ? "Application" : "Listing"}: {run.label}{run.sublabel ? ` · ${run.sublabel}` : ""}
                                    </p>
                                  );
                                })()}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Unknown contact</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {displayStatus === "completed" && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                              <Check className="h-3 w-3" /> Completed
                            </span>
                          )}
                          {displayStatus === "active" && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                              <Play className="h-3 w-3" /> Active
                            </span>
                          )}
                          {displayStatus === "paused" && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                              <PauseCircle className="h-3 w-3" /> Paused
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground text-xs">
                          {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(enrollment.startDate)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upcoming automations modal */}
      <Dialog open={showAutomationsModal} onOpenChange={(open) => { setShowAutomationsModal(open); if (!open) { setAutomationSearch(""); setSelectedAutomationKeys(new Set()); } }}>
        <DialogContent className="max-w-3xl h-[80vh] overflow-hidden flex flex-col">
          {/* X close button */}
          <DialogClose className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground">
            <X className="h-4 w-4" />
          </DialogClose>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Upcoming Automations ({upcomingAutomations.length})
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1">Sorted by nearest schedule. Skip a step or pause the enrollment to stop delivery.</p>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={automationSearch}
              onChange={(e) => { setAutomationSearch(e.target.value); setSelectedAutomationKeys(new Set()); }}
              placeholder="Search by contact name or email..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {(() => {
            const filtered = automationSearch
              ? upcomingAutomations.filter(({ contact }) => {
                  const q = automationSearch.toLowerCase();
                  const name = contact ? `${contact.firstName} ${contact.lastName}`.toLowerCase() : "";
                  return name.includes(q) || (contact?.email.toLowerCase().includes(q) ?? false);
                })
              : upcomingAutomations;
            const allRowKeys = filtered.map(({ enrollment, step }) => `${enrollment.id}::${step.id}`);
            const allSelected = allRowKeys.length > 0 && allRowKeys.every((k) => selectedAutomationKeys.has(k));
            const someSelected = allRowKeys.some((k) => selectedAutomationKeys.has(k));
            const toggleAll = () => {
              if (allSelected) {
                setSelectedAutomationKeys(new Set());
              } else {
                setSelectedAutomationKeys(new Set(allRowKeys));
              }
            };
            const toggleRow = (key: string) => {
              setSelectedAutomationKeys((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key); else next.add(key);
                return next;
              });
            };
            return (
              <>
                {selectedAutomationKeys.size > 0 && (
                  <div className="flex items-center gap-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg text-xs">
                    <span className="font-medium text-foreground flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-primary" />
                      {selectedAutomationKeys.size} selected
                    </span>
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={() => {
                          const items = filtered
                            .filter(({ enrollment, step }) => selectedAutomationKeys.has(`${enrollment.id}::${step.id}`))
                            .map(({ enrollment, step }) => ({ enrollmentId: enrollment.id, stepId: step.id }));
                          handleBulkSkipSteps(items);
                          setSelectedAutomationKeys(new Set());
                          toast.success(`Skipped ${items.length} step${items.length !== 1 ? "s" : ""}`);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded border border-border bg-background hover:bg-muted transition-colors text-muted-foreground"
                      >
                        <SkipForward className="h-3 w-3" />
                        Skip Selected
                      </button>
                      <button
                        onClick={() => {
                          const enrollmentIds = [...new Set(
                            filtered
                              .filter(({ enrollment, step }) => selectedAutomationKeys.has(`${enrollment.id}::${step.id}`))
                              .map(({ enrollment }) => enrollment.id),
                          )];
                          setPauseConfirm({
                            title: `Pause ${enrollmentIds.length} enrollment${enrollmentIds.length !== 1 ? "s" : ""}?`,
                            description: `These contacts will stop receiving automated steps immediately. No emails or SMS will be sent until the enrollment is manually resumed. This does not remove contacts from the flow.`,
                            onConfirm: () => {
                              handleBulkSetEnrollmentStatus(enrollmentIds, "paused");
                              setSelectedAutomationKeys(new Set());
                              toast.success(`Paused ${enrollmentIds.length} enrollment${enrollmentIds.length !== 1 ? "s" : ""}`);
                            },
                          });
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded border border-border bg-background hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors text-muted-foreground"
                      >
                        <PauseCircle className="h-3 w-3" />
                        Pause Selected
                      </button>
                      <button
                        onClick={() => setSelectedAutomationKeys(new Set())}
                        className="flex items-center gap-1 px-2.5 py-1 rounded border border-border bg-background hover:bg-muted transition-colors text-muted-foreground"
                      >
                        <X className="h-3 w-3" />
                        Clear
                      </button>
                    </div>
                  </div>
                )}
                <div className="overflow-auto flex-1">
                  {filtered.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm">No upcoming automated steps.</div>
                  ) : (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 border-b border-border sticky top-0">
                          <tr>
                            <th className="pl-4 pr-2 py-3 w-8">
                              <button
                                onClick={toggleAll}
                                className="w-4 h-4 rounded border border-border bg-background flex items-center justify-center hover:border-primary transition-colors"
                                title={allSelected ? "Deselect all" : "Select all"}
                              >
                                {allSelected ? (
                                  <Check className="h-2.5 w-2.5 text-primary" />
                                ) : someSelected ? (
                                  <Square className="h-2.5 w-2.5 text-primary fill-primary/30" />
                                ) : null}
                              </button>
                            </th>
                            {["Contact", "Step", "Scheduled", "Actions"].map((col) => (
                              <th key={col} className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-card">
                          {(() => {
                            const groups = new Map<string, typeof upcomingAutomations>();
                            for (const item of filtered) {
                              const label = getScheduleGroup(item.scheduledDate);
                              if (!groups.has(label)) groups.set(label, []);
                              groups.get(label)!.push(item);
                            }
                            return [...groups.entries()].flatMap(([label, groupItems]) => [
                              <tr key={`group-${label}`}>
                                <td colSpan={5} className="px-5 py-2 bg-muted/60 border-y border-border">
                                  <span className={`text-xs font-semibold uppercase tracking-wide ${label === "Today" ? "text-amber-600" : label === "Overdue" ? "text-red-600" : "text-muted-foreground"}`}>
                                    {label}
                                  </span>
                                </td>
                              </tr>,
                              ...groupItems.map(({ enrollment, contact, step, scheduledDate }) => {
                                const rowKey = `${enrollment.id}::${step.id}`;
                                const isSelected = selectedAutomationKeys.has(rowKey);
                                return (
                                  <tr
                                    key={`${enrollment.id}-${step.id}`}
                                    className={`hover:bg-muted/10 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                                  >
                                    <td className="pl-4 pr-2 py-3 w-8">
                                      <button
                                        onClick={() => toggleRow(rowKey)}
                                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? "border-primary bg-primary" : "border-border bg-background hover:border-primary"}`}
                                        title={isSelected ? "Deselect" : "Select"}
                                      >
                                        {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                                      </button>
                                    </td>
                                    <td className="px-5 py-3">
                                      {contact ? (
                                        <div className="flex items-center gap-2">
                                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${USER_TYPE_AVATAR[contact.userType] ?? "bg-gray-100 text-gray-700"}`}>
                                            {getInitials(contact.firstName, contact.lastName)}
                                          </div>
                                          <div>
                                            <p className="font-medium text-foreground text-xs">{contact.firstName} {contact.lastName}</p>
                                            <p className="text-[11px] text-muted-foreground">{contact.email}</p>
                                            {enrollment.objectId && contact && (() => {
                                              const run = resolveRunLabel(dimension, enrollment.objectId, contact, applications);
                                              return (
                                                <p className="text-[11px] text-muted-foreground/80">
                                                  {dimension === "APPLICATION" ? "Application" : "Listing"}: {run.label}{run.sublabel ? ` · ${run.sublabel}` : ""}
                                                </p>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground text-xs">Unknown</span>
                                      )}
                                    </td>
                                    <td className="px-5 py-3">
                                      <div className="flex items-center gap-1.5">
                                        {step.actionType === "email" ? (
                                          <Mail className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                                        ) : (
                                          <MessageCircle className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
                                        )}
                                        <span className="text-xs text-foreground truncate max-w-[160px]">{step.name}</span>
                                      </div>
                                    </td>
                                    <td className="px-5 py-3 whitespace-nowrap">
                                      <p className="text-xs font-medium text-foreground">{fmtDate(scheduledDate)}</p>
                                      <p className="text-[11px] text-muted-foreground">{fmtTime(scheduledDate)}</p>
                                    </td>
                                    <td className="px-5 py-3">
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => {
                                            handleSkipStep(enrollment.id, step.id);
                                            toast.success(`Step skipped for ${contact?.firstName ?? "contact"}`);
                                          }}
                                          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors text-muted-foreground"
                                          title="Skip this step"
                                        >
                                          <SkipForward className="h-3 w-3" />
                                          Skip
                                        </button>
                                        <button
                                          onClick={() => {
                                            const name = contact ? `${contact.firstName} ${contact.lastName}` : "this contact";
                                            setPauseConfirm({
                                              title: `Pause enrollment for ${name}?`,
                                              description: `${name} will stop receiving automated steps immediately. No emails or SMS will be sent until the enrollment is manually resumed. Their progress is saved and they can be reactivated at any time.`,
                                              onConfirm: () => {
                                                handleSetEnrollmentStatus(enrollment.id, "paused");
                                                toast.success(`Enrollment paused for ${contact?.firstName ?? "contact"}`);
                                              },
                                            });
                                          }}
                                          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors text-muted-foreground"
                                          title="Pause entire enrollment"
                                        >
                                          <PauseCircle className="h-3 w-3" />
                                          Pause
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              }),
                            ]);
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <WorkflowContactPanel
        open={selectedContactId !== null}
        contactId={selectedContactId}
        enrollmentId={selectedEnrollmentId}
        workflowId={workflow.id}
        onClose={() => { setSelectedContactId(null); setSelectedEnrollmentId(null); }}
      />
      {/* Sticky header */}
      <div className="border-b border-border bg-card px-8 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => navigate("/email-workflows/flows")}
          className="p-1.5 rounded hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex items-center justify-between flex-1 gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-xl font-semibold text-foreground">{workflow.name}</h2>
            <span className="text-xs text-muted-foreground">
              {workflow.description || "No description"}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={`px-3 py-0.5 rounded-full text-xs ${
                workflow.status === "active"
                  ? "bg-green-100 text-green-700 border border-green-200"
                  : "bg-gray-100 text-gray-700 border border-gray-200"
              }`}
            >
              {workflow.status === "active" ? "Active" : workflow.status === "draft" ? "Draft" : "Paused"}
            </span>
            {segment && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Applied segment:</span>
                <span className={`text-xs font-medium rounded-md px-2 py-0.5 border ${
                  segment.status === "Inactive"
                    ? "text-gray-500 bg-gray-100 border-gray-200"
                    : "text-primary bg-primary/10 border-primary/20"
                }`}>
                  {segment.name}
                </span>
                {segment.status === "Inactive" && (
                  <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">
                    Inactive
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border bg-card px-8 flex gap-1">
        {(["enrollment", "settings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setBoardTab(tab)}
            className={`relative px-4 py-3 text-sm transition-colors capitalize ${
              boardTab === tab
                ? "font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
            {boardTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {boardTab === "enrollment" && (
        <>
          <StepsTimeline steps={sortedSteps} enrollmentStats={enrollmentStats} />
          {viewMode === "kanban" ? (
        /* ── Kanban view ─────────────────────────────────────────────────── */
        <DndProvider backend={HTML5Backend}>
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar row — stays fixed while columns scroll horizontally */}
            <div className="flex items-center gap-3 px-6 pt-4 pb-2 flex-wrap flex-shrink-0">
              {/* View toggle */}
              <div className="flex rounded-md border border-input overflow-hidden flex-shrink-0">
                <button
                  onClick={() => setViewMode("kanban")}
                  className="px-3 py-1.5 transition-colors bg-primary text-primary-foreground"
                  title="Kanban view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className="px-3 py-1.5 border-l border-input transition-colors bg-background text-muted-foreground hover:bg-muted"
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
              {/* Search */}
              <div className="relative flex-1 min-w-40 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search contacts..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">All enrollment statuses</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setShowAutomationsModal(true)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors text-amber-700"
                >
                  <Zap className="h-3.5 w-3.5" />
                  {`Automations (${upcomingAutomations.length})`}
                </button>
                <button
                  onClick={() => setShowCompletedModal(true)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
                >
                  <History className="h-3.5 w-3.5" />
                  Enrollment History
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-x-auto">
            <div
              className="flex gap-4 p-6 min-h-full items-start"
              style={{ minWidth: `${actionSteps.length * 288}px` }}
            >
              {actionSteps.map((s, i) => {
                return { id: s.id, label: `Step ${i + 1} — ${ACTION_TYPE_DISPLAY[s.actionType] ?? s.actionType}`, step: s as WorkflowStep };
              })
              .map(({ id: colId, label, step }) => {
                  const colEnrollments = myEnrollments.filter((e) => {
                    if (getContactColumn(e) !== colId) return false;
                    if (statusFilter !== "all" && e.status !== statusFilter) return false;
                    if (search) {
                      const contact = contacts.find((c) => c.id === e.contactId);
                      if (!contact) return false;
                      const q = search.toLowerCase();
                      const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
                      if (!fullName.includes(q) && !contact.email.toLowerCase().includes(q)) return false;
                    }
                    return true;
                  });
                  return (
                    <KanbanColumn
                      key={colId}
                      colId={colId}
                      label={label}
                      colEnrollments={colEnrollments}
                      contacts={contacts}
                      currentStep={step}
                      handleDrop={handleDrop}
                      handleCardClick={(cId, eId) => { setSelectedContactId(cId); setSelectedEnrollmentId(eId); }}
                      dimension={workflow.dimension ?? "CONTACT"}
                      applications={applications}
                    />
                  );
                },
              )}
            </div>
            </div>
          </div>
        </DndProvider>
      ) : (
        /* ── List view ───────────────────────────────────────────────────── */
        <div className="flex-1 overflow-auto flex flex-col">
          {/* Filters */}
          <div className="flex items-center gap-3 px-6 pt-4 pb-3 flex-wrap border-b border-border">
            {/* View toggle */}
            <div className="flex rounded-md border border-input overflow-hidden flex-shrink-0">
              <button
                onClick={() => setViewMode("kanban")}
                className="px-3 py-1.5 transition-colors bg-background text-muted-foreground hover:bg-muted"
                title="Kanban view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className="px-3 py-1.5 border-l border-input transition-colors bg-primary text-primary-foreground"
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <div className="relative flex-1 min-w-40 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <select
              value={stepFilter}
              onChange={(e) => setStepFilter(e.target.value)}
              className="text-xs border border-border rounded-lg bg-background px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 text-muted-foreground"
            >
              <option value="all">All Steps</option>
              {actionSteps.map((s, i) => (
                <option key={s.id} value={s.id}>
                  Step {i + 1} — {ACTION_TYPE_DISPLAY[s.actionType] ?? s.actionType}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-border rounded-lg bg-background px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 text-muted-foreground"
            >
              <option value="all">All enrollment statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="paused">Paused</option>
            </select>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setShowAutomationsModal(true)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors text-amber-700"
              >
                <Zap className="h-3.5 w-3.5" />
                {`Automations (${upcomingAutomations.length})`}
              </button>
              <button
                onClick={() => setShowCompletedModal(true)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {`Show Completed (${completedCount})`}
              </button>
            </div>
          </div>
          {/* Table */}
          <div className="px-8 py-4 flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto">
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    {["Actions", "Contact", "Current Step", "Enrollment Status", "Start Date"].map((col) => (
                      <th key={col} className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {listRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground text-sm">
                        {myEnrollments.length === 0
                          ? "No contacts enrolled yet. Contacts matching this flow's segment will appear here once enrolled."
                          : "No contacts match the current filters."}
                      </td>
                    </tr>
                  ) : (
                    listRows.map(({ enrollment, contact, currentStep, colStepId }) => (
                      <tr
                        key={enrollment.id}
                        onClick={() => contact && (setSelectedContactId(contact.id), setSelectedEnrollmentId(enrollment.id))}
                        className="hover:bg-muted/10 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3">
                          {currentStep && colStepId !== "completed" ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAdvance(enrollment.id, currentStep.id); }}
                              className="text-xs px-2.5 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-colors"
                            >
                              {ACTION_LABELS[currentStep.actionType] ?? currentStep.actionType}
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {contact ? (
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${USER_TYPE_AVATAR[contact.userType] ?? "bg-gray-100 text-gray-700"}`}>
                                {getInitials(contact.firstName, contact.lastName)}
                              </div>
                              <div>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setSelectedContactId(contact.id); setSelectedEnrollmentId(enrollment.id); }}
                                  className="font-medium text-foreground hover:text-primary hover:underline text-left"
                                >
                                  {contact.firstName} {contact.lastName}
                                </button>
                                <p className="text-xs text-muted-foreground">{contact.email}</p>
                                {enrollment.objectId && contact && (() => {
                                  const run = resolveRunLabel(dimension, enrollment.objectId, contact, applications);
                                  return (
                                    <p className="text-[11px] text-muted-foreground/80">
                                      {dimension === "APPLICATION" ? "Application" : "Listing"}: {run.label}{run.sublabel ? ` · ${run.sublabel}` : ""}
                                    </p>
                                  );
                                })()}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Unknown contact</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground text-xs">
                          {colStepId === "completed" ? (
                            <span className="flex items-center gap-1 text-green-600 font-medium">
                              <Check className="h-3.5 w-3.5" /> Completed
                            </span>
                          ) : currentStep ? (
                            <div className="flex items-center gap-2">
                              <span>{`Day ${currentStep.dayOffset} — ${ACTION_TYPE_DISPLAY[currentStep.actionType] ?? currentStep.actionType}`}</span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary leading-none">
                                Day {Math.floor((Date.now() - new Date(enrollment.startDate).getTime()) / 86_400_000)}
                              </span>
                            </div>
                          ) : "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            enrollment.status === "active"
                              ? "bg-green-100 text-green-700 border border-green-200"
                              : enrollment.status === "completed"
                                ? "bg-gray-100 text-gray-600 border border-gray-200"
                                : "bg-yellow-100 text-yellow-700 border border-yellow-200"
                          }`}>
                            {enrollment.status.charAt(0).toUpperCase() + enrollment.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground text-xs">
                          {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(enrollment.startDate)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {boardTab === "settings" && (
        <div className="flex-1 overflow-auto px-8 py-6">
          <div className="max-w-2xl mx-auto space-y-6">

            {/* Summary */}
            {(() => {
              const allSteps = [...workflow.steps].sort((a, b) => a.order - b.order);
              const runStarted = myEnrollments.length > 0
                ? new Date(Math.min(...myEnrollments.map((e) => new Date(e.startDate).getTime())))
                : workflow.createdAt;
              const lastUpdate = myEnrollments.length > 0
                ? new Date(Math.max(...myEnrollments.map((e) => new Date(e.startDate).getTime())))
                : workflow.createdAt;
              const fmtFull = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + ", " + fmtTime(d);
              const STEP_LIMIT = 4;
              const visibleSteps = summaryExpanded ? allSteps : allSteps.slice(0, STEP_LIMIT);
              let actionIdx = 0;
              return (
                <div className="bg-card border border-border rounded-xl px-6 py-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Summary</p>
                  <div className="space-y-2 mb-5">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground w-32 flex-shrink-0">Segment</span>
                      <span className="font-medium text-primary">{workflow.segmentName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground w-32 flex-shrink-0">Run started at</span>
                      <span className="font-medium text-foreground">{fmtFull(runStarted)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground w-32 flex-shrink-0">Last run update</span>
                      <span className="font-medium text-foreground">{fmtFull(lastUpdate)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {visibleSteps.map((step) => {
                      if (step.actionType === "delay") {
                        return (
                          <div key={step.id} className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-50 text-amber-500">
                              <Clock className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-sm text-muted-foreground">
                              Wait {step.delayDays ? `${step.delayDays}d` : ""}{step.delayHours ? ` ${step.delayHours}h` : ""}{step.delayMinutes ? ` ${step.delayMinutes}m` : ""}
                            </span>
                          </div>
                        );
                      }
                      actionIdx += 1;
                      const cfg = STEP_TYPE_CONFIG[step.actionType];
                      return (
                        <div key={step.id} className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg?.iconBg ?? "bg-gray-100"} ${cfg?.iconColor ?? "text-gray-600"}`}>
                            {cfg?.icon ?? null}
                          </div>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md flex-shrink-0">Step {actionIdx}</span>
                          <span className="text-sm text-foreground truncate">{step.name}</span>
                        </div>
                      );
                    })}
                  </div>
                  {allSteps.length > STEP_LIMIT && (
                    <button
                      onClick={() => setSummaryExpanded((v) => !v)}
                      className="mt-3 text-xs font-medium text-primary hover:underline"
                    >
                      {summaryExpanded ? "Show less" : `Show all ${allSteps.length} steps`}
                    </button>
                  )}
                </div>
              );
            })()}

            {/* General */}
            <div className="bg-card border border-border rounded-xl px-6 py-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  General
                </p>
                {!editingGeneral ? (
                  <button
                    onClick={() => { setEditName(workflow.name); setEditDesc(workflow.description ?? ""); setEditingGeneral(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingGeneral(false)}
                      className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={!editName.trim()}
                      onClick={() => {
                        handleUpdateWorkflow(workflow.id, { name: editName.trim(), description: editDesc.trim() });
                        setEditingGeneral(false);
                      }}
                      className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
              {!editingGeneral ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Name</p>
                    <p className="text-sm text-foreground">{workflow.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                    <p className="text-sm text-muted-foreground">{workflow.description || "No description"}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Flow name"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                    <input
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Add a description…"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="bg-card border border-border rounded-xl px-6 py-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Status
              </p>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className={`text-sm font-semibold ${workflow.status === "active" ? "text-green-700" : "text-muted-foreground"}`}>
                    {workflow.status === "active" ? "Active" : workflow.status === "draft" ? "Draft" : "Paused"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {workflow.status === "active"
                      ? "This flow is live and contacts will be enrolled automatically."
                      : "This flow is paused and will not enroll new contacts."}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (workflow.status !== "active") {
                      handleActivateWorkflow(workflow.id);
                      toast.success("Flow activated — contacts enrolled");
                    } else {
                      setPauseConfirm({
                        title: "Pause this flow?",
                        description: "All active enrollments will stop progressing immediately. No emails, SMS, or call reminders will be sent until the flow is reactivated. Contacts remain enrolled and will resume from where they left off once the flow is turned back on.",
                        onConfirm: () => {
                          handleUpdateWorkflow(workflow.id, { status: "paused" });
                          toast.success("Flow paused");
                        },
                      });
                    }
                  }}
                  title={workflow.status === "active" ? "Deactivate flow" : "Activate flow"}
                  className="flex items-center gap-2 flex-shrink-0"
                >
                  <div className="relative rounded-full bg-transparent" style={{ height: "18px", width: "32px" }}>
                    <div className={`absolute inset-0 rounded-full transition-colors duration-200 ${workflow.status === "active" ? "bg-green-500" : "bg-gray-300"}`} />
                    <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all duration-200 ${workflow.status === "active" ? "left-[14px]" : "left-0.5"}`} />
                  </div>
                </button>
              </div>
            </div>

            {/* Flow configuration */}
            <div className="bg-card border border-border rounded-xl px-6 py-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Flow Configuration
                </p>
                <button
                  onClick={() => navigate(`/email-workflows/flows/${workflow.id}/edit`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit Flow
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Modify steps, timing, and templates for this flow.
              </p>
            </div>

            {/* Danger zone */}
            <div className="bg-card border border-red-200 rounded-xl px-6 py-5">
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-4">Danger Zone</p>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Delete this flow</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Permanently removes the flow and all enrollment records. This cannot be undone.
                  </p>
                </div>
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Flow
                </button>
              </div>
            </div>

          </div>
        </div>
      )}


      {/* Delete flow confirm modal */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete this flow?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">{workflow?.name}</span> and all its enrollment records will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!workflow) return;
                handleDeleteWorkflow(workflow.id);
                toast.success("Flow deleted");
                navigate("/email-workflows");
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Flow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pause confirm modal */}
      <AlertDialog open={pauseConfirm !== null} onOpenChange={(open) => { if (!open) setPauseConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <PauseCircle className="h-5 w-5 text-amber-500" />
              {pauseConfirm?.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pauseConfirm?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { pauseConfirm?.onConfirm(); setPauseConfirm(null); }}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              Pause
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
