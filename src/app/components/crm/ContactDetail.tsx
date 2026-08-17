import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  Phone,
  Mail,
  Plus,
  CheckCircle2,
  Calendar,
  Trash2,
  Clock,
  PhoneCall,
  MessageSquare,
  Pencil,
  Copy,
  CalendarDays,
  FileText,
  ChevronDown,
  ChevronUp,
  Building2,
  X,
  Search,
  UserPlus,
  Pause,
  Play,
  ArrowRightLeft,
  Info,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { useAppData } from "@/app/contexts/AppDataContext";
import { useDialer } from "@/app/contexts/DialerContext";
import { CreateTaskModal } from "@/app/components/email-workflows/CreateTaskModal";
import { TaskActionModal } from "@/app/components/email-workflows/TaskActionModal";
import { PauseAllCommsModal } from "./PauseAllCommsModal";
import { ContactCommunicationsTab } from "./ContactCommunicationsTab";
import { ContactAttributionBlock } from "./ContactAttributionBlock";
import { ContactOfficeSection } from "./ContactOfficeSection";
import { useContactOffice } from "./useContactOffice";
import { ContactQuestionnaireSection } from "./ContactQuestionnaireSection";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Switch } from "@/app/components/ui/switch";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/app/components/ui/alert-dialog";
import { ACTIVE_TASK_TYPES } from "@/app/lib/taskTypeRegistry";
import { optOutSourceLabel } from "@/app/lib/optOutUtils";
import type { Contact, TaskItem } from "@/app/types";

type TaskModalMode = "complete" | "reschedule" | "delete" | null;
type DueDateFilter = "all" | "today" | "this-week" | "overdue";

const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-100 text-blue-700",
  Draft: "bg-yellow-100 text-yellow-700",
  Submitted: "bg-purple-100 text-purple-700",
  "On Hold": "bg-orange-100 text-orange-700",
  Declined: "bg-red-100 text-red-700",
};

function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatShortDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

// Unified timeline entry (activity log only — no email/sms sends)
interface TimelineEntry {
  id: string;
  _ts: Date;
  type: string;
  taskType?: string;
  disposition?: string;
  note?: string;
  source?: string;
  stepName?: string;
  assignee?: string;
  oldStatus?: string;
  newStatus?: string;
  updatedFields?: string[];
  // email / sms record fields
  subject?: string;
  channel?: "email" | "sms";
  direction?: "inbound" | "outbound";
  read?: boolean;
  workflowName?: string;
  senderIdentity?: string;
  // failed message fields
  status?: "Sent" | "Delivered" | "Opened" | "Failed" | "Bounced" | "Undelivered" | "Received";
  emailId?: string;
}

