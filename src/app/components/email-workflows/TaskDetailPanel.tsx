import { useState } from "react";
import { Link } from "react-router";
import {
  X,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PauseCircle,
  CalendarDays,
  User2,
  Workflow,
  Tag,
  FileText,
  RefreshCw,
  Check,
} from "lucide-react";
import type { Contact, TaskItem } from "@/app/types";
import { getTaskTypeConfig } from "@/app/lib/taskTypeRegistry";
import { useDialer } from "@/app/contexts/DialerContext";
import { useAppData } from "@/app/contexts/AppDataContext";
import { OutcomeCapturePanel } from "./OutcomeCapturePanel";
import { ContactContextPanel } from "./ContactContextPanel";
import { CreateTaskModal } from "./CreateTaskModal";
import { QuickEmailModal } from "./QuickEmailModal";

const TEAM_MEMBERS = ["John Doe", "Mike Johnson", "Sarah Chen"];

type EditingField = "dueDate" | "assignee" | "objective" | null;

interface TaskDetailPanelProps {
  task: TaskItem | null;
  isOpen: boolean;
  onClose: () => void;
  contactPhone?: string;
  contactEmail?: string;
  contactListingName?: string;
  /** V2 (RFC-008): full contact — powers the Contact Context panel. */
  contact?: Contact | null;
}

function formatDateTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function toDatetimeLocal(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function StatusValue({ task }: { task: TaskItem }) {
  const now = new Date();
  const isOverdue =
    task.status !== "completed" &&
    task.status !== "suspended" &&
    new Date(task.dueDate) < now;

  if (task.status === "completed")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-md font-medium">
        <CheckCircle2 className="w-3 h-3" /> Done
      </span>
    );
  if (task.status === "suspended")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 bg-gray-100 text-gray-500 rounded-md font-medium">
        <PauseCircle className="w-3 h-3" /> Paused
      </span>
    );
  if (isOverdue)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 bg-red-100 text-red-600 rounded-md font-medium">
        <AlertTriangle className="w-3 h-3" /> Overdue
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 bg-sky-100 text-sky-600 rounded-md font-medium">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
}

// Read-only property row
function PropRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 px-1 py-1.5 rounded-lg min-h-[34px]">
      <div className="flex items-center gap-2 w-[140px] shrink-0 pt-0.5">
        <Icon className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex-1 min-w-0 flex items-center pt-0.5">{children}</div>
    </div>
  );
}