export function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    contacts,
    emailHistory,
    taskItems,
    contactActivity,
    workflowEnrollments,
    handleCompleteTask,
    handleRescheduleTask,
    handleDeleteTask,
    handlePauseAllEnrollments,
    handleUpdateContact,
    handleResendMessage,
    handleSetChannelOptOut,
    applications,
  } = useAppData();

  const { openDialer } = useDialer();

  const [activeTab, setActiveTab] = useState<"history" | "tasks" | "communications" | "notes">(
    () => ("communications"),
  );
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [modalTask, setModalTask] = useState<TaskItem | null>(null);
  const [modalMode, setModalMode] = useState<TaskModalMode>(null);
  const [infoOpen, setInfoOpen] = useState(true);
  const [addressOpen, setAddressOpen] = useState(false);
  const [applicationsOpen, setApplicationsOpen] = useState(true);
  const [companiesOpen, setCompaniesOpen] = useState(true);
  const [listingOpen, setListingOpen] = useState(true);
  const [optOutConfirm, setOptOutConfirm] = useState<{ channel: "email" | "sms"; optingOut: boolean } | null>(null);

  // Cross-tab navigation: History → Communications
  const [highlightEnrollmentId, setHighlightEnrollmentId] = useState<string | null>(null);

  // Tasks tab filters
  const [taskSearch, setTaskSearch] = useState("");
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [showCompleted, setShowCompleted] = useState(false);

  const contact = contacts.find((c) => c.id === id);
  const contactOffice = useContactOffice(contact ?? ({ id: "" } as Contact));

  if (!contact) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="mb-4">Contact not found.</p>
          <button onClick={() => navigate(-1)} className="text-primary underline text-sm">
            Back to contacts
          </button>
        </div>
      </div>
    );
  }

  const contactEmails = emailHistory.filter((e) => e.contactId === contact.id);

  const contactTasks = taskItems
    .filter((t) => t.contactId === contact.id)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const pendingTasks = contactTasks.filter((t) => t.status !== "completed" && t.status !== "suspended");

  // ── Timeline feed ────────────────────────────────────────────────────────────
  const activityEntries: TimelineEntry[] = contactActivity
    .filter((a) => a.contactId === contact.id)
    .map((a) => ({
      id: a.id,
      _ts: new Date(a.timestamp),
      type: a.type,
      taskType: a.taskType,
      disposition: a.disposition,
      note: a.note,
      source: a.source,
      stepName: a.stepName,
      assignee: a.assignee,
      oldStatus: a.oldStatus,
      newStatus: a.newStatus,
      updatedFields: a.updatedFields,
      subject: (a as { subject?: string }).subject,
      channel: (a as { channel?: "email" | "sms" }).channel,
    }));

  const emailEntries: TimelineEntry[] = emailHistory
    .filter((e) => e.contactId === contact.id)
    .map((e) => ({
      id: `eh-${e.id}`,
      _ts: new Date(e.sentAt),
      type: e.direction === "inbound"
        ? (e.channel === "sms" ? "sms_received" : "email_received")
        : (e.channel === "sms" ? "sms_sent" : "email_sent"),
      subject: e.subject ?? undefined,
      channel: e.channel ?? "email",
      direction: e.direction ?? "outbound",
      read: e.read,
      workflowName: e.workflowName,
      stepName: e.stepName,
      senderIdentity: e.senderIdentity,
      status: e.status,
      emailId: e.id,
    }));

  const timelineFeed: TimelineEntry[] = [...activityEntries, ...emailEntries]
    .sort((a, b) => b._ts.getTime() - a._ts.getTime());

  // ── Tasks filtering ──────────────────────────────────────────────────────────
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const filteredTasks = contactTasks.filter((task) => {
    const isCompletedOrSuspended = task.status === "completed" || task.status === "suspended";
    if (!showCompleted && isCompletedOrSuspended) return false;

    if (taskSearch) {
      const q = taskSearch.toLowerCase();
      const matches =
        (task.triggerContext ?? "").toLowerCase().includes(q) ||
        (task.notes ?? "").toLowerCase().includes(q) ||
        task.taskType.toLowerCase().includes(q) ||
        (task.ruleName ?? "").toLowerCase().includes(q);
      if (!matches) return false;
    }

    if (taskTypeFilter !== "all" && task.taskType !== taskTypeFilter) return false;

    if (!isCompletedOrSuspended && dueDateFilter !== "all") {
      const due = new Date(task.dueDate);
      if (dueDateFilter === "overdue" && due >= todayStart) return false;
      if (dueDateFilter === "today" && (due < todayStart || due > todayEnd)) return false;
      if (dueDateFilter === "this-week" && (due < todayStart || due > weekEnd)) return false;
    }

    return true;
  });

  const overdueTasks = filteredTasks.filter(
    (t) => t.status !== "completed" && t.status !== "suspended" && new Date(t.dueDate) < todayStart,
  );
  const upcomingTasks = filteredTasks.filter(
    (t) => t.status !== "completed" && t.status !== "suspended" && new Date(t.dueDate) >= todayStart,
  );
  const completedTasks = filteredTasks.filter(
    (t) => t.status === "completed" || t.status === "suspended",
  ).sort((a, b) => new Date(b.completedAt ?? b.dueDate).getTime() - new Date(a.completedAt ?? a.dueDate).getTime());

  // Chip counts (always based on full contactTasks, not filtered)
  const chipCounts: Record<DueDateFilter, number> = {
    all: contactTasks.filter((t) => t.status !== "completed" && t.status !== "suspended").length,
    overdue: contactTasks.filter((t) => t.status !== "completed" && t.status !== "suspended" && new Date(t.dueDate) < todayStart).length,
    today: contactTasks.filter((t) => t.status !== "completed" && t.status !== "suspended" && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= todayEnd).length,
    "this-week": contactTasks.filter((t) => t.status !== "completed" && t.status !== "suspended" && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) <= weekEnd).length,
  };

  // ── Enrollments ──────────────────────────────────────────────────────────────
  const initials = `${contact.firstName[0] ?? ""}${contact.lastName[0] ?? ""}`.toUpperCase();

  const contactEnrollments = workflowEnrollments.filter(
    (e) => e.contactId === contact.id && e.status !== "completed",
  );
  const activeEnrollmentCount = contactEnrollments.filter((e) => e.status === "active").length;

  // Unread count for Communications tab badge
  const unreadCount = contactEmails.filter((e) => e.direction === "inbound" && !e.read).length;

  const openModal = (task: TaskItem, mode: TaskModalMode) => {
    setModalTask(task);
    setModalMode(mode);
  };
  const closeModal = () => {
    setModalTask(null);
    setModalMode(null);
  };

  // ── Render helpers ────────────────────────────────────────────────────────────
  const dispositionColors: Record<string, string> = {
    Answered: "bg-green-100 text-green-700",
    "Voicemail Left": "bg-amber-100 text-amber-700",
    "No Answer — Voicemail Drop": "bg-red-100 text-red-700",
    "Not Needed": "bg-muted text-muted-foreground",
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">

      {/*
        3-column body. Widths mirror frontend-hub's antd grid — Col lg={7} / lg={12} /
        lg={5} of 24 — as percentages, so the proportions match exactly (29.17 / 50 /
        20.83). Kept on one row: the container is a bounded `overflow-hidden` flex box
        and each column scrolls independently, so wrapping would clip the wrapped row.
      */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL ── */}
        <aside className="w-[29.1667%] shrink-0 border-r border-border bg-card flex flex-col overflow-y-auto">

          {/* Back button */}
          <div className="px-5 pt-4 pb-2">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Contacts
            </button>
          </div>

          {/* Avatar + Name + Role */}
          <div className="px-5 pt-3 pb-4 border-b border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <span className="text-base font-semibold text-primary">{initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold leading-tight truncate">{contact.firstName} {contact.lastName}</h2>
                <Select
                  value={contact.userType}
                  onValueChange={(v) => handleUpdateContact(contact.id, { userType: v as Contact["userType"] })}
                >
                  <SelectTrigger className="!border-0 !bg-transparent !shadow-none !px-0 !py-0 !h-auto !ring-0 !ring-offset-0 !justify-start !gap-1 text-sm font-medium text-muted-foreground mt-0.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Broker", "Lender", "Partner", "Borrower", "Co-Borrower"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {contact.optedOut && (
              <div className="mt-3 px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive text-center">
                Opted out — do not email
              </div>
            )}

            {/* Action icons */}
            <div className="flex justify-between mt-4">
              <button onClick={() => openDialer(contact.phone)} className="flex flex-col items-center gap-1 group" title="Call">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center group-hover:opacity-80 transition-opacity">
                  <Phone className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="text-[10px] text-muted-foreground">Call</span>
              </button>
              <a href={`mailto:${contact.email}`} className="flex flex-col items-center gap-1 group" title="Email">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center group-hover:opacity-80 transition-opacity">
                  <Mail className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="text-[10px] text-muted-foreground">Mail</span>
              </a>
              <button className="flex flex-col items-center gap-1 group" title="SMS">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center group-hover:opacity-80 transition-opacity">
                  <MessageSquare className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="text-[10px] text-muted-foreground">SMS</span>
              </button>
              <button onClick={() => setShowCreateTask(true)} className="flex flex-col items-center gap-1 group" title="Schedule">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center group-hover:opacity-80 transition-opacity">
                  <CalendarDays className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="text-[10px] text-muted-foreground">Schedule</span>
              </button>
              <button className="flex flex-col items-center gap-1 group" title="Note">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center group-hover:opacity-80 transition-opacity">
                  <FileText className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="text-[10px] text-muted-foreground">Note</span>
              </button>
            </div>
          </div>

          {/* Loan Officer — the hub keeps this in the header, below the actions */}
          <div className="px-5 pb-4 border-b border-border">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-sm font-semibold">Loan Officer</p>
              {contact.loanOfficer && (
                <button
                  onClick={() => handleUpdateContact(contact.id, { loanOfficer: undefined })}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
            <Select
              value={contact.loanOfficer ?? ""}
              onValueChange={(v) => handleUpdateContact(contact.id, { loanOfficer: v })}
            >
              <SelectTrigger className="!border-0 !bg-transparent !shadow-none !px-0 !py-0 !h-auto !ring-0 !ring-offset-0 !justify-start !gap-1 text-sm text-primary font-medium">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {["Andy Officer", "Sarah Manager", "John Lead", "Maria Broker"].map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>


          {/*
            Communication Preferences — mirrors frontend-hub's three channels.
            Marketing Email keeps a button rather than a switch: unsubscribes are
            recorded per sending domain and re-subscribing is an admin action, so a
            single boolean cannot represent it. SMS and Call are plain booleans and
            use switches, as they do there.
          */}
          <div className="px-5 py-4 border-b border-border">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Communication Preferences</p>
            <div className="space-y-3">
              {(() => {
                const emailOptOut = contact.emailOptOut;
                const isEmailOptedOut = emailOptOut?.optedOut === true;
                return (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <Mail className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium">Marketing Email</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isEmailOptedOut ? "bg-destructive/10 text-destructive" : "bg-green-100 text-green-700"}`}>
                            {isEmailOptedOut ? "Unsubscribed" : "Subscribed"}
                          </span>
                        </div>
                        {isEmailOptedOut && emailOptOut?.optedOutAt && (
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                            {optOutSourceLabel(emailOptOut.source)} · {formatShortDate(emailOptOut.optedOutAt)}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setOptOutConfirm({ channel: "email", optingOut: !isEmailOptedOut })}
                      className="text-xs text-primary hover:underline shrink-0 whitespace-nowrap"
                    >
                      {isEmailOptedOut ? "Re-subscribe" : "Unsubscribe"}
                    </button>
                  </div>
                );
              })()}

              {(() => {
                const isSmsOptedOut = contact.smsOptOut?.optedOut === true;
                return (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium">SMS</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isSmsOptedOut ? "bg-destructive/10 text-destructive" : "bg-green-100 text-green-700"}`}>
                        {isSmsOptedOut ? "Opted out" : "Subscribed"}
                      </span>
                    </div>
                    <Switch
                      aria-label="SMS subscription"
                      checked={!isSmsOptedOut}
                      onCheckedChange={(subscribed) =>
                        // Opting out is the destructive direction, so confirm it;
                        // opting back in applies straight away.
                        subscribed
                          ? handleSetChannelOptOut(contact.id, "sms", false)
                          : setOptOutConfirm({ channel: "sms", optingOut: true })
                      }
                    />
                  </div>
                );
              })()}

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <PhoneCall className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium">Call</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${contact.isDoNotCall ? "bg-destructive/10 text-destructive" : "bg-green-100 text-green-700"}`}>
                    {contact.isDoNotCall ? "Do not call" : "Callable"}
                  </span>
                </div>
                <Switch
                  aria-label="Call subscription"
                  checked={!contact.isDoNotCall}
                  onCheckedChange={(callable) =>
                    handleUpdateContact(contact.id, { isDoNotCall: !callable })
                  }
                />
              </div>
            </div>
          </div>


          {/* Contact Info accordion */}
          <div className="px-5 py-5 border-b border-border">
            <button
              onClick={() => setInfoOpen((v) => !v)}
              className="flex items-center justify-between w-full mb-3"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact Info</span>
              {infoOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {infoOpen && (
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Phone</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-primary truncate">{contact.phone}</span>
                    <button className="text-muted-foreground hover:text-foreground shrink-0" title="Edit phone">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Email</p>
                  <span className="text-sm break-all">{contact.email}</span>
                </div>
                {/* Flat attribution: closed-enum source + drill-downs, campaign as its own object */}
                <ContactAttributionBlock contact={contact} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Created at</p>
                    <span className="text-xs text-muted-foreground">{formatDate(contact.createAt)}</span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Updated at</p>
                    <span className="text-xs text-muted-foreground">{contact.updatedAt ? formatDate(contact.updatedAt) : "—"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>


          {/* Office — hidden entirely when the contact has no office attached */}
          {contactOffice && (
            <div className="px-5 py-4 border-b border-border">
              <ContactOfficeSection office={contactOffice} />
            </div>
          )}

          {/* Address accordion */}
          <div className="px-5 py-5">
            <button
              onClick={() => setAddressOpen((v) => !v)}
              className="flex items-center justify-between w-full mb-3"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Address</span>
              {addressOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {addressOpen && (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Home Address</p>
                  <span className="text-sm">{contact.address ?? "—"}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">City</p>
                    <span className="text-sm">{contact.city ?? "—"}</span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">State</p>
                    <span className="text-sm">{contact.state ?? "—"}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">ZIP Code</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm">{contact.zipCode ?? "—"}</span>
                    {contact.zipCode && (
                      <button
                        onClick={() => navigator.clipboard.writeText(contact.zipCode!)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        title="Copy ZIP code"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── CENTER PANEL ── */}
        <main className="w-1/2 shrink-0 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="border-b border-border flex justify-center gap-8">
            {(["communications" as const, "history", "notes", "tasks"] as const).map((tab) => {
              let label: string;
              if (tab === "history") label = "History";
              else if (tab === "tasks") label = `Tasks (${contactTasks.filter((t) => t.status !== "completed").length})`;
              else if (tab === "communications") label = "Communications";
              else label = "Notes";
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 text-sm capitalize border-b-2 transition-colors relative ${
                    activeTab === tab
                      ? "border-primary text-primary font-semibold"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                  {tab === "history" && unreadCount > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-500 text-white text-[9px] font-bold">
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto bg-muted/40 px-6 py-5">

            {/* ── HISTORY TAB ── */}
            {activeTab === "history" && (
              <div className="bg-card rounded-xl p-5">
                {timelineFeed.length === 0 ? (
                  <EmptyState icon={Clock} message="No activity for this contact yet." />
                ) : (
                  <div className="space-y-2">
                    {timelineFeed.map((entry) => {
                      const isCall = entry.type === "task_completed" && entry.taskType === "Call";
                      const isTask = entry.type === "task_completed" && !isCall;
                      const isEnrollmentCreated = entry.type === "enrollment_created";
                      const isEnrollmentPaused = entry.type === "enrollment_paused";
                      const isEnrollmentResumed = entry.type === "enrollment_resumed";
                      const isStatusChanged = entry.type === "status_changed";
                      const isContactUpdated = entry.type === "contact_updated";
                      const isStepSkipped = entry.type === "step_skipped" || entry.type === "step_unskipped";
                      const isEmailSent = entry.type === "email_sent";
                      const isSmsSent = entry.type === "sms_sent";
                      const isEmailReceived = entry.type === "email_received";
                      const isSmsReceived = entry.type === "sms_received";
                      const isInbound = isEmailReceived || isSmsReceived;
                      const isCommsRecord = isEmailSent || isSmsSent || isEmailReceived || isSmsReceived;
                      const isUnread = isInbound && entry.read === false;
                      const isFailed = isCommsRecord && !isInbound && (
                        entry.status === "Failed" || entry.status === "Bounced" || entry.status === "Undelivered"
                      );
                      // Channel opt-out check for resend disabled state
                      const resendChannel = entry.channel ?? "email";
                      const resendChannelOptOut = resendChannel === "sms" ? contact.smsOptOut : contact.emailOptOut;
                      const resendBlocked = contact.optedOut || resendChannelOptOut?.optedOut === true;
                      const resendTitle = resendBlocked
                        ? `Cannot resend — contact has opted out of ${resendChannel}`
                        : `Resend ${resendChannel}`;

                      const iconBg = isFailed
                        ? "bg-red-100 text-red-600"
                        : isCall
                        ? "bg-green-100 text-green-600"
                        : isEnrollmentCreated
                        ? "bg-primary/10 text-primary"
                        : isEnrollmentPaused
                        ? "bg-amber-100 text-amber-600"
                        : isEnrollmentResumed
                        ? "bg-green-100 text-green-600"
                        : isStatusChanged
                        ? "bg-violet-100 text-violet-600"
                        : isContactUpdated
                        ? "bg-sky-100 text-sky-600"
                        : isUnread
                        ? "bg-green-100 text-green-600"
                        : isInbound
                        ? "bg-muted text-muted-foreground"
                        : isCommsRecord
                        ? "bg-muted text-muted-foreground"
                        : "bg-muted text-muted-foreground";

                      const label = isCall
                        ? "Call logged"
                        : isTask
                        ? `${entry.taskType ?? "Task"} completed`
                        : isEnrollmentCreated
                        ? `Enrolled in ${entry.source ?? "workflow"}`
                        : isEnrollmentPaused
                        ? `Workflow paused — ${entry.source ?? ""}`
                        : isEnrollmentResumed
                        ? `Workflow resumed — ${entry.source ?? ""}`
                        : isStatusChanged
                        ? "Status changed"
                        : isContactUpdated
                        ? "Contact info updated"
                        : isStepSkipped
                        ? `Step ${entry.type === "step_skipped" ? "skipped" : "restored"}`
                        : isEmailSent
                        ? entry.subject ?? "Email sent"
                        : isSmsSent
                        ? entry.subject ?? entry.stepName ?? "SMS sent"
                        : isEmailReceived
                        ? entry.subject ?? "Email received"
                        : isSmsReceived
                        ? entry.subject ?? "SMS received"
                        : entry.type.replace(/_/g, " ");

                      // Paused/resumed don't need navigation — the status is visible inline
                      const isWorkflowEvent = isEnrollmentCreated || isStepSkipped;
                      const isTaskEvent = isCall || isTask;

                      return (
                        <div
                          key={entry.id}
                          className={`flex items-start gap-3 p-4 border rounded-xl ${isUnread ? "bg-green-50/50 border-green-100" : "bg-card border-border"}`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${iconBg}`}>
                            {isCall && <PhoneCall className="w-4 h-4" />}
                            {isTask && <CheckCircle2 className="w-4 h-4" />}
                            {isEnrollmentCreated && <UserPlus className="w-4 h-4" />}
                            {isEnrollmentPaused && <Pause className="w-4 h-4" />}
                            {isEnrollmentResumed && <Play className="w-4 h-4" />}
                            {isStatusChanged && <ArrowRightLeft className="w-4 h-4" />}
                            {isContactUpdated && <Info className="w-4 h-4" />}
                            {isStepSkipped && <Clock className="w-4 h-4" />}
                            {(isEmailSent || isEmailReceived) && <Mail className="w-4 h-4" />}
                            {(isSmsSent || isSmsReceived) && <MessageSquare className="w-4 h-4" />}
                            {!isCall && !isTask && !isEnrollmentCreated && !isEnrollmentPaused && !isEnrollmentResumed && !isStatusChanged && !isContactUpdated && !isStepSkipped && !isCommsRecord && (
                              <Clock className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* direction tag */}
                              {isCommsRecord && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isInbound ? "bg-blue-100 text-blue-600" : "bg-muted text-muted-foreground"}`}>
                                  {isInbound ? "Received" : "Sent"}
                                </span>
                              )}
                              {/* failed status badge */}
                              {isFailed && entry.status && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-100 text-red-600">
                                  {entry.status}
                                </span>
                              )}
                              <span className={`text-sm font-medium truncate max-w-xs ${isUnread ? "text-foreground" : ""}`}>
                                {label}
                              </span>
                              {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />}
                              {isCall && entry.disposition && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${dispositionColors[entry.disposition] ?? "bg-muted text-muted-foreground"}`}>
                                  {entry.disposition}
                                </span>
                              )}
                              {isStatusChanged && entry.oldStatus && entry.newStatus && (
                                <span className="text-xs text-muted-foreground">
                                  {entry.oldStatus} → {entry.newStatus}
                                </span>
                              )}
                            </div>

                            {/* comms context line */}
                            {isCommsRecord && (entry.senderIdentity || entry.workflowName || entry.stepName) && (
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap text-xs text-muted-foreground">
                                {entry.senderIdentity && <span>{entry.senderIdentity}</span>}
                                {entry.workflowName && <span className="px-1.5 py-0.5 rounded-full bg-muted font-medium">{entry.workflowName}</span>}
                                {entry.stepName && <span className="text-muted-foreground/60">· {entry.stepName}</span>}
                              </div>
                            )}

                            {isContactUpdated && entry.updatedFields && entry.updatedFields.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Fields updated: {entry.updatedFields.join(", ")}
                              </div>
                            )}
                            {entry.note && (
                              <div className="text-xs text-muted-foreground italic mt-1">"{entry.note}"</div>
                            )}
                            {(isCall || isTask || isStepSkipped) && entry.source && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {entry.source}{entry.stepName ? ` — ${entry.stepName}` : ""}
                              </div>
                            )}

                            {/* nav actions */}
                            {(isWorkflowEvent || isTaskEvent) && (
                              <button
                                onClick={() => {
                                  if (isTaskEvent) {
                                    setShowCompleted(true);
                                    setActiveTab("tasks");
                                  } else {
                                    setActiveTab("communications");
                                  }
                                }}
                                className="flex items-center gap-1 mt-2 text-xs text-primary hover:underline font-medium"
                              >
                                {isTaskEvent ? "View in Tasks" : "View details"}
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                            {/* resend action for failed messages */}
                            {isFailed && entry.emailId && (
                              <button
                                onClick={() => !resendBlocked && handleResendMessage(entry.emailId!)}
                                disabled={resendBlocked}
                                title={resendTitle}
                                className={`flex items-center gap-1 mt-2 text-xs font-medium ${resendBlocked ? "text-muted-foreground cursor-not-allowed" : "text-primary hover:underline"}`}
                              >
                                <RotateCcw className="w-3 h-3" />
                                Resend
                              </button>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                            {formatDate(entry._ts)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── TASKS TAB ── */}
            {activeTab === "tasks" && (
              <div className="bg-card rounded-xl p-5 space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    placeholder="Search tasks…"
                    className="w-full pl-8 pr-8 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none"
                  />
                  {taskSearch && (
                    <button
                      onClick={() => setTaskSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter chips row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {(["all", "overdue", "today", "this-week"] as DueDateFilter[]).map((f) => {
                    const labels: Record<DueDateFilter, string> = { all: "All", overdue: "Overdue", today: "Today", "this-week": "This Week" };
                    return (
                      <button
                        key={f}
                        onClick={() => setDueDateFilter(f)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          dueDateFilter === f
                            ? f === "overdue"
                              ? "bg-red-100 text-red-700 border-red-200"
                              : "bg-primary/10 text-primary border-primary/20"
                            : "bg-background text-muted-foreground border-border hover:border-foreground/30"
                        }`}
                      >
                        {labels[f]}
                        <span className={`text-[10px] px-1 py-0.5 rounded-full ${
                          dueDateFilter === f ? (f === "overdue" ? "bg-red-200 text-red-700" : "bg-primary/20 text-primary") : "bg-muted text-muted-foreground"
                        }`}>
                          {chipCounts[f]}
                        </span>
                      </button>
                    );
                  })}

                  {/* Type filter */}
                  <select
                    value={taskTypeFilter}
                    onChange={(e) => setTaskTypeFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-border rounded-full bg-background text-muted-foreground focus:outline-none cursor-pointer"
                  >
                    <option value="all">Type: All</option>
                    {ACTIVE_TASK_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>

                  <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showCompleted}
                      onChange={(e) => setShowCompleted(e.target.checked)}
                      className="rounded"
                    />
                    Show completed
                  </label>
                </div>

                {/* Task groups */}
                {filteredTasks.length === 0 ? (
                  <EmptyState icon={CheckCircle2} message="No tasks match your filters." />
                ) : (
                  <div className="space-y-4">
                    {overdueTasks.length > 0 && (
                      <TaskGroup
                        label="Overdue"
                        labelClass="text-red-600"
                        tasks={overdueTasks}
                        onComplete={(t) => openModal(t, "complete")}
                        onReschedule={(t) => openModal(t, "reschedule")}
                        onDelete={(t) => openModal(t, "delete")}
                      />
                    )}
                    {upcomingTasks.length > 0 && (
                      <TaskGroup
                        label="Upcoming"
                        labelClass="text-foreground"
                        tasks={upcomingTasks}
                        onComplete={(t) => openModal(t, "complete")}
                        onReschedule={(t) => openModal(t, "reschedule")}
                        onDelete={(t) => openModal(t, "delete")}
                      />
                    )}
                    {showCompleted && completedTasks.length > 0 && (
                      <TaskGroup
                        label="Completed"
                        labelClass="text-muted-foreground"
                        tasks={completedTasks}
                        onComplete={() => {}}
                        onReschedule={() => {}}
                        onDelete={() => {}}
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── NOTES TAB ── */}
            {activeTab === "notes" && (
              <div className="bg-card rounded-xl">
                <EmptyState icon={FileText} message="No notes for this contact yet." />
              </div>
            )}

            {/* ── COMMUNICATIONS TAB (V2 only) ── */}
            {activeTab === "communications" && (
              <div className="bg-card rounded-xl overflow-hidden p-5">
                <ContactCommunicationsTab
                  contactId={contact.id}
                  contactOptedOut={contact.optedOut ?? false}
                  highlightEnrollmentId={highlightEnrollmentId}
                  onHighlightConsumed={() => {
                    setHighlightEnrollmentId(null);
                  }}
                />
              </div>
            )}
          </div>
        </main>

        {/* ── RIGHT PANEL ── */}
        <aside className="w-[20.8333%] shrink-0 border-l border-border bg-card flex flex-col overflow-y-auto">

          {/* Listings */}
          <div className="px-5 py-5 border-b border-border">
            <button
              onClick={() => setListingOpen((v) => !v)}
              className="flex items-center justify-between w-full mb-3"
            >
              <h3 className="text-sm font-semibold">Listings</h3>
              {listingOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {listingOpen && (() => {
              const allListings = contact.listings && contact.listings.length > 0
                ? contact.listings
                : [{ id: "legacy", name: contact.listingName, status: contact.listingStatus }];
              return (
                <div className="space-y-2">
                  {allListings.map((listing) => (
                    <div key={listing.id} className="p-3 border border-border rounded-xl bg-background">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-medium truncate">{listing.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[listing.status] ?? "bg-muted text-muted-foreground"}`}>
                          {listing.status}
                        </span>
                        {contact.optedOut && (
                          <span className="text-xs px-2 py-0.5 bg-destructive/10 text-destructive rounded-full">Opted Out</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Companies */}
          <div className="px-5 py-5 border-b border-border">
            <button
              onClick={() => setCompaniesOpen((v) => !v)}
              className="flex items-center justify-between w-full mb-3"
            >
              <h3 className="text-sm font-semibold">Companies</h3>
              {companiesOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {companiesOpen && (
              <div className="flex flex-wrap gap-2">
                {(contact.companies ?? []).map((company) => (
                  <span key={company} className="inline-flex items-center gap-1 px-2.5 py-1 bg-muted rounded-full text-xs font-medium">
                    {company}
                    <button
                      onClick={() => handleUpdateContact(contact.id, {
                        companies: (contact.companies ?? []).filter((c) => c !== company),
                      })}
                      className="text-muted-foreground hover:text-foreground ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <button className="inline-flex items-center gap-1 px-2.5 py-1 border border-dashed border-border rounded-full text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                  <Plus className="w-3 h-3" />
                  Add company
                </button>
              </div>
            )}
          </div>

          {/* Applications */}
          <div className="px-5 py-5 border-b border-border">
            <button
              onClick={() => setApplicationsOpen((v) => !v)}
              className="flex items-center justify-between w-full mb-3"
            >
              <h3 className="text-sm font-semibold">Applications</h3>
              {applicationsOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {applicationsOpen && (() => {
              const linkedApp = applications.find((a) => a.id === contact.linkedApplicationId);
              return linkedApp ? (
                <div className="p-3 border border-border rounded-xl bg-background">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-foreground">#{linkedApp.applicationNumber}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full">{linkedApp.stage}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{linkedApp.loanPurpose}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{linkedApp.loanOfficerName}</div>
                </div>
              ) : (
                // Matches frontend-hub: applications are linked by the Hub sync, not by
                // hand, so there is no link/select (or unlink) affordance here.
                <p className="text-xs text-muted-foreground">No applications linked</p>
              );
            })()}
          </div>

          {/* Questionnaire — rendered from admin-defined custom fields */}
          <div className="px-1">
            <ContactQuestionnaireSection contact={contact} />
          </div>

          {/* Upcoming Tasks */}
          <div className="px-5 py-5 flex-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Upcoming Tasks</h3>
              <button
                onClick={() => setShowCreateTask(true)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Task
              </button>
            </div>

            {pendingTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No upcoming tasks</p>
            ) : (
              <div className="space-y-2">
                {pendingTasks.map((task) => {
                  const isOverdue = new Date(task.dueDate) < new Date();
                  const typeColors: Record<string, { border: string; badge: string }> = {
                    Call: { border: "border-l-green-500", badge: "bg-green-50 text-green-700" },
                    Email: { border: "border-l-blue-400", badge: "bg-blue-50 text-blue-700" },
                    SMS: { border: "border-l-purple-400", badge: "bg-purple-50 text-purple-700" },
                  };
                  const colors = typeColors[task.taskType] ?? { border: "border-l-border", badge: "bg-muted text-muted-foreground" };
                  return (
                    <div key={task.id} className={`border border-l-4 border-border rounded-lg bg-white ${colors.border}`}>
                      <div className="px-3 py-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${colors.badge}`}>
                              {task.taskType}
                            </span>
                            {isOverdue && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide bg-red-100 text-red-500">
                                Overdue
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                            <Clock className="w-3 h-3 shrink-0" />
                            {formatDate(task.dueDate)}
                          </div>
                        </div>
                        {task.triggerContext && (
                          <p className="text-xs text-foreground leading-relaxed line-clamp-2">{task.triggerContext}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Modals */}
      <CreateTaskModal
        isOpen={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        preselectedContactId={contact.id}
      />

      <TaskActionModal
        isOpen={modalMode !== null}
        mode={modalMode}
        task={modalTask}
        onComplete={(taskId, dis, note) => { handleCompleteTask(taskId, dis, note); closeModal(); }}
        onReschedule={(taskId, date, assignee, objective) => { handleRescheduleTask(taskId, date, assignee, objective); closeModal(); }}
        onDelete={(taskId) => { handleDeleteTask(taskId); closeModal(); }}
        onClose={closeModal}
      />

      <PauseAllCommsModal
        isOpen={showPauseModal}
        contactName={`${contact.firstName} ${contact.lastName}`}
        activeEnrollmentCount={activeEnrollmentCount}
        onConfirm={(pausedUntil, reason) => {
          handlePauseAllEnrollments(contact.id, pausedUntil, reason);
          setShowPauseModal(false);
        }}
        onClose={() => setShowPauseModal(false)}
      />

      {/* Channel Opt-out Confirmation Dialog */}
      <AlertDialog open={optOutConfirm !== null} onOpenChange={(v) => { if (!v) setOptOutConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {optOutConfirm?.optingOut
                ? `Opt out of marketing ${optOutConfirm.channel}?`
                : `Resubscribe to marketing ${optOutConfirm?.channel}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {optOutConfirm?.optingOut
                ? `${contact.firstName} ${contact.lastName} will no longer receive marketing ${optOutConfirm.channel} messages from workflows or manual sends. Transactional messages (application updates, document requests) will still be delivered. You can resubscribe them at any time.`
                : `${contact.firstName} ${contact.lastName} will start receiving marketing ${optOutConfirm?.channel} messages again. Transactional messages are always delivered regardless of this setting.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOptOutConfirm(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (optOutConfirm) {
                  handleSetChannelOptOut(contact.id, optOutConfirm.channel, optOutConfirm.optingOut);
                  setOptOutConfirm(null);
                }
              }}
              className={optOutConfirm?.optingOut ? "bg-destructive text-white hover:bg-destructive/90" : ""}
            >
              {optOutConfirm?.optingOut ? "Opt out" : "Resubscribe"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TaskGroup({
  label,
  labelClass,
  tasks,
  onComplete,
  onReschedule,
  onDelete,
}: {
  label: string;
  labelClass: string;
  tasks: TaskItem[];
  onComplete: (t: TaskItem) => void;
  onReschedule: (t: TaskItem) => void;
  onDelete: (t: TaskItem) => void;
}) {
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${labelClass}`}>{label}</p>
      <div className="space-y-2">
        {tasks.map((task) => {
          const isOverdue = task.status !== "completed" && new Date(task.dueDate) < new Date();
          const isCompleted = task.status === "completed" || task.status === "suspended";
          return (
            <div
              key={task.id}
              className={`flex items-start gap-4 p-4 bg-card border rounded-xl transition-colors ${
                isCompleted ? "border-border opacity-60" : isOverdue ? "border-red-200 bg-red-50/30" : "border-border"
              }`}
            >
              <div className="shrink-0 mt-0.5">
                <span className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wide font-medium ${
                  isCompleted ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                }`}>
                  {task.taskType}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                {task.triggerContext && (
                  <div className="text-sm text-foreground line-clamp-2">{task.triggerContext}</div>
                )}
                {task.notes && (
                  <div className="text-xs text-muted-foreground italic mt-0.5 line-clamp-1">VM: {task.notes}</div>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className={`text-xs ${isOverdue && !isCompleted ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                    {isCompleted && task.completedAt ? `Done ${formatDate(task.completedAt)}` : formatDate(task.dueDate)}
                  </span>
                  {isOverdue && !isCompleted && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded uppercase tracking-tight">Overdue</span>
                  )}
                  {isCompleted && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded uppercase tracking-tight">Done</span>
                  )}
                </div>
                {task.disposition && (
                  <div className="text-xs text-muted-foreground mt-0.5">{task.disposition}</div>
                )}
              </div>
              {!isCompleted && (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onComplete(task)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Complete">
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => onReschedule(task)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Reschedule">
                    <Calendar className="w-4 h-4" />
                  </button>
                  <button onClick={() => onDelete(task)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Icon className="w-10 h-10 mb-3 opacity-20" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