// Editable property row — click value to edit, shows save/cancel inline
function EditablePropRow({
  icon: Icon,
  label,
  isEditing,
  onStartEdit,
  onCancel,
  displayValue,
  editControl,
  onSave,
  canEdit,
}: {
  icon: React.ElementType;
  label: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  displayValue: React.ReactNode;
  editControl: React.ReactNode;
  canEdit: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-2 px-1 py-1.5 rounded-lg min-h-[34px] ${
        canEdit && !isEditing ? "hover:bg-muted/40 cursor-pointer group" : ""
      } transition-colors`}
      onClick={canEdit && !isEditing ? onStartEdit : undefined}
    >
      <div className="flex items-center gap-2 w-[140px] shrink-0 pt-0.5">
        <Icon className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div onClick={(e) => e.stopPropagation()}>
            {editControl}
            <div className="flex gap-1.5 mt-2">
              <button
                onClick={onSave}
                className="flex items-center gap-1 px-2.5 py-1 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:opacity-90 transition-opacity"
              >
                <Check className="w-3 h-3" /> Save
              </button>
              <button
                onClick={onCancel}
                className="px-2.5 py-1 border border-border text-muted-foreground rounded-md text-xs hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center pt-0.5">
            {displayValue}
            {canEdit && (
              <span className="ml-2 text-[10px] text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors select-none">
                Click to edit
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TaskDetailPanel({
  task,
  isOpen,
  onClose,
  contactPhone,
  contactEmail,
  contactListingName,
  contact,
}: TaskDetailPanelProps) {
  const { handleCompleteTaskWithOutcome, handleRescheduleTask, handleSendTaskEmail, workflowEnrollments } = useAppData();
  const { openDialerForTask, session } = useDialer();

  const [showVmScript, setShowVmScript] = useState(false);
  const [showOutcomeCapture, setShowOutcomeCapture] = useState(false);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);

  // Inline editing state
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [editDueDate, setEditDueDate] = useState("");
  const [editAssignee, setEditAssignee] = useState("");
  const [editObjective, setEditObjective] = useState("");

  if (!task) return null;

  const sourceEnrollment = task.enrollmentId
    ? workflowEnrollments.find((e) => e.id === task.enrollmentId)
    : undefined;
  const workflowLink = sourceEnrollment
    ? `/email-workflows/flows/${sourceEnrollment.workflowId}/board`
    : undefined;

  const config = getTaskTypeConfig(task.taskType);
  const TypeIcon = config.icon;

  const dialerOutcomePending =
    session?.taskId === task.id && session.status === "outcome-pending";
  const shouldShowCapture = showOutcomeCapture;
  const isActionable = task.status === "pending" || task.status === "overdue";

  const startEdit = (field: EditingField) => {
    if (!isActionable) return;
    setEditingField(field);
    if (field === "dueDate") setEditDueDate(toDatetimeLocal(task.dueDate));
    if (field === "assignee") setEditAssignee(task.assignee ?? "");
    if (field === "objective") setEditObjective(task.triggerContext ?? "");
  };

  const cancelEdit = () => setEditingField(null);

  const saveEdit = () => {
    const newDate = editingField === "dueDate" && editDueDate
      ? new Date(editDueDate)
      : new Date(task.dueDate);
    const newAssignee = editingField === "assignee" ? editAssignee : task.assignee;
    const newObjective = editingField === "objective" ? editObjective : task.triggerContext;
    handleRescheduleTask(task.id, newDate, newAssignee, newObjective);
    setEditingField(null);
  };

  const handleAction = () => {
    if (!isActionable) return;
    if (config.primaryAction.handler === "dialer") {
      const phone = contactPhone ?? "";
      if (!phone) return;
      openDialerForTask(task, phone);
      setShowOutcomeCapture(false);
    } else if (config.primaryAction.handler === "email-composer") {
      setShowEmailComposer(true);
    } else {
      setShowOutcomeCapture(true);
    }
  };

  const handleOutcomeSubmit = (disposition: string, note: string | undefined) => {
    handleCompleteTaskWithOutcome(task.id, disposition, note);
    setShowOutcomeCapture(false);
    onClose();
  };

  const actionLabel = config.primaryAction.label.replace("{contactName}", task.contactName);
  const ActionIcon = config.primaryAction.icon;
  const actionDisabled =
    !isActionable ||
    (config.primaryAction.handler === "dialer" && !contactPhone) ||
    (config.primaryAction.handler === "email-composer" && !contactEmail);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-[440px] bg-background border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ── Top bar ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable body ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 pb-8">

            {/* Title: type icon + contact name as link, same line */}
            <div className="flex items-center gap-2.5 mb-6 mt-1">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${config.badgeColor}`}
              >
                <TypeIcon className="w-4 h-4" />
              </div>
              <Link
                to={`/crm/contacts/${task.contactId}`}
                onClick={onClose}
                className="text-2xl font-bold text-foreground hover:text-primary hover:underline transition-colors leading-tight"
              >
                {task.contactName}
              </Link>
              {(task.retryCount ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-semibold uppercase tracking-wider shrink-0">
                  <RefreshCw className="w-2.5 h-2.5" /> Retry #{task.retryCount}
                </span>
              )}
            </div>

            {/* ── V2 (RFC-008): Contact Context ──────────────────────────── */}
            {contact && <ContactContextPanel contact={contact} />}

            {/* ── Properties ─────────────────────────────────────────────── */}
            <div className="space-y-0.5 mb-6">

              {contactPhone && (
                <PropRow icon={Phone} label="Phone">
                  <a
                    href={`tel:${contactPhone}`}
                    className="text-sm text-foreground hover:text-primary transition-colors"
                  >
                    {contactPhone}
                  </a>
                </PropRow>
              )}

              {contactEmail && (
                <PropRow icon={Mail} label="Email">
                  <a
                    href={`mailto:${contactEmail}`}
                    className="text-sm text-foreground hover:text-primary transition-colors truncate"
                  >
                    {contactEmail}
                  </a>
                </PropRow>
              )}

              <PropRow icon={Tag} label="Task type">
                <span className={`text-xs px-2 py-0.5 rounded-md font-semibold uppercase tracking-wider ${config.badgeColor}`}>
                  {config.label}
                </span>
              </PropRow>

              <PropRow icon={Clock} label="Status">
                <StatusValue task={task} />
              </PropRow>

              {/* Editable: Due date */}
              <EditablePropRow
                icon={CalendarDays}
                label="Due"
                isEditing={editingField === "dueDate"}
                onStartEdit={() => startEdit("dueDate")}
                onCancel={cancelEdit}
                onSave={saveEdit}
                canEdit={isActionable}
                displayValue={
                  <span className="text-sm text-foreground">{formatDateTime(task.dueDate)}</span>
                }
                editControl={
                  <input
                    type="datetime-local"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                    autoFocus
                  />
                }
              />

              <PropRow icon={Workflow} label="Source">
                <div className="min-w-0">
                  {workflowLink ? (
                    <Link
                      to={workflowLink}
                      state={{ openContactId: sourceEnrollment!.contactId, openEnrollmentId: sourceEnrollment!.id }}
                      className="text-sm text-primary hover:underline truncate block"
                      title={task.source}
                    >
                      {task.source}
                    </Link>
                  ) : (
                    <span className="text-sm text-foreground truncate block" title={task.source}>
                      {task.source || <span className="text-muted-foreground/50">—</span>}
                    </span>
                  )}
                  {task.ruleName && (
                    <span className="text-xs text-muted-foreground">{task.ruleName}</span>
                  )}
                </div>
              </PropRow>

              {/* Editable: Assignee */}
              <EditablePropRow
                icon={User2}
                label="Assignee"
                isEditing={editingField === "assignee"}
                onStartEdit={() => startEdit("assignee")}
                onCancel={cancelEdit}
                onSave={saveEdit}
                canEdit={isActionable}
                displayValue={
                  task.assignee ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-primary">
                          {task.assignee.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm text-foreground">{task.assignee}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground/50">Unassigned</span>
                  )
                }
                editControl={
                  <select
                    value={editAssignee}
                    onChange={(e) => setEditAssignee(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                    autoFocus
                  >
                    <option value="">Unassigned</option>
                    {TEAM_MEMBERS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                }
              />

              {(contactListingName || task.contactStatus) && (
                <PropRow icon={FileText} label="Application">
                  <div className="min-w-0">
                    {contactListingName && (
                      <p className="text-sm text-foreground font-medium truncate" title={contactListingName}>
                        {contactListingName}
                      </p>
                    )}
                    {task.contactStatus && (
                      <span className="text-xs px-2 py-0.5 bg-muted border border-border/60 rounded-md text-muted-foreground font-medium uppercase tracking-tighter">
                        {task.contactStatus}
                      </span>
                    )}
                  </div>
                </PropRow>
              )}
            </div>

            {/* ── Divider ───────────────────────────────────────────────── */}
            <div className="border-t border-border mb-5" />

            {/* Editable: Objective */}
            <div className="mb-4">
              <div
                className={`${isActionable && editingField !== "objective" ? "cursor-pointer group" : ""}`}
                onClick={() => editingField !== "objective" && startEdit("objective")}
              >
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  Objective
                  {isActionable && editingField !== "objective" && (
                    <span className="text-[10px] text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors font-normal normal-case tracking-normal">
                      · Click to edit
                    </span>
                  )}
                </p>
                {editingField === "objective" ? (
                  <div onClick={(e) => e.stopPropagation()}>
                    <textarea
                      value={editObjective}
                      onChange={(e) => setEditObjective(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                      autoFocus
                    />
                    <div className="flex gap-1.5 mt-2">
                      <button
                        onClick={saveEdit}
                        className="flex items-center gap-1 px-2.5 py-1 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:opacity-90 transition-opacity"
                      >
                        <Check className="w-3 h-3" /> Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-2.5 py-1 border border-border text-muted-foreground rounded-md text-xs hover:bg-muted transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className={`text-sm text-foreground leading-relaxed ${isActionable ? "hover:bg-muted/30 rounded-lg px-1 -mx-1 py-0.5 transition-colors" : ""}`}>
                    {task.triggerContext || (
                      <span className="text-muted-foreground/50 italic">No objective set</span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Voicemail / notes (expandable) */}
            {task.notes && (
              <div className="mb-4">
                <button
                  onClick={() => setShowVmScript((v) => !v)}
                  className="w-full flex items-center justify-between py-1.5 text-left group"
                >
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
                    {task.taskType === "Call" || task.taskType === "Voicemail"
                      ? "Voicemail Script"
                      : "Notes"}
                  </span>
                  {showVmScript ? (
                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
                {showVmScript && (
                  <p className="text-sm text-foreground leading-relaxed italic mt-2 pl-3 border-l-2 border-border">
                    {task.notes}
                  </p>
                )}
              </div>
            )}

            {/* Completed outcome */}
            {task.status === "completed" && task.disposition && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wider text-green-600 mb-1.5 font-semibold">
                  Outcome
                </p>
                <p className="text-sm font-semibold text-green-800">{task.disposition}</p>
                {task.outcome && (
                  <p className="text-xs text-green-700 mt-1">{task.outcome}</p>
                )}
                {task.completedAt && (
                  <p className="text-[10px] text-green-600/70 mt-2">
                    Completed {formatDateTime(task.completedAt)}
                  </p>
                )}
              </div>
            )}

            {/* ── Dialer showing disposition form ─────────────────────── */}
            {isActionable && dialerOutcomePending && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                <Phone className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700 font-semibold">
                  Call ended — select disposition in the dialer panel.
                </p>
              </div>
            )}

            {/* ── Disposition logged, pending confirmation ─────────────── */}
            {isActionable && task.disposition && !dialerOutcomePending && !shouldShowCapture && (
              <div className="space-y-2 mt-2">
                {/* Call log card */}
                <div className="border border-border rounded-xl overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-semibold text-foreground">Call Log</span>
                  </div>

                  {/* Body */}
                  <div className="px-3 py-3 space-y-2.5">
                    {/* Call date/time */}
                    {task.callStartedAt && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">Date &amp; Time</span>
                        <span className="text-xs font-medium text-foreground">{formatDateTime(task.callStartedAt)}</span>
                      </div>
                    )}

                    {/* Disposition row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">Disposition</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        task.disposition === "Answered"
                          ? "bg-green-100 text-green-700"
                          : task.disposition === "Left Voicemail" || task.disposition === "Drop Voicemail"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {task.disposition}
                      </span>
                    </div>

                    {/* Voicemail template (Drop Voicemail only) */}
                    {task.disposition === "Drop Voicemail" && task.droppedVoicemailName && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">Voicemail used</span>
                        <span className="text-xs font-medium text-foreground">{task.droppedVoicemailName}</span>
                      </div>
                    )}

                    {/* Assignee row */}
                    {task.assignee && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">Logged by</span>
                        <span className="text-xs font-medium text-foreground">{task.assignee}</span>
                      </div>
                    )}

                    {/* Note */}
                    {task.outcome && (
                      <div className="pt-1 border-t border-border/60">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Note</p>
                        <p className="text-xs text-foreground leading-relaxed">{task.outcome}</p>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    handleCompleteTaskWithOutcome(task.id, task.disposition!, task.outcome);
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold tracking-wide bg-green-500 text-white hover:bg-green-600 active:scale-[0.99] shadow-sm transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark as Done
                </button>
                <button
                  onClick={() => setShowFollowUpModal(true)}
                  className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
                >
                  Create follow-up task →
                </button>
              </div>
            )}

            {/* ── Action button (no disposition logged yet) ────────────── */}
            {isActionable && !task.disposition && !dialerOutcomePending && !shouldShowCapture && (
              <div className="space-y-2 mt-2">
                <button
                  onClick={handleAction}
                  disabled={actionDisabled}
                  className={`w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-bold tracking-wide transition-all ${
                    actionDisabled
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.99] shadow-sm"
                  }`}
                >
                  <ActionIcon className="w-4 h-4" />
                  {actionLabel}
                </button>

                {config.primaryAction.handler === "dialer" && (
                  <button
                    onClick={() => setShowOutcomeCapture(true)}
                    className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
                  >
                    Log outcome without calling →
                  </button>
                )}
                {config.primaryAction.handler === "email-composer" && (
                  <button
                    onClick={() => setShowOutcomeCapture(true)}
                    className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
                  >
                    Log outcome without sending →
                  </button>
                )}
              </div>
            )}

            {/* ── Outcome capture (manual only) ────────────────────────── */}
            {isActionable && shouldShowCapture && (
              <div className="space-y-3 mt-2">
                <OutcomeCapturePanel
                  taskType={task.taskType}
                  onSubmit={handleOutcomeSubmit}
                  onCancel={() => setShowOutcomeCapture(false)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {showEmailComposer && contactEmail && (
        <QuickEmailModal
          toEmail={contactEmail}
          toName={task.contactName}
          initialSubject={task.triggerContext ?? ""}
          onSend={(subject, _body, sender) => {
            handleSendTaskEmail(task.id, subject, sender);
            setShowEmailComposer(false);
            setShowOutcomeCapture(true);
          }}
          onClose={() => setShowEmailComposer(false)}
        />
      )}

      <CreateTaskModal
        isOpen={showFollowUpModal}
        onClose={() => setShowFollowUpModal(false)}
        preselectedContactId={task.contactId}
      />
    </>
  );
}
