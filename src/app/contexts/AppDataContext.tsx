import { createContext, useContext, useState } from "react";
import { toast } from "sonner";
import type { Contact, ChannelOptOut, EmailRecord, Task, TaskItem, Application, BusinessAcquisitionRecord, Segment, FilterRule, Workflow, WorkflowEnrollment, WorkflowStep, WorkflowStepProgress, ContactActivityRecord, CustomWorkflowStep, AdminEmailTemplate, SmsTemplate, VoicemailScript, VoicemailSettings, SenderIdentity, Notification, NotificationPreferences, LoGroup, TemplateFolder, NewContactInput, ContactImportSource, Campaign, CustomFieldDefinition, LeadFormPayload, LeadFormDefinition, LeadIngestResult, MetaLeadPayload, PlatformAccount, InboundLeadEvent, ContactLeadAnswer, Company, ListingRecord } from "../types";
import { leadSourceFromUtm, resolveLeadSource } from "../data/attribution";
import { findCampaignByExternalId } from "../data/campaignUtils";
import {
  findContactByIdentity,
  leadFormByExternalRef,
  resolveSubmissionIdentity,
} from "../data/leadFormUtils";
import { upsertAnswers } from "../data/contactLeadAnswers";
import { leadQualificationFromAnswers } from "../data/leadQualification";
import { metaLeadAttribution } from "../data/metaLeadAds";
import { store } from "../data/store";
import type { TeamRole } from "../config/team";
import { useContentLibrary } from "./useContentLibrary";
import { computeDayOffsets, mergeSteps, nextFractionalOrder } from "../lib/workflowUtils";
import { getDefaultOutcomeRules } from "../lib/taskTypeRegistry";
import { getMatchedListings } from "../lib/segmentUtils";
import { computeBulkAssignments, type BulkAssignmentResult } from "../lib/bulkTaskUtils";

// ── Legacy ID migration helpers ───────────────────────────────────────────────
// Old tasks used the pattern: taskitem-call-${enrollmentId}-${stepId}
// New tasks carry enrollmentId and stepId directly as fields.
// These helpers allow the handlers to work with both.

function extractEnrollmentIdFromTaskId(taskId: string): string | undefined {
  // Pattern: taskitem-call-<enrollmentId>-<stepId>
  // enrollmentId itself contains hyphens so we match from the known prefix
  const match = taskId.match(/^taskitem-call-(.+)-([^-]+)$/);
  return match ? match[1] : undefined;
}

function extractStepIdFromTaskId(taskId: string): string | undefined {
  const match = taskId.match(/^taskitem-call-(.+)-([^-]+)$/);
  return match ? match[2] : undefined;
}

interface AppDataContextValue {
  // Data
  contacts: Contact[];
  emailHistory: EmailRecord[];
  tasks: Task[];
  taskItems: TaskItem[];
  contactActivity: ContactActivityRecord[];
  segments: Segment[];
  applications: Application[];
  businessAcquisitions: BusinessAcquisitionRecord[];
  // Task handlers
  handleLogCallDisposition: (taskId: string, disposition: string, note?: string, callStartedAt?: Date, droppedVoicemailName?: string) => void;
  handleCompleteTask: (taskId: string, disposition: string, note?: string) => void;
  /**
   * Complete a task AND apply outcome rules to advance/retry/skip the linked workflow step.
   * Use this for all completion paths that should drive workflow progression.
   */
  handleCompleteTaskWithOutcome: (taskId: string, disposition: string, note?: string) => void;
  handleRescheduleTask: (taskId: string, newDate: Date, assignee?: string, objective?: string) => void;
  handleDeleteTask: (taskId: string) => void;
  handleBulkCompleteTask: (taskIds: string[], disposition: string, note?: string) => void;
  handleBulkRescheduleTask: (taskIds: string[], newDate: Date) => void;
  handleBulkDeleteTask: (taskIds: string[]) => void;
  // Contact handlers
  handleUpdateContact: (contactId: string, updates: Partial<Contact>) => void;
  handleCreateContact: (input: NewContactInput) => Contact;
  // Companies and listings
  companies: Company[];
  handleCreateCompany: (input: Omit<Company, "id" | "createdAt">) => Company;
  listings: ListingRecord[];
  // Campaigns — a first-class object; platform ids and web utm keys point at it
  campaigns: Campaign[];
  /** Lead forms as defined on the platform, with the CRM's field mappings. */
  leadForms: LeadFormDefinition[];
  handleUpdateLeadForm: (id: string, updates: Partial<LeadFormDefinition>) => void;
  contactLeadAnswers: ContactLeadAnswer[];
  inboundLeadEvents: InboundLeadEvent[];
  /** Operator decision on a lead the worker could not confidently place. */
  handleResolveLeadEvent: (eventId: string, contactId: string | null, note: string) => void;
  /** Confirm — or undo — a match the worker made on the weaker signal. */
  handleConfirmLeadEvent: (eventId: string, keepMatch: boolean, note: string) => void;
  /** Connected pages / ad accounts the forms belong to. */
  platformAccounts: PlatformAccount[];
  handleUpdatePlatformAccount: (
    id: string,
    updates: Partial<PlatformAccount>,
  ) => void;
  handleCreateCampaign: (input: Omit<Campaign, "id" | "createdAt">) => Campaign;
  handleUpdateCampaign: (id: string, updates: Partial<Campaign>) => void;
  handleDeleteCampaign: (id: string) => void;
  // Admin-defined custom fields
  customFieldDefinitions: CustomFieldDefinition[];
  handleCreateCustomField: (
    input: Omit<CustomFieldDefinition, "id" | "createdAt">,
  ) => CustomFieldDefinition;
  handleUpdateCustomField: (
    id: string,
    updates: Partial<CustomFieldDefinition>,
  ) => void;
  /** Archives a field: hidden everywhere, every stored answer kept. There is no delete. */
  handleArchiveCustomField: (id: string) => void;
  handleRestoreCustomField: (id: string) => void;
  /** Ingest a marketing form: creates the contact, resolves traffic source, links or
   *  creates the campaign, and auto-discovers unknown answer keys as hidden fields. */
  handleIngestLeadForm: (payload: LeadFormPayload) => LeadIngestResult;
  /** Ingest a Meta Lead Ads submission: no UTM exists, so attribution and the
   *  campaign match are derived from Meta's own ids. */
  handleIngestMetaLead: (payload: MetaLeadPayload) => LeadIngestResult;
  /** Bulk-create from an import; rows whose email already exists are skipped. Returns counts. */
  handleImportContacts: (
    rows: NewContactInput[],
    source: ContactImportSource,
  ) => { imported: number; skipped: number };
  // Standalone task creation
  handleCreateTask: (params: {
    contactId: string;
    contactName: string;
    taskType: string;
    dueDate: Date;
    objective: string;
    vmScript?: string;
    assignee?: string;
  }) => void;
  // Bulk task creation (RFC-008 — assignee follows contact; round-robin fallback for LO-less)
  handleBulkCreateTasks: (params: {
    contactIds: string[];
    taskType: string;
    dueDate: Date;
    objective: string;
    vmScript?: string;
    fallbackPool: string[];
    source?: string;
  }) => BulkAssignmentResult;
  // LO groups (RFC-008 — named round-robin fallback pools)
  loGroups: LoGroup[];
  handleCreateLoGroup: (group: Omit<LoGroup, "id" | "createdAt">) => void;
  handleUpdateLoGroup: (id: string, updates: Partial<Omit<LoGroup, "id" | "createdAt">>) => void;
  handleDeleteLoGroup: (id: string) => void;
  // Segment handlers
  handleCreateSegment: (segment: Omit<Segment, "id" | "createdAt" | "lastUpdatedAt">) => void;
  handleUpdateSegment: (segmentId: string, updates: Partial<Segment>) => void;
  handleDeleteSegment: (segmentId: string) => void;
  // Workflow data
  workflows: Workflow[];
  workflowEnrollments: WorkflowEnrollment[];
  // Workflow handlers
  handleCreateWorkflow: (w: Omit<Workflow, "id" | "createdAt" | "enrolledCount">) => void;
  handleUpdateWorkflow: (id: string, updates: Partial<Workflow>) => void;
  handleDeleteWorkflow: (id: string) => void;
  handleEnrollContacts: (workflowId: string, entries: { contactId: string; listingId?: string }[], startDate: Date) => void;
  handleActivateWorkflow: (workflowId: string) => void;
  handleAdvanceStep: (enrollmentId: string, stepId: string) => void;
  handleMoveToStep: (enrollmentId: string, targetStepId: string | "completed") => void;
  handleSetEnrollmentStatus: (enrollmentId: string, status: "active" | "paused", pausedUntil?: Date, pauseReason?: string) => void;
  handleBulkSetEnrollmentStatus: (enrollmentIds: string[], status: "active" | "paused") => void;
  handlePauseAllEnrollments: (contactId: string, pausedUntil: Date | null, reason: string) => void;
  handleSkipStep: (enrollmentId: string, stepId: string) => void;
  handleBulkSkipSteps: (items: { enrollmentId: string; stepId: string }[]) => void;
  handleUnskipStep: (enrollmentId: string, stepId: string) => void;
  handleCustomizeDelay: (enrollmentId: string, stepId: string, delayDays: number, delayHours: number, delayMinutes: number) => void;
  handleAddCustomStep: (enrollmentId: string, stepDef: Omit<WorkflowStep, "id" | "order" | "dayOffset">, insertAfterStepId: string | null) => void;
  handleRemoveCustomStep: (enrollmentId: string, stepId: string) => void;
  // Admin config data
  adminEmailTemplates: AdminEmailTemplate[];
  smsTemplates: SmsTemplate[];
  voicemailScripts: VoicemailScript[];
  voicemailSettings: VoicemailSettings;
  senderIdentities: SenderIdentity[];
  templateFolders: TemplateFolder[];
  currentUserRole: TeamRole;
  handleSetCurrentUserRole: (role: TeamRole) => void;
  handleCreateFolder: (name: string, parentId: string | null) => void;
  handleRenameFolder: (id: string, name: string) => void;
  handleMoveFolder: (id: string, newParentId: string | null) => void;
  handleSetFolderVisibility: (id: string, visibleToLoanOfficers: boolean) => void;
  handleDeleteFolder: (id: string) => void;
  handleMoveTemplateToFolder: (templateId: string, folderId: string | null) => void;
  // Template categories
  smsCategories: string[];
  voicemailCategories: string[];
  // Category handlers
  handleAddSmsCategory: (name: string) => void;
  handleDeleteSmsCategory: (name: string) => void;
  handleRenameSmsCategory: (oldName: string, newName: string) => void;
  handleAddVoicemailCategory: (name: string) => void;
  handleDeleteVoicemailCategory: (name: string) => void;
  handleRenameVoicemailCategory: (oldName: string, newName: string) => void;
  // Email template handlers
  handleCreateAdminEmailTemplate: (t: Omit<AdminEmailTemplate, "id" | "createdAt" | "updatedAt">) => void;
  handleUpdateAdminEmailTemplate: (id: string, updates: Partial<Omit<AdminEmailTemplate, "id" | "createdAt">>) => void;
  handleDeleteAdminEmailTemplate: (id: string) => void;
  // SMS template handlers
  handleCreateSmsTemplate: (t: Omit<SmsTemplate, "id" | "createdAt" | "updatedAt">) => void;
  handleUpdateSmsTemplate: (id: string, updates: Partial<Omit<SmsTemplate, "id" | "createdAt">>) => void;
  handleDeleteSmsTemplate: (id: string) => void;
  // Voicemail script handlers
  handleCreateVoicemailScript: (s: Omit<VoicemailScript, "id" | "createdAt" | "updatedAt">) => void;
  handleUpdateVoicemailScript: (id: string, updates: Partial<Omit<VoicemailScript, "id" | "createdAt">>) => void;
  handleDeleteVoicemailScript: (id: string) => void;
  // Voicemail settings handler
  handleUpdateVoicemailSettings: (updates: Partial<VoicemailSettings>) => void;
  // Sender identity handlers
  handleCreateSenderIdentity: (s: Omit<SenderIdentity, "id" | "createdAt">) => void;
  handleUpdateSenderIdentity: (id: string, updates: Partial<Omit<SenderIdentity, "id" | "createdAt">>) => void;
  handleDeleteSenderIdentity: (id: string) => void;
  handleSetDefaultSenderIdentity: (id: string) => void;
  handleSendTaskEmail: (taskId: string, subject: string, sender: string) => void;
  // Notification data & handlers
  notifications: Notification[];
  notificationPrefs: NotificationPreferences;
  handleMarkNotificationRead: (id: string) => void;
  handleMarkNotificationUnread: (id: string) => void;
  handleMarkAllNotificationsRead: () => void;
  handleDismissNotification: (id: string) => void;
  handleUpdateNotificationPrefs: (updates: Partial<NotificationPreferences>) => void;
  // Email read-state handlers (V2)
  handleMarkEmailRead: (emailId: string) => void;
  handleMarkContactEmailsRead: (contactId: string) => void;
  handleSendReply: (inboundEmailId: string, body: string, senderIdentity: string) => void;
  // Failed message resend + per-channel opt-out (V2)
  handleResendMessage: (emailId: string) => void;
  handleSetChannelOptOut: (contactId: string, channel: "email" | "sms", optedOut: boolean) => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);


export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>(store.contacts.read());
  const [campaigns, setCampaigns] = useState<Campaign[]>(store.campaigns.read());
  // Defined on the ad platform; the CRM owns the mappings and the on/off switch.
  const [contactLeadAnswers, setContactLeadAnswers] = useState<ContactLeadAnswer[]>(
    store.contactLeadAnswers.read(),
  );
  const [inboundLeadEvents, setInboundLeadEvents] = useState<InboundLeadEvent[]>(
    store.inboundLeadEvents.read(),
  );
  const [leadForms, setLeadForms] = useState<LeadFormDefinition[]>(
    store.leadForms.read(),
  );
  const [platformAccounts, setPlatformAccounts] = useState<PlatformAccount[]>(
    store.platformAccounts.read(),
  );
  const [companies, setCompanies] = useState<Company[]>(store.companies.read());
  const [listings] = useState<ListingRecord[]>(store.listings.read());
  const [customFieldDefinitions, setCustomFieldDefinitions] = useState<
    CustomFieldDefinition[]
  >(store.customFieldDefinitions.read());
  const [emailHistory, setEmailHistory] = useState<EmailRecord[]>(store.emailHistory.read());
  const [tasks, setTasks] = useState<Task[]>(store.tasks.read());
  const [taskItems, setTaskItems] = useState<TaskItem[]>(store.taskItems.read());
  const [contactActivity, setContactActivity] = useState<ContactActivityRecord[]>(store.contactActivity.read());
  const [segments, setSegments] = useState<Segment[]>(store.segments.read());
  const [applications] = useState<Application[]>(store.applications.read());
  const [businessAcquisitions] = useState<BusinessAcquisitionRecord[]>(store.businessAcquisitions.read());
  const [workflows, setWorkflows] = useState<Workflow[]>(store.workflows.read());
  const [workflowEnrollments, setWorkflowEnrollments] = useState<WorkflowEnrollment[]>(store.workflowEnrollments.read());
  const [notifications, setNotifications] = useState<Notification[]>(store.notifications.read());
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(store.notificationPrefs.read());
  const [loGroups, setLoGroups] = useState<LoGroup[]>(store.loGroups.read());

  // Reusable-content domain lives in its own module; same names, same shape.
  const {
    adminEmailTemplates,
    smsTemplates,
    voicemailScripts,
    voicemailSettings,
    senderIdentities,
    templateFolders,
    currentUserRole,
    smsCategories,
    voicemailCategories,
    handleCreateAdminEmailTemplate,
    handleUpdateAdminEmailTemplate,
    handleDeleteAdminEmailTemplate,
    handleSetCurrentUserRole,
    handleCreateFolder,
    handleRenameFolder,
    handleMoveFolder,
    handleSetFolderVisibility,
    handleDeleteFolder,
    handleMoveTemplateToFolder,
    handleCreateSmsTemplate,
    handleUpdateSmsTemplate,
    handleDeleteSmsTemplate,
    handleCreateVoicemailScript,
    handleUpdateVoicemailScript,
    handleDeleteVoicemailScript,
    handleUpdateVoicemailSettings,
    handleCreateSenderIdentity,
    handleUpdateSenderIdentity,
    handleDeleteSenderIdentity,
    handleSetDefaultSenderIdentity,
    handleAddSmsCategory,
    handleDeleteSmsCategory,
    handleRenameSmsCategory,
    handleAddVoicemailCategory,
    handleDeleteVoicemailCategory,
    handleRenameVoicemailCategory,
  } = useContentLibrary();

  const handleUpdateNotificationPrefs = (updates: Partial<NotificationPreferences>) => {
    const updated = { ...notificationPrefs, ...updates };
    setNotificationPrefs(updated);
    store.notificationPrefs.write(updated);
  };

  const addNotification = (partial: Omit<Notification, "id" | "createdAt" | "read">) => {
    if (!notificationPrefs[partial.type]) return;
    const newNotif: Notification = {
      ...partial,
      id: `notif-${Date.now()}`,
      createdAt: new Date(),
      read: false,
    };
    setNotifications((prev) => {
      const updated = [newNotif, ...prev];
      store.notifications.write(updated);
      return updated;
    });
  };

  const handleMarkNotificationRead = (id: string) => {
    const updated = notifications.map((n) => n.id === id ? { ...n, read: true } : n);
    setNotifications(updated);
    store.notifications.write(updated);
  };

  const handleMarkNotificationUnread = (id: string) => {
    const updated = notifications.map((n) => n.id === id ? { ...n, read: false } : n);
    setNotifications(updated);
    store.notifications.write(updated);
  };

  const handleMarkAllNotificationsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    store.notifications.write(updated);
  };

  const handleDismissNotification = (id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    store.notifications.write(updated);
  };

  const handleMarkEmailRead = (emailId: string) => {
    const updated = emailHistory.map((e) => e.id === emailId ? { ...e, read: true } : e);
    setEmailHistory(updated);
    store.emailHistory.write(updated);
  };

  const handleMarkContactEmailsRead = (contactId: string) => {
    const updated = emailHistory.map((e) =>
      e.contactId === contactId && e.direction === "inbound" && !e.read
        ? { ...e, read: true }
        : e,
    );
    setEmailHistory(updated);
    store.emailHistory.write(updated);
  };

  const handleSendReply = (inboundEmailId: string, body: string, senderIdentity: string) => {
    const original = emailHistory.find((e) => e.id === inboundEmailId);
    if (!original) return;
    const newEmail: EmailRecord = {
      id: crypto.randomUUID(),
      contactId: original.contactId,
      contactName: original.contactName,
      subject: original.subject.startsWith("Re:") ? original.subject : `Re: ${original.subject}`,
      senderIdentity,
      status: "Sent",
      sequenceDay: 0,
      sentAt: new Date(),
      channel: original.channel ?? "email",
      direction: "outbound",
      body,
      workflowId: original.workflowId,
      workflowName: original.workflowName,
      stepName: original.stepName,
    };
    const newActivity: ContactActivityRecord = {
      id: `activity-reply-${Date.now()}`,
      contactId: original.contactId,
      type: original.channel === "sms" ? "sms_sent" : "email_sent",
      subject: newEmail.subject,
      source: original.workflowName ?? "Manual",
      sourceType: original.workflowId ? "flow" : "manual",
      stepName: original.stepName,
      assignee: senderIdentity,
      timestamp: new Date(),
    };
    const updated = emailHistory.map((e) => e.id === inboundEmailId ? { ...e, read: true } : e).concat(newEmail);
    const updatedActivity = [...contactActivity, newActivity];
    setEmailHistory(updated);
    setContactActivity(updatedActivity);
    store.emailHistory.write(updated);
    store.contactActivity.write(updatedActivity);
  };

  const handleResendMessage = (emailId: string) => {
    const original = emailHistory.find((e) => e.id === emailId);
    if (!original) return;
    if (original.direction === "inbound") return;

    const contact = contacts.find((c) => c.id === original.contactId);
    const channel = original.channel ?? "email";
    const channelOptOut: ChannelOptOut | undefined = channel === "sms"
      ? contact?.smsOptOut
      : contact?.emailOptOut;

    if (contact?.optedOut || channelOptOut?.optedOut) {
      toast.error(`Cannot resend — contact has opted out of ${channel}`);
      return;
    }

    const originalStatus = original.status;
    const newEmail: EmailRecord = {
      id: crypto.randomUUID(),
      contactId: original.contactId,
      contactName: original.contactName,
      subject: original.subject,
      senderIdentity: original.senderIdentity,
      status: "Sent",
      sequenceDay: original.sequenceDay,
      sentAt: new Date(),
      channel,
      direction: "outbound",
      workflowId: original.workflowId,
      workflowName: original.workflowName,
      stepName: original.stepName,
    };
    const newActivity: ContactActivityRecord = {
      id: `activity-resend-${Date.now()}`,
      contactId: original.contactId,
      type: channel === "sms" ? "sms_sent" : "email_sent",
      subject: newEmail.subject,
      source: original.workflowName ?? "Manual",
      sourceType: original.workflowId ? "flow" : "manual",
      stepName: original.stepName,
      assignee: original.senderIdentity,
      note: `Resent after ${originalStatus}`,
      timestamp: new Date(),
    };
    const updated = [...emailHistory, newEmail];
    const updatedActivity = [...contactActivity, newActivity];
    setEmailHistory(updated);
    setContactActivity(updatedActivity);
    store.emailHistory.write(updated);
    store.contactActivity.write(updatedActivity);
    toast.success(channel === "sms" ? "SMS resent" : "Email resent");
  };

  const handleSetChannelOptOut = (contactId: string, channel: "email" | "sms", optedOut: boolean) => {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;

    const channelData: ChannelOptOut = optedOut
      ? { optedOut: true, source: "manual", optedOutAt: new Date().toISOString() }
      : { optedOut: false };

    const updatedContact: Contact = {
      ...contact,
      ...(channel === "email" ? { emailOptOut: channelData } : { smsOptOut: channelData }),
    };

    // Sync global flag: opted out only when BOTH channels are opted out
    const emailOptedOut = channel === "email" ? optedOut : (contact.emailOptOut?.optedOut === true);
    const smsOptedOut = channel === "sms" ? optedOut : (contact.smsOptOut?.optedOut === true);
    updatedContact.optedOut = emailOptedOut && smsOptedOut;

    const updatedContacts = contacts.map((c) => c.id === contactId ? updatedContact : c);

    const channelLabel = channel === "email" ? "Email opt-out" : "SMS opt-out";
    const newActivity: ContactActivityRecord = {
      id: `activity-optout-${Date.now()}`,
      contactId,
      type: "contact_updated",
      updatedFields: [channelLabel],
      assignee: "You",
      timestamp: new Date(),
    };
    const updatedActivity = [...contactActivity, newActivity];

    setContacts(updatedContacts);
    setContactActivity(updatedActivity);
    store.contacts.write(updatedContacts);
    store.contactActivity.write(updatedActivity);
  };

  const handleLogCallDisposition = (taskId: string, disposition: string, note?: string, callStartedAt?: Date, droppedVoicemailName?: string) => {
    const now = new Date();
    const task = taskItems.find((ti) => ti.id === taskId);
    const updatedItems = taskItems.map((ti) =>
      ti.id === taskId
        ? {
            ...ti,
            disposition,
            dispositionLoggedAt: now,
            ...(callStartedAt ? { callStartedAt } : {}),
            ...(droppedVoicemailName ? { droppedVoicemailName } : {}),
            ...(note ? { outcome: note } : {}),
          }
        : ti,
    );
    const newActivity: ContactActivityRecord = {
      id: `activity-${Date.now()}`,
      contactId: task?.contactId ?? "",
      type: "call_outcome_captured",
      taskType: task?.taskType,
      disposition,
      note: note || undefined,
      source: task?.source,
      sourceType: task?.sourceType,
      stepName: task?.ruleName,
      assignee: task?.assignee,
      timestamp: now,
    };
    setTaskItems(updatedItems);
    store.taskItems.write(updatedItems);
    if (task) {
      const updatedActivity = [...contactActivity, newActivity];
      setContactActivity(updatedActivity);
      store.contactActivity.write(updatedActivity);
    }
  };

  const handleCompleteTask = (taskId: string, disposition: string, note?: string) => {
    const now = new Date();
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, status: "completed" as const, disposition } : t,
    );
    const completedItem = taskItems.find((ti) => ti.id === taskId || ti.id.includes(taskId));
    const updatedItems = taskItems.map((ti) =>
      ti.id === taskId || ti.id.includes(taskId)
        ? { ...ti, status: "completed" as const, disposition, completedAt: now, ...(note ? { outcome: note } : {}) }
        : ti,
    );
    const newActivity: ContactActivityRecord = {
      id: `activity-${Date.now()}`,
      contactId: completedItem?.contactId ?? "",
      type: "task_completed",
      taskType: completedItem?.taskType,
      disposition,
      note: note || undefined,
      source: completedItem?.source,
      sourceType: completedItem?.sourceType,
      stepName: completedItem?.ruleName,
      assignee: completedItem?.assignee,
      timestamp: now,
    };
    const updatedActivity = completedItem
      ? [...contactActivity, newActivity]
      : contactActivity;
    setTasks(updatedTasks);
    setTaskItems(updatedItems);
    if (completedItem) {
      setContactActivity(updatedActivity);
      store.contactActivity.write(updatedActivity);
    }
    store.tasks.write(updatedTasks);
    store.taskItems.write(updatedItems);
  };

  /**
   * Complete a task and apply outcome rules to drive the linked workflow step.
   * This is the single entry point for outcome-based task completion.
   */
  const handleCompleteTaskWithOutcome = (taskId: string, disposition: string, note?: string) => {
    const now = new Date();

    // 1. Find the task item
    const task = taskItems.find((ti) => ti.id === taskId || ti.id.includes(taskId));
    if (!task) {
      // Fallback: just complete without workflow logic
      handleCompleteTask(taskId, disposition, note);
      return;
    }

    // 2. Mark the task completed
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, status: "completed" as const, disposition } : t,
    );
    const updatedItems = taskItems.map((ti) =>
      ti.id === taskId || ti.id.includes(taskId)
        ? { ...ti, status: "completed" as const, disposition, completedAt: now, ...(note ? { outcome: note } : {}) }
        : ti,
    );

    // 3. Log activity
    const newActivity: ContactActivityRecord = {
      id: `activity-${Date.now()}`,
      contactId: task.contactId,
      type: "task_completed",
      taskType: task.taskType,
      disposition,
      note: note || undefined,
      source: task.source,
      sourceType: task.sourceType,
      stepName: task.ruleName,
      assignee: task.assignee,
      timestamp: now,
    };
    let updatedActivity = [...contactActivity, newActivity];

    // 4. Apply outcome rules if this task is linked to a workflow step
    const enrollmentId = task.enrollmentId ?? extractEnrollmentIdFromTaskId(task.id);
    const stepId = task.stepId ?? extractStepIdFromTaskId(task.id);

    let finalItems = updatedItems;
    let finalEnrollments = workflowEnrollments;
    let finalWorkflows = workflows;

    if (enrollmentId && stepId) {
      const enrollment = workflowEnrollments.find((e) => e.id === enrollmentId);
      const workflow = workflows.find((wf) => wf.id === enrollment?.workflowId);
      if (enrollment && workflow) {
        const allSteps = mergeSteps(workflow.steps, enrollment.customSteps);
        const step = allSteps.find((s) => s.id === stepId);
        const outcomeRules = step?.outcomeRules ?? getDefaultOutcomeRules(task.taskType);
        const matchingRule = outcomeRules.find((r) => r.disposition === disposition);
        const action = matchingRule?.action ?? "advance";
        const contact = contacts.find((c) => c.id === enrollment.contactId);

        if (action === "advance" || action === "advance-and-insert-followup") {
          // Mark the step done and auto-advance delays
          let finalProgress = enrollment.stepProgress.map((p) =>
            p.stepId === stepId ? { ...p, status: "done" as const, completedAt: now } : p,
          );
          const sortedSteps = allSteps;
          let advIdx = sortedSteps.findIndex((s) => s.id === stepId);
          while (++advIdx < sortedSteps.length && sortedSteps[advIdx].actionType === "delay") {
            const delayId = sortedSteps[advIdx].id;
            finalProgress = finalProgress.map((p) =>
              p.stepId === delayId ? { ...p, status: "done" as const, completedAt: now } : p,
            );
          }
          const allDone = finalProgress.every((p) => p.status === "done" || p.status === "skipped");

          if (allDone) {
            const completedContact = contacts.find((c) => c.id === enrollment.contactId);
            const contactName = completedContact
              ? `${completedContact.firstName} ${completedContact.lastName}`
              : enrollment.contactId;
            addNotification({
              type: "enrollment_completed",
              title: `${contactName} completed "${workflow.name}"`,
              message: `${contactName} has completed all steps in "${workflow.name}".`,
              workflowId: enrollment.workflowId,
              contactId: enrollment.contactId,
            });
          }

          const updatedEnrollment: WorkflowEnrollment = {
            ...enrollment,
            stepProgress: finalProgress,
            status: allDone ? "completed" : "active",
          };
          finalEnrollments = workflowEnrollments.map((e) =>
            e.id === enrollmentId ? updatedEnrollment : e,
          );
          finalWorkflows = allDone
            ? workflows.map((wf) =>
                wf.id === workflow.id ? { ...wf, enrolledCount: Math.max(0, wf.enrolledCount - 1) } : wf,
              )
            : workflows;

          // Insert follow-up task if needed
          if (action === "advance-and-insert-followup" && matchingRule?.followup) {
            const fu = matchingRule.followup;
            const fuDueDate = new Date(now.getTime() + fu.delayDays * 24 * 60 * 60 * 1000);
            const fuItem: TaskItem = {
              id: `taskitem-followup-${Date.now()}`,
              contactId: task.contactId,
              contactName: task.contactName,
              contactStatus: task.contactStatus,
              taskType: fu.taskType,
              source: task.source,
              sourceType: task.sourceType,
              dueDate: fuDueDate,
              assignee: task.assignee,
              status: "pending",
              triggerContext: fu.objective,
              notes: fu.notes,
              enrollmentId,
              parentTaskId: task.id,
            };
            finalItems = [...updatedItems, fuItem];

            const fuActivity: ContactActivityRecord = {
              id: `activity-followup-${Date.now()}`,
              contactId: task.contactId,
              type: "task_retry_created",
              taskType: fu.taskType,
              source: task.source,
              sourceType: task.sourceType,
              assignee: task.assignee,
              timestamp: now,
            };
            updatedActivity = [...updatedActivity, fuActivity];
          }
        } else if (action === "retry") {
          const currentRetry = task.retryCount ?? 0;
          const maxRetries = matchingRule?.maxRetries ?? 3;
          if (currentRetry < maxRetries) {
            const retryDays = matchingRule?.retryAfterDays ?? 2;
            const retryDue = new Date(now.getTime() + retryDays * 24 * 60 * 60 * 1000);
            const retryItem: TaskItem = {
              id: `taskitem-retry-${Date.now()}`,
              contactId: task.contactId,
              contactName: task.contactName,
              contactStatus: task.contactStatus,
              taskType: task.taskType,
              source: task.source,
              sourceType: task.sourceType,
              dueDate: retryDue,
              assignee: task.assignee,
              status: "pending",
              triggerContext: task.triggerContext,
              notes: task.notes,
              enrollmentId,
              stepId,
              retryCount: currentRetry + 1,
              parentTaskId: task.id,
              ruleId: task.ruleId,
              ruleName: task.ruleName,
            };
            finalItems = [...updatedItems, retryItem];

            const retryActivity: ContactActivityRecord = {
              id: `activity-retry-${Date.now()}`,
              contactId: task.contactId,
              type: "task_retry_created",
              taskType: task.taskType,
              source: task.source,
              sourceType: task.sourceType,
              assignee: task.assignee,
              timestamp: now,
              retryOf: task.id,
            };
            updatedActivity = [...updatedActivity, retryActivity];
          } else {
            // Max retries reached — advance the step anyway
            const finalProgress = enrollment.stepProgress.map((p) =>
              p.stepId === stepId ? { ...p, status: "done" as const, completedAt: now } : p,
            );
            const allDone = finalProgress.every((p) => p.status === "done" || p.status === "skipped");
            finalEnrollments = workflowEnrollments.map((e) =>
              e.id === enrollmentId
                ? { ...e, stepProgress: finalProgress, status: allDone ? "completed" : "active" }
                : e,
            );
          }
        } else if (action === "skip-remaining") {
          // Mark all remaining steps skipped and complete the enrollment
          const finalProgress = enrollment.stepProgress.map((p) => {
            const existing = p.status;
            if (existing === "done" || existing === "skipped") return p;
            return { ...p, status: "skipped" as const };
          });
          finalEnrollments = workflowEnrollments.map((e) =>
            e.id === enrollmentId ? { ...e, stepProgress: finalProgress, status: "completed" as const } : e,
          );
          finalWorkflows = workflows.map((wf) =>
            wf.id === workflow.id ? { ...wf, enrolledCount: Math.max(0, wf.enrolledCount - 1) } : wf,
          );
        } else if (action === "pause-enrollment") {
          // Pause the enrollment and suspend all pending tasks for this contact
          finalEnrollments = workflowEnrollments.map((e) =>
            e.id === enrollmentId ? { ...e, status: "paused" as const } : e,
          );
          finalItems = updatedItems.map((ti) =>
            ti.enrollmentId === enrollmentId && ti.status === "pending" && ti.id !== taskId
              ? { ...ti, status: "suspended" as const }
              : ti,
          );

          const pauseActivity: ContactActivityRecord = {
            id: `activity-pause-${Date.now()}`,
            contactId: task.contactId,
            type: "enrollment_paused",
            source: workflow.name,
            sourceType: "flow",
            assignee: contact ? `${contact.firstName} ${contact.lastName}` : "System",
            timestamp: now,
          };
          updatedActivity = [...updatedActivity, pauseActivity];
        }
      }
    }

    // 5. Write all state
    setTasks(updatedTasks);
    setTaskItems(finalItems);
    setContactActivity(updatedActivity);
    setWorkflowEnrollments(finalEnrollments);
    setWorkflows(finalWorkflows);
    store.tasks.write(updatedTasks);
    store.taskItems.write(finalItems);
    store.contactActivity.write(updatedActivity);
    store.workflowEnrollments.write(finalEnrollments);
    store.workflows.write(finalWorkflows);
  };

  const handleSendTaskEmail = (taskId: string, subject: string, sender: string) => {
    const task = taskItems.find((t) => t.id === taskId);
    if (!task) return;

    const newEmail: EmailRecord = {
      id: crypto.randomUUID(),
      contactId: task.contactId,
      contactName: task.contactName,
      subject,
      senderIdentity: sender,
      status: "Sent",
      sequenceDay: 0,
      sentAt: new Date(),
      channel: "email",
    };

    const updatedHistory = [...emailHistory, newEmail];
    setEmailHistory(updatedHistory);
    store.emailHistory.write(updatedHistory);
  };

  const handleRescheduleTask = (taskId: string, newDate: Date, assignee?: string, objective?: string) => {
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, scheduledFor: newDate, ...(assignee !== undefined && { assignee }) } : t,
    );
    const updatedItems = taskItems.map((ti) =>
      ti.id.includes(taskId)
        ? {
            ...ti,
            dueDate: newDate,
            ...(assignee !== undefined && { assignee }),
            ...(objective !== undefined && { triggerContext: objective }),
          }
        : ti,
    );
    setTasks(updatedTasks);
    setTaskItems(updatedItems);
    store.tasks.write(updatedTasks);
    store.taskItems.write(updatedItems);
  };

  const handleDeleteTask = (taskId: string) => {
    const updatedTasks = tasks.filter((t) => t.id !== taskId);
    const updatedItems = taskItems.filter((ti) => !ti.id.includes(taskId));
    setTasks(updatedTasks);
    setTaskItems(updatedItems);
    store.tasks.write(updatedTasks);
    store.taskItems.write(updatedItems);
  };

  const handleBulkCompleteTask = (taskIds: string[], disposition: string, note?: string) => {
    const now = new Date();
    const idSet = new Set(taskIds);
    const updatedTasks = tasks.map((t) =>
      idSet.has(t.id) ? { ...t, status: "completed" as const, disposition } : t,
    );
    const completedItems = taskItems.filter((ti) => taskIds.some((id) => ti.id === id || ti.id.includes(id)));
    const updatedItems = taskItems.map((ti) =>
      taskIds.some((id) => ti.id === id || ti.id.includes(id))
        ? { ...ti, status: "completed" as const, disposition, completedAt: now, ...(note ? { outcome: note } : {}) }
        : ti,
    );
    const newActivities: ContactActivityRecord[] = completedItems.map((ti, i) => ({
      id: `activity-bulk-${Date.now()}-${i}`,
      contactId: ti.contactId,
      type: "task_completed" as const,
      taskType: ti.taskType,
      disposition,
      note: note || undefined,
      source: ti.source,
      sourceType: ti.sourceType,
      stepName: ti.ruleName,
      assignee: ti.assignee,
      timestamp: now,
    }));
    const updatedActivity = [...contactActivity, ...newActivities];
    setTasks(updatedTasks);
    setTaskItems(updatedItems);
    setContactActivity(updatedActivity);
    store.tasks.write(updatedTasks);
    store.taskItems.write(updatedItems);
    store.contactActivity.write(updatedActivity);
  };

  const handleBulkRescheduleTask = (taskIds: string[], newDate: Date) => {
    const idSet = new Set(taskIds);
    const updatedTasks = tasks.map((t) =>
      idSet.has(t.id) ? { ...t, scheduledFor: newDate } : t,
    );
    const updatedItems = taskItems.map((ti) =>
      taskIds.some((id) => ti.id.includes(id)) ? { ...ti, dueDate: newDate } : ti,
    );
    setTasks(updatedTasks);
    setTaskItems(updatedItems);
    store.tasks.write(updatedTasks);
    store.taskItems.write(updatedItems);
  };

  const handleBulkDeleteTask = (taskIds: string[]) => {
    const idSet = new Set(taskIds);
    const updatedTasks = tasks.filter((t) => !idSet.has(t.id));
    const updatedItems = taskItems.filter(
      (ti) => !taskIds.some((id) => ti.id.includes(id)),
    );
    setTasks(updatedTasks);
    setTaskItems(updatedItems);
    store.tasks.write(updatedTasks);
    store.taskItems.write(updatedItems);
  };

  const handleCreateTask = (params: {
    contactId: string;
    contactName: string;
    taskType: string;
    dueDate: Date;
    objective: string;
    vmScript?: string;
    assignee?: string;
  }) => {
    const contact = contacts.find((c) => c.id === params.contactId);
    const uniqueId = `manual-${Date.now()}`;
    const newTask: Task = {
      id: `task-${uniqueId}`,
      contactId: params.contactId,
      contactName: params.contactName,
      contactPhone: contact?.phone ?? "",
      listingStatus: contact?.listingStatus ?? "",
      callObjective: params.objective,
      voicemailScript: params.vmScript ?? "",
      dueDay: 0,
      scheduledFor: params.dueDate,
      status: "pending",
    };
    const newItem: TaskItem = {
      id: `taskitem-${uniqueId}`,
      contactId: params.contactId,
      contactName: params.contactName,
      contactStatus: contact?.listingStatus ?? "",
      taskType: params.taskType,
      source: "Manual",
      sourceType: "manual",
      dueDate: params.dueDate,
      assignee: params.assignee ?? "",
      status: "pending",
      triggerContext: params.objective,
      notes: params.vmScript,
      disposition: "",
    };
    const updatedTasks = [...tasks, newTask];
    const updatedItems = [...taskItems, newItem];
    setTasks(updatedTasks);
    setTaskItems(updatedItems);
    store.tasks.write(updatedTasks);
    store.taskItems.write(updatedItems);
  };

  const handleBulkCreateTasks = (params: {
    contactIds: string[];
    taskType: string;
    dueDate: Date;
    objective: string;
    vmScript?: string;
    fallbackPool: string[];
    source?: string;
  }): BulkAssignmentResult => {
    const contactById = new Map(contacts.map((c) => [c.id, c]));
    const targets = params.contactIds
      .map((id) => contactById.get(id))
      .filter((c): c is Contact => !!c);

    const result = computeBulkAssignments(targets, params.fallbackPool);
    const batchId = Date.now();
    const source = params.source ?? "Bulk create";

    const newTasks: Task[] = [];
    const newItems: TaskItem[] = [];
    // Round-robin assigns the picked LO to BOTH the contact and the task.
    const contactLoUpdates = new Map<string, string>();

    result.assignments.forEach((a, i) => {
      const contact = contactById.get(a.contactId);
      const uniqueId = `bulk-${batchId}-${i}`;
      newTasks.push({
        id: `task-${uniqueId}`,
        contactId: a.contactId,
        contactName: a.contactName,
        contactPhone: contact?.phone ?? "",
        listingStatus: contact?.listingStatus ?? "",
        callObjective: params.objective,
        voicemailScript: params.vmScript ?? "",
        dueDay: 0,
        scheduledFor: params.dueDate,
        status: "pending",
      });
      newItems.push({
        id: `taskitem-${uniqueId}`,
        contactId: a.contactId,
        contactName: a.contactName,
        contactStatus: contact?.listingStatus ?? "",
        taskType: params.taskType,
        source,
        sourceType: "manual",
        dueDate: params.dueDate,
        assignee: a.assignee,
        status: "pending",
        triggerContext: params.objective,
        notes: params.vmScript,
        disposition: "",
      });
      if (a.viaRoundRobin && a.assignee) contactLoUpdates.set(a.contactId, a.assignee);
    });

    const updatedTasks = [...tasks, ...newTasks];
    const updatedItems = [...taskItems, ...newItems];
    setTasks(updatedTasks);
    setTaskItems(updatedItems);
    store.tasks.write(updatedTasks);
    store.taskItems.write(updatedItems);

    if (contactLoUpdates.size > 0) {
      const updatedContacts = contacts.map((c) =>
        contactLoUpdates.has(c.id) ? { ...c, loanOfficer: contactLoUpdates.get(c.id) } : c,
      );
      setContacts(updatedContacts);
      store.contacts.write(updatedContacts);
    }

    return result;
  };

  const handleCreateLoGroup = (group: Omit<LoGroup, "id" | "createdAt">) => {
    const newGroup: LoGroup = { ...group, id: `log-${Date.now()}`, createdAt: new Date() };
    const updated = [...loGroups, newGroup];
    setLoGroups(updated);
    store.loGroups.write(updated);
  };

  const handleUpdateLoGroup = (id: string, updates: Partial<Omit<LoGroup, "id" | "createdAt">>) => {
    const updated = loGroups.map((g) => (g.id === id ? { ...g, ...updates } : g));
    setLoGroups(updated);
    store.loGroups.write(updated);
  };

  const handleDeleteLoGroup = (id: string) => {
    const updated = loGroups.filter((g) => g.id !== id);
    setLoGroups(updated);
    store.loGroups.write(updated);
  };

  const handleUpdateContact = (contactId: string, updates: Partial<Contact>) => {
    const updated = contacts.map((c) =>
      c.id === contactId ? { ...c, ...updates } : c,
    );
    setContacts(updated);
    store.contacts.write(updated);
  };

  // Import source maps to the CRM's `lead_source` value, matching the backend's importer keys.
  const LEAD_SOURCE_BY_IMPORT: Record<ContactImportSource, string> = {
    csv: "csv_import",
    bizbuysell: "bizbuysell_checkbox",
  };

  const buildContact = (input: NewContactInput, seq = 0): Contact => ({
    listingName: "",
    listingStatus: "New",
    phone: "",
    userType: "Borrower",
    status: "Active",
    optedOut: false,
    openReminders: 0,
    ...input,
    id: `contact-${Date.now()}-${seq}`,
    createAt: new Date(),
  });

  const handleCreateContact = (input: NewContactInput): Contact => {
    const created = buildContact({ leadSource: "manual", ...input });
    const updated = [created, ...contacts];
    setContacts(updated);
    store.contacts.write(updated);
    return created;
  };

  const handleImportContacts = (
    rows: NewContactInput[],
    source: ContactImportSource,
  ): { imported: number; skipped: number } => {
    // Email is the dedupe key here, same as the real importer.
    const seen = new Set(contacts.map((c) => c.email.trim().toLowerCase()));
    const created: Contact[] = [];

    rows.forEach((row, index) => {
      const email = row.email.trim().toLowerCase();
      if (!email || seen.has(email)) return;
      seen.add(email);
      created.push(
        buildContact({ leadSource: LEAD_SOURCE_BY_IMPORT[source], ...row }, index),
      );
    });

    if (created.length > 0) {
      const updated = [...created, ...contacts];
      setContacts(updated);
      store.contacts.write(updated);
    }

    return { imported: created.length, skipped: rows.length - created.length };
  };

  const handleCreateCompany = (input: Omit<Company, "id" | "createdAt">): Company => {
    const created: Company = {
      ...input,
      id: `co-${Date.now()}`,
      createdAt: new Date(),
    };
    const updated = [created, ...companies];
    setCompanies(updated);
    store.companies.write(updated);
    return created;
  };

  /**
   * Working a lead the worker would not place on its own.
   *
   * `resolution` is left as the worker recorded it. That field says what the system
   * concluded, and overwriting it with the operator's answer would erase the only
   * evidence of how often the automatic path is wrong — which is exactly the number
   * worth watching. The human decision is a separate fact: `resolvedAt` plus a note.
   */
  const handleResolveLeadEvent = (
    eventId: string,
    contactId: string | null,
    note: string,
  ) => {
    const updated = inboundLeadEvents.map((e) =>
      e.id === eventId
        ? { ...e, contactId: contactId ?? undefined, resolvedAt: new Date(), resolvedByNote: note }
        : e,
    );
    setInboundLeadEvents(updated);
    store.inboundLeadEvents.write(updated);
  };

  const handleConfirmLeadEvent = (eventId: string, keepMatch: boolean, note: string) => {
    const updated = inboundLeadEvents.map((e) =>
      e.id === eventId
        ? {
            ...e,
            // Undoing detaches the contact but keeps the submission — the answers were
            // still received, they simply do not belong to that person.
            contactId: keepMatch ? e.contactId : undefined,
            resolvedAt: new Date(),
            resolvedByNote: note,
          }
        : e,
    );
    setInboundLeadEvents(updated);
    store.inboundLeadEvents.write(updated);
  };

  const handleUpdateLeadForm = (
    id: string,
    updates: Partial<LeadFormDefinition>,
  ) => {
    const updated = leadForms.map((f) => (f.id === id ? { ...f, ...updates } : f));
    setLeadForms(updated);
    store.leadForms.write(updated);
  };

  const handleUpdatePlatformAccount = (
    id: string,
    updates: Partial<PlatformAccount>,
  ) => {
    const updated = platformAccounts.map((a) =>
      a.id === id ? { ...a, ...updates } : a,
    );
    setPlatformAccounts(updated);
    store.platformAccounts.write(updated);
  };

  const handleCreateCampaign = (input: Omit<Campaign, "id" | "createdAt">): Campaign => {
    const created: Campaign = {
      ...input,
      id: `campaign-${Date.now()}`,
      createdAt: new Date(),
    };
    const updated = [created, ...campaigns];
    setCampaigns(updated);
    store.campaigns.write(updated);
    return created;
  };

  const handleUpdateCampaign = (id: string, updates: Partial<Campaign>) => {
    const updated = campaigns.map((c) => (c.id === id ? { ...c, ...updates } : c));
    setCampaigns(updated);
    store.campaigns.write(updated);
  };

  const handleDeleteCampaign = (id: string) => {
    const updated = campaigns.filter((c) => c.id !== id);
    setCampaigns(updated);
    store.campaigns.write(updated);
    // Contacts keep their history: clear the pointer rather than deleting the contact.
    const detached = contacts.map((c) =>
      c.campaignId === id ? { ...c, campaignId: undefined } : c,
    );
    setContacts(detached);
    store.contacts.write(detached);
  };

  const handleCreateCustomField = (
    input: Omit<CustomFieldDefinition, "id" | "createdAt">,
  ): CustomFieldDefinition => {
    const created: CustomFieldDefinition = {
      ...input,
      id: `cfd-${Date.now()}`,
      createdAt: new Date(),
    };
    const updated = [...customFieldDefinitions, created];
    setCustomFieldDefinitions(updated);
    store.customFieldDefinitions.write(updated);
    return created;
  };

  const handleUpdateCustomField = (
    id: string,
    updates: Partial<CustomFieldDefinition>,
  ) => {
    const updated = customFieldDefinitions.map((f) =>
      f.id === id ? { ...f, ...updates } : f,
    );
    setCustomFieldDefinitions(updated);
    store.customFieldDefinitions.write(updated);
  };

  /**
   * Archive, never delete.
   *
   * A `contact_lead_answers` row is the only copy of what a lead typed into an ad.
   * Removing the definition would leave those answers with no label, no type and no
   * way to bring them back, so the field is hidden instead and every stored answer
   * stays exactly where it is.
   */
  const handleArchiveCustomField = (id: string) => {
    const updated = customFieldDefinitions.map((f) =>
      f.id === id ? { ...f, archivedAt: new Date() } : f,
    );
    setCustomFieldDefinitions(updated);
    store.customFieldDefinitions.write(updated);
  };

  /** Restores a field with its visibility and filterability exactly as they were. */
  const handleRestoreCustomField = (id: string) => {
    const updated = customFieldDefinitions.map((f) =>
      f.id === id ? { ...f, archivedAt: undefined } : f,
    );
    setCustomFieldDefinitions(updated);
    store.customFieldDefinitions.write(updated);
  };

  /**
   * Unknown answer keys become hidden definitions: no engineering work to accept a
   * new form, no UI clutter until an admin turns the field on. Shared by every
   * ingest adapter — the discovery rule does not depend on where the lead came from.
   */
  const discoverAnswerFields = (answers: Record<string, string>) => {
    const knownKeys = new Set(customFieldDefinitions.map((f) => f.key));
    const discoveredKeys = Object.keys(answers).filter((key) => !knownKeys.has(key));
    const nextDefinitions: CustomFieldDefinition[] = [
      ...customFieldDefinitions,
      ...discoveredKeys.map((key, index) => ({
        id: `cfd-auto-${Date.now()}-${index}`,
        key,
        label: key.replace(/_/g, " ").replace(/^\w/, (ch) => ch.toUpperCase()),
        type: "text" as const,
        section: "Questionnaire",
        isVisible: false,
        isFilterable: false,
        isAutoDiscovered: true,
        createdAt: new Date(),
      })),
    ];
    return { discoveredKeys, nextDefinitions };
  };

  /**
   * A lead whose email we already hold is a re-conversion, not a new person.
   *
   * `originalTrafficSource` is written once, at creation, and never touched again —
   * that is what makes it *original*, and there is no "latest" column to move it
   * to: most-recent-touch is a query over inboundLeadEvents, which holds one row per
   * submission and so answers the whole history rather than only its last entry.
   * Answers merge, newest winning.
   */
  const applyReconversion = (
    existing: Contact,
    answers: Record<string, string>,
    incomingLeadSource?: string,
  ): Contact => ({
    ...existing,
    // Two rules, deliberately opposite. Attribution is history and cannot be
    // rewritten by a later visit; the four underwriting criteria are a claim about
    // the present, so the newest answer replaces the old one.
    //
    // First touch wins: someone who first arrived through BizBuySell keeps that
    // origin even after filling in a Facebook form. Getting this wrong silently
    // rewrites where an existing lead came from, which is the one attribution
    // regression this design can still have.
    leadSource: incomingLeadSource
      ? resolveLeadSource(existing.leadSource, incomingLeadSource)
      : existing.leadSource,
    ...leadQualificationFromAnswers(answers),
    updatedAt: new Date(),
  });

  const findContactByEmail = (email: string): Contact | undefined => {
    const needle = email.trim().toLowerCase();
    return needle
      ? contacts.find((c) => c.email.trim().toLowerCase() === needle)
      : undefined;
  };

  /** Persists everything one ingested lead touches, in one place. */
  const commitIngest = (
    contact: Contact,
    isReturning: boolean,
    nextCampaigns: Campaign[] | null,
    discoveredKeys: string[],
    nextDefinitions: CustomFieldDefinition[],
    answers: Record<string, string>,
    leadFormId?: string,
  ) => {
    const nextContacts = isReturning
      ? contacts.map((c) => (c.id === contact.id ? contact : c))
      : [contact, ...contacts];
    setContacts(nextContacts);
    store.contacts.write(nextContacts);

    if (nextCampaigns) {
      setCampaigns(nextCampaigns);
      store.campaigns.write(nextCampaigns);
    }
    if (discoveredKeys.length > 0) {
      setCustomFieldDefinitions(nextDefinitions);
      store.customFieldDefinitions.write(nextDefinitions);
    }

    // Answers are rows, upserted one question at a time. A returning lead updates the
    // questions this submission asked and leaves the rest standing — the behaviour a
    // single merged blob could only approximate.
    const nextAnswers = upsertAnswers(
      contactLeadAnswers,
      contact.id,
      answers,
      new Date().toISOString(),
      leadFormId,
    );
    setContactLeadAnswers(nextAnswers);
    store.contactLeadAnswers.write(nextAnswers);
  };

  const handleIngestLeadForm = (payload: LeadFormPayload): LeadIngestResult => {
    const resolvedLeadSource = leadSourceFromUtm(payload.utmSource, payload.utmMedium);

    // Find-or-create the campaign from utm_campaign — marketing never files a ticket
    // to register a new one. The key is stored as a `web` external ref, so this is the
    // same lookup Meta uses with a campaign id; only the platform differs.
    let campaignId: string | null = null;
    let campaignCreated = false;
    let nextCampaigns: Campaign[] | null = null;
    const utmCampaign = payload.utmCampaign?.trim();

    if (utmCampaign) {
      const existing = findCampaignByExternalId(campaigns, "web", utmCampaign);
      if (existing) {
        campaignId = existing.id;
      } else {
        const created: Campaign = {
          id: `campaign-${Date.now()}`,
          name: utmCampaign,
          status: "Active",
          startDate: new Date(),
          description: "Auto-created from an inbound lead form.",
          externalRefs: [
            {
              platform: "web",
              externalId: utmCampaign,
              externalName: `utm_campaign=${utmCampaign}`,
            },
          ],
          createdAt: new Date(),
        };
        nextCampaigns = [created, ...campaigns];
        campaignId = created.id;
        campaignCreated = true;
      }
    }

    const { discoveredKeys, nextDefinitions } = discoverAnswerFields(payload.answers);

    const existing = findContactByEmail(payload.email);
    const contact = existing
      ? applyReconversion(existing, payload.answers, resolvedLeadSource)
      : buildContact({
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          phone: payload.phone ?? "",
          userType: "Borrower",
          leadSource: resolvedLeadSource,
          attributionSource: "web-form",
          campaignId: campaignId ?? undefined,
          ...leadQualificationFromAnswers(payload.answers),
        });

    commitIngest(
      contact,
      Boolean(existing),
      nextCampaigns,
      discoveredKeys,
      nextDefinitions,
      payload.answers,
    );

    return {
      contact,
      leadSource: resolvedLeadSource,
      leadSourceKept: Boolean(existing) && contact.leadSource !== resolvedLeadSource,
      campaignId,
      campaignCreated,
      discoveredKeys,
      campaignMatchedBy: campaignId ? "utm_campaign" : null,
      campaignMatchValue: utmCampaign || undefined,
      isReturningContact: Boolean(existing),
      identity: "email",
    };
  };

  /**
   * Meta Lead Ads ingest — the same endpoint, a different adapter.
   *
   * Nothing here reads a UTM, because Meta never sends one: the Instant Form lives
   * inside the app. Attribution is derived from the platform's ids, and the campaign
   * is matched on `campaign_id` against `Campaign.externalRefs` so a rename in Ads
   * Manager cannot detach a lead from the campaign it belongs to.
   */
  const handleIngestMetaLead = (payload: MetaLeadPayload): LeadIngestResult => {
    const attribution = metaLeadAttribution(payload);

    // Identity first. A lead ad can be submitted with no email at all, and whether
    // that becomes a contact is a policy decision, not an accident of the code.
    const identity = resolveSubmissionIdentity({ email: payload.email, phone: payload.phone });
    if (identity.kind === "none") {
      return {
        skipped: true,
        identity: "none",
        leadSource: attribution.leadSource,
        campaignId: null,
        campaignCreated: false,
        discoveredKeys: [],
        campaignMatchedBy: null,
        isReturningContact: false,
      };
    }

    let campaignId: string | null = null;
    let campaignCreated = false;
    let nextCampaigns: Campaign[] | null = null;
    const metaCampaignId = payload.campaignId?.trim();

    if (metaCampaignId) {
      const existing = findCampaignByExternalId(campaigns, "meta", metaCampaignId);
      if (existing) {
        campaignId = existing.id;
      } else {
        // New Meta campaign: register it with its external ref so the next lead from
        // the same id matches instantly, whatever the campaign is called by then.
        const name = payload.campaignName?.trim() || `Meta campaign ${metaCampaignId}`;
        const created: Campaign = {
          id: `campaign-${Date.now()}`,
          name,
          status: "Active",
          startDate: new Date(),
          description: "Auto-created from a Meta Lead Ads submission.",
          externalRefs: [
            { platform: "meta", externalId: metaCampaignId, externalName: name },
          ],
          createdAt: new Date(),
        };
        nextCampaigns = [created, ...campaigns];
        campaignId = created.id;
        campaignCreated = true;
      }
    }

    const { discoveredKeys, nextDefinitions } = discoverAnswerFields(payload.answers);

    // Same re-conversion rule as the web form: one adapter reading a different
    // payload should not mean a different attribution policy.
    const leadForm = leadFormByExternalRef(leadForms, "meta", payload.formId);
    const existing = findContactByIdentity(identity, contacts);
    const contact = existing
      ? applyReconversion(existing, payload.answers, attribution.leadSource)
      : buildContact({
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          phone: payload.phone ?? "",
          userType: "Borrower",
          leadSource: attribution.leadSource,
          attributionSource: "service-meta-lead-ads",
          campaignId: campaignId ?? undefined,
          ...leadQualificationFromAnswers(payload.answers),
        });

    commitIngest(
      contact,
      Boolean(existing),
      nextCampaigns,
      discoveredKeys,
      nextDefinitions,
      payload.answers,
      leadForm?.id,
    );

    return {
      contact,
      leadSource: attribution.leadSource,
      leadSourceKept: Boolean(existing) && contact.leadSource !== attribution.leadSource,
      campaignId,
      campaignCreated,
      discoveredKeys,
      campaignMatchedBy: campaignId ? "meta_campaign_id" : null,
      campaignMatchValue: metaCampaignId || undefined,
      isReturningContact: Boolean(existing),
      identity: identity.kind,
    };
  };

  const handleCreateSegment = (segment: Omit<Segment, "id" | "createdAt" | "lastUpdatedAt">) => {
    const now = new Date();
    const newSegment: Segment = {
      ...segment,
      id: `segment-${Date.now()}`,
      createdAt: now,
      lastUpdatedAt: now,
    };
    const updated = [...segments, newSegment];
    setSegments(updated);
    store.segments.write(updated);
  };

  const handleUpdateSegment = (segmentId: string, updates: Partial<Segment>) => {
    const updated = segments.map((s) =>
      s.id === segmentId ? { ...s, ...updates, lastUpdatedAt: new Date() } : s,
    );
    setSegments(updated);
    store.segments.write(updated);
  };

  const handleDeleteSegment = (segmentId: string) => {
    const updated = segments.filter((s) => s.id !== segmentId);
    setSegments(updated);
    store.segments.write(updated);
  };

  const buildCallReminderTaskItems = (
    workflow: Workflow,
    enrollments: WorkflowEnrollment[],
    allContacts: Contact[],
  ): TaskItem[] => {
    const callSteps = workflow.steps.filter((s: WorkflowStep) => s.actionType === "call-reminder");
    if (callSteps.length === 0) return [];
    const items: TaskItem[] = [];
    for (const enrollment of enrollments) {
      const contact = allContacts.find((c) => c.id === enrollment.contactId);
      for (const step of callSteps) {
        const offsetDays = Math.max(0, step.dayOffset - (step.reminderDaysBefore ?? 0));
        const dueDate = new Date(enrollment.startDate);
        dueDate.setDate(dueDate.getDate() + offsetDays);
        items.push({
          id: `taskitem-call-${enrollment.id}-${step.id}`,
          contactId: enrollment.contactId,
          contactName: contact ? `${contact.firstName} ${contact.lastName}` : enrollment.contactId,
          contactStatus: contact?.listingStatus ?? "",
          taskType: "Call",
          source: workflow.name,
          sourceType: "flow",
          dueDate,
          status: "pending",
          ruleId: step.id,
          ruleName: step.name,
          // Explicit fields for clean lookup (replaces string-pattern parsing)
          enrollmentId: enrollment.id,
          stepId: step.id,
          ...(step.note ? { triggerContext: step.note } : {}),
        });
      }
    }
    return items;
  };

  const handleCreateWorkflow = (w: Omit<Workflow, "id" | "createdAt" | "enrolledCount">) => {
    const normalizedSteps = computeDayOffsets([...w.steps].sort((a, b) => a.order - b.order));
    const newWorkflow: Workflow = {
      ...w,
      steps: normalizedSteps,
      id: `workflow-${Date.now()}`,
      createdAt: new Date(),
      enrolledCount: 0,
    };

    // Auto-enroll matching segment contacts — one enrollment per matching listing
    const segment = segments.find((s) => s.id === w.segmentId);
    const enrollmentPairs = segment && segment.status === "Active"
      ? contacts.flatMap((c) =>
          getMatchedListings(c, segment.filters, applications).map((l) => ({ contactId: c.id, listingId: l.id }))
        )
      : [];
    const startDate = new Date();
    const newEnrollments: WorkflowEnrollment[] = enrollmentPairs.map(({ contactId, listingId }) => ({
      id: `enroll-${Date.now()}-${contactId}-${listingId ?? ""}`,
      workflowId: newWorkflow.id,
      contactId,
      listingId,
      startDate,
      status: "active" as const,
      stepProgress: newWorkflow.steps.map((s) => ({ stepId: s.id, status: "pending" as const })),
    }));
    // enrolledCount shows unique contacts, not total enrollments
    newWorkflow.enrolledCount = new Set(enrollmentPairs.map((p) => p.contactId)).size;

    const callTasks = buildCallReminderTaskItems(newWorkflow, newEnrollments, contacts);
    const updatedWorkflows = [...workflows, newWorkflow];
    const updatedEnrollments = [...workflowEnrollments, ...newEnrollments];
    const updatedItems = callTasks.length > 0 ? [...taskItems, ...callTasks] : taskItems;

    setWorkflows(updatedWorkflows);
    setWorkflowEnrollments(updatedEnrollments);
    if (callTasks.length > 0) setTaskItems(updatedItems);
    store.workflows.write(updatedWorkflows);
    store.workflowEnrollments.write(updatedEnrollments);
    if (callTasks.length > 0) store.taskItems.write(updatedItems);
  };

  const handleUpdateWorkflow = (id: string, updates: Partial<Workflow>) => {
    const updated = workflows.map((wf) => {
      if (wf.id !== id) return wf;
      const merged = { ...wf, ...updates };
      if (updates.steps) {
        merged.steps = computeDayOffsets([...updates.steps].sort((a, b) => a.order - b.order));
      }
      return merged;
    });
    setWorkflows(updated);
    store.workflows.write(updated);

    if (updates.steps) {
      const newSteps = computeDayOffsets([...updates.steps].sort((a, b) => a.order - b.order));
      const newStepIds = new Set(newSteps.map((s) => s.id));

      const reconciledEnrollments = workflowEnrollments.map((enrollment) => {
        if (enrollment.workflowId !== id) return enrollment;
        if (enrollment.status === "completed") return enrollment;

        const mergedAll = mergeSteps(newSteps, enrollment.customSteps);
        const currentStep = mergedAll.find(
          (s) => s.actionType !== "delay" && enrollment.stepProgress.find((p) => p.stepId === s.id)?.status === "pending",
        );
        const currentOrder = currentStep?.order ?? Infinity;

        const cleanedProgress = enrollment.stepProgress.filter(
          (p) => newStepIds.has(p.stepId) || enrollment.customSteps?.some((cs) => cs.id === p.stepId),
        );

        const existingIds = new Set(cleanedProgress.map((p) => p.stepId));
        const addedProgress: WorkflowStepProgress[] = newSteps
          .filter((s) => !existingIds.has(s.id))
          .map((s) => ({
            stepId: s.id,
            status: s.order < currentOrder ? ("done" as const) : ("pending" as const),
            ...(s.order < currentOrder ? { completedAt: new Date() } : {}),
          }));

        return { ...enrollment, stepProgress: [...cleanedProgress, ...addedProgress] };
      });

      setWorkflowEnrollments(reconciledEnrollments);
      store.workflowEnrollments.write(reconciledEnrollments);
    }
  };

  const handleDeleteWorkflow = (id: string) => {
    const updatedWorkflows = workflows.filter((wf) => wf.id !== id);
    const updatedEnrollments = workflowEnrollments.filter((e) => e.workflowId !== id);
    setWorkflows(updatedWorkflows);
    setWorkflowEnrollments(updatedEnrollments);
    store.workflows.write(updatedWorkflows);
    store.workflowEnrollments.write(updatedEnrollments);
  };

  const handleEnrollContacts = (workflowId: string, entries: { contactId: string; listingId?: string }[], startDate: Date) => {
    const workflow = workflows.find((wf) => wf.id === workflowId);
    if (!workflow) return;
    const enrollSegment = segments.find((s) => s.id === workflow.segmentId);
    if (enrollSegment && enrollSegment.status !== "Active") {
      toast.error("Cannot enroll contacts — the linked segment is inactive.");
      return;
    }
    // Dedup key: contactId::listingId (listing-scoped when listingId present)
    const alreadyEnrolledKeys = new Set(
      workflowEnrollments
        .filter((e) => e.workflowId === workflowId)
        .map((e) => `${e.contactId}::${e.listingId ?? ""}`),
    );
    const newEntries = entries.filter(
      ({ contactId, listingId }) => !alreadyEnrolledKeys.has(`${contactId}::${listingId ?? ""}`),
    );
    const skipped = entries.length - newEntries.length;
    if (skipped > 0) {
      toast.info(`${skipped} enrollment${skipped > 1 ? "s" : ""} skipped — already enrolled`);
    }
    if (newEntries.length === 0) return;
    const newEnrollments: WorkflowEnrollment[] = newEntries.map(({ contactId, listingId }) => {
      const contactEnrollments = workflowEnrollments.filter(e => e.contactId === contactId);
      const allPaused = contactEnrollments.length > 0 && contactEnrollments.every(e => e.status === "paused");
      return {
        id: `enroll-${Date.now()}-${contactId}-${listingId ?? ""}`,
        workflowId,
        contactId,
        listingId,
        startDate,
        status: allPaused ? ("paused" as const) : ("active" as const),
        stepProgress: workflow.steps.map((s: WorkflowStep) => ({ stepId: s.id, status: "pending" as const })),
      };
    });
    const updatedEnrollments = [...workflowEnrollments, ...newEnrollments];
    const updatedWorkflows = workflows.map((wf) =>
      wf.id === workflowId ? { ...wf, enrolledCount: wf.enrolledCount + newEnrollments.length } : wf,
    );
    const callTasks = buildCallReminderTaskItems(workflow, newEnrollments, contacts);
    const updatedItems = callTasks.length > 0 ? [...taskItems, ...callTasks] : taskItems;

    setWorkflowEnrollments(updatedEnrollments);
    setWorkflows(updatedWorkflows);
    if (callTasks.length > 0) setTaskItems(updatedItems);
    store.workflowEnrollments.write(updatedEnrollments);
    store.workflows.write(updatedWorkflows);
    if (callTasks.length > 0) store.taskItems.write(updatedItems);
  };

  // Generates varied mock step progress so the board looks populated when a workflow starts
  function generateMockProgress(steps: WorkflowStep[], idx: number): WorkflowStepProgress[] {
    const sorted = [...steps].sort((a, b) => a.order - b.order);
    const now = new Date();
    // Delay steps are always pre-completed since they are not actionable
    const progress: WorkflowStepProgress[] = sorted.map((s) => ({
      stepId: s.id,
      status: s.actionType === "delay" ? ("done" as const) : ("pending" as const),
      completedAt: s.actionType === "delay" ? now : undefined,
    }));

    const markDone = (stepId: string) => {
      const p = progress.find((p) => p.stepId === stepId);
      if (p) { p.status = "done"; p.completedAt = now; }
    };

    const actionSorted = sorted.filter((s) => s.actionType !== "delay");
    const emailSteps = actionSorted.filter((s) => s.actionType === "email");
    const smsSteps = actionSorted.filter((s) => s.actionType === "sms");

    switch (idx % 5) {
      case 0: // fresh — all pending
        break;
      case 1: // first email sent, rest pending
        if (emailSteps[0]) markDone(emailSteps[0].id);
        break;
      case 2: // first email + first SMS done, rest pending
        if (emailSteps[0]) markDone(emailSteps[0].id);
        if (smsSteps[0]) markDone(smsSteps[0].id);
        break;
      case 3: // first two action steps done
        if (actionSorted[0]) markDone(actionSorted[0].id);
        if (actionSorted[1]) markDone(actionSorted[1].id);
        break;
      case 4: // all email and SMS done, calls pending
        actionSorted.forEach((s) => {
          if (s.actionType === "email" || s.actionType === "sms") markDone(s.id);
        });
        break;
    }

    return progress;
  }

  const handleActivateWorkflow = (workflowId: string) => {
    const workflow = workflows.find((wf) => wf.id === workflowId);
    if (!workflow) return;

    // Build already-enrolled keys (contactId::listingId) to deduplicate listing-scoped enrollments
    const alreadyEnrolledKeys = new Set(
      workflowEnrollments
        .filter((e) => e.workflowId === workflowId)
        .map((e) => `${e.contactId}::${e.listingId ?? ""}`),
    );
    const enrolledContactIds = new Set(
      workflowEnrollments.filter((e) => e.workflowId === workflowId).map((e) => e.contactId),
    );

    // Resolve the segment's filters (if any) so we only enroll listings that actually match
    const segment = segments.find((s) => s.id === workflow.segmentId);

    // If the segment is inactive, activate the workflow status but skip enrollment
    if (segment && segment.status !== "Active") {
      const updatedWorkflows = workflows.map((wf) =>
        wf.id === workflowId ? { ...wf, status: "active" as const } : wf,
      );
      setWorkflows(updatedWorkflows);
      store.workflows.write(updatedWorkflows);
      toast.warning("Flow activated — no contacts enrolled because the linked segment is inactive.");
      return;
    }

    const segmentFilters: FilterRule[] = segment?.filters ?? [];

    // Pick up to 8 contacts not already enrolled, then expand to matched-listing pairs only
    const available = contacts.filter((c) => !enrolledContactIds.has(c.id));
    const selected = available.slice(0, 8);

    // getMatchedListings returns only the listings that satisfy the segment's listing filters.
    // For non-listing segments it returns all listings collapsed to one (primary) per contact.
    const pairs = selected.flatMap((contact) => {
      return getMatchedListings(contact, segmentFilters, applications)
        .filter((l) => !alreadyEnrolledKeys.has(`${contact.id}::${l.id}`))
        .map((l) => ({ contact, listingId: l.id }));
    });

    const now = new Date();
    const newEnrollments: WorkflowEnrollment[] = pairs.map(({ contact, listingId }, idx) => {
      const startDate = new Date(now.getTime() - idx * 2 * 24 * 60 * 60 * 1000);
      const stepProgress = generateMockProgress(workflow.steps, idx);
      const allDone = stepProgress.every((p) => p.status === "done" || p.status === "skipped");
      return {
        id: `enroll-${workflowId}-${contact.id}-${listingId}-${Date.now() + idx}`,
        workflowId,
        contactId: contact.id,
        listingId,
        startDate,
        status: allDone ? ("completed" as const) : ("active" as const),
        stepProgress,
      };
    });

    const updatedEnrollments = [...workflowEnrollments, ...newEnrollments];
    // enrolledCount tracks unique contacts
    const newUniqueContacts = new Set(newEnrollments.map((e) => e.contactId)).size;
    const updatedWorkflows = workflows.map((wf) =>
      wf.id === workflowId
        ? { ...wf, status: "active" as const, enrolledCount: wf.enrolledCount + newUniqueContacts }
        : wf,
    );

    addNotification({
      type: "workflow_update",
      title: `"${workflow.name}" enrolled ${newUniqueContacts} contact${newUniqueContacts !== 1 ? "s" : ""}`,
      message: `"${workflow.name}" was activated and enrolled ${newUniqueContacts} contact${newUniqueContacts !== 1 ? "s" : ""}.`,
      workflowId: workflowId,
    });

    setWorkflowEnrollments(updatedEnrollments);
    setWorkflows(updatedWorkflows);
    store.workflowEnrollments.write(updatedEnrollments);
    store.workflows.write(updatedWorkflows);
  };

  const handleAdvanceStep = (enrollmentId: string, stepId: string) => {
    const enrollment = workflowEnrollments.find((e) => e.id === enrollmentId);
    if (!enrollment) return;
    const workflow = workflows.find((wf) => wf.id === enrollment.workflowId);
    if (!workflow) return;
    const allSteps = mergeSteps(workflow.steps, enrollment.customSteps);
    const step = allSteps.find((s) => s.id === stepId);
    if (!step) return;
    const contact = contacts.find((c) => c.id === enrollment.contactId);

    const now = new Date();
    let finalProgress = enrollment.stepProgress.map((p) =>
      p.stepId === stepId ? { ...p, status: "done" as const, completedAt: now } : p,
    );
    // Auto-advance any delay steps that immediately follow the completed step
    const sortedByOrder = allSteps;
    let advIdx = sortedByOrder.findIndex((s) => s.id === stepId);
    while (++advIdx < sortedByOrder.length && sortedByOrder[advIdx].actionType === "delay") {
      const delayId = sortedByOrder[advIdx].id;
      finalProgress = finalProgress.map((p) =>
        p.stepId === delayId ? { ...p, status: "done" as const, completedAt: now } : p,
      );
    }
    const allDone = finalProgress.every((p) => p.status === "done" || p.status === "skipped");
    const updatedEnrollment: WorkflowEnrollment = {
      ...enrollment,
      stepProgress: finalProgress,
      status: allDone ? "completed" : "active",
    };

    const updatedEnrollments = workflowEnrollments.map((e) =>
      e.id === enrollmentId ? updatedEnrollment : e,
    );
    const updatedWorkflows = allDone
      ? workflows.map((wf) =>
          wf.id === workflow.id
            ? { ...wf, enrolledCount: Math.max(0, wf.enrolledCount - 1) }
            : wf,
        )
      : workflows;

    let updatedItems: TaskItem[];
    let updatedActivity = contactActivity;
    if (step.actionType === "call-reminder") {
      // Complete the pre-created call reminder task instead of creating a new one
      const taskId = `taskitem-call-${enrollmentId}-${stepId}`;
      updatedItems = taskItems.map((ti) =>
        ti.id === taskId ? { ...ti, status: "completed" as const, completedAt: now } : ti,
      );
    } else {
      const triggerMap: Record<string, string> = {
        email: step.subject ?? "",
        sms: (step.message ?? "").slice(0, 80),
      };
      const taskTypeMap: Record<string, string> = { email: "Email", sms: "SMS" };
      const uniqueId = `${enrollmentId}-${stepId}-${Date.now()}`;
      const newTaskItem: TaskItem = {
        id: `taskitem-flow-${uniqueId}`,
        contactId: enrollment.contactId,
        contactName: contact ? `${contact.firstName} ${contact.lastName}` : enrollment.contactId,
        contactStatus: contact?.listingStatus ?? "",
        taskType: taskTypeMap[step.actionType] ?? step.actionType,
        source: workflow.name,
        sourceType: "flow",
        dueDate: now,
        assignee: step.senderIdentity ?? "",
        status: "pending",
        triggerContext: triggerMap[step.actionType] ?? "",
      };
      updatedItems = [...taskItems, newTaskItem];
      // Log email/SMS actions to contact activity
      const activityType = step.actionType === "sms" ? "sms_sent" : "email_sent";
      const newActivity: ContactActivityRecord = {
        id: `activity-flow-${uniqueId}`,
        contactId: enrollment.contactId,
        type: activityType,
        source: workflow.name,
        sourceType: "flow",
        stepName: step.name,
        subject: step.actionType === "email" ? step.subject : undefined,
        message: step.actionType === "sms" ? step.message : undefined,
        assignee: step.senderIdentity ?? "",
        timestamp: now,
      };
      updatedActivity = [...contactActivity, newActivity];
    }

    setWorkflowEnrollments(updatedEnrollments);
    setWorkflows(updatedWorkflows);
    setTaskItems(updatedItems);
    if (updatedActivity !== contactActivity) {
      setContactActivity(updatedActivity);
      store.contactActivity.write(updatedActivity);
    }
    store.workflowEnrollments.write(updatedEnrollments);
    store.workflows.write(updatedWorkflows);
    store.taskItems.write(updatedItems);
  };

  const handleSetEnrollmentStatus = (enrollmentId: string, status: "active" | "paused", pausedUntil?: Date, pauseReason?: string) => {
    const enrollment = workflowEnrollments.find((e) => e.id === enrollmentId);
    if (!enrollment) return;
    const workflow = workflows.find((wf) => wf.id === enrollment.workflowId);

    if (status === "paused") {
      const contact = contacts.find((c) => c.id === enrollment.contactId);
      const contactName = contact ? `${contact.firstName} ${contact.lastName}` : enrollment.contactId;
      addNotification({
        type: "enrollment_paused",
        title: `${contactName}'s enrollment paused in "${workflow?.name ?? "a workflow"}"`,
        message: `${contactName}'s enrollment in "${workflow?.name ?? "a workflow"}" was paused.${pauseReason ? ` Reason: ${pauseReason}` : ""}`,
        workflowId: enrollment.workflowId,
        contactId: enrollment.contactId,
      });
    }

    const updatedEnrollments = workflowEnrollments.map((e) => {
      if (e.id !== enrollmentId) return e;
      if (status === "paused") {
        return {
          ...e,
          status,
          ...(pausedUntil ? { pausedUntil } : {}),
          ...(pauseReason ? { pauseReason } : {}),
        };
      }
      return { ...e, status, pausedUntil: undefined, pauseReason: undefined };
    });
    const now = new Date();

    // Suspend all pending tasks for this enrollment when pausing,
    // reactivate all suspended tasks when resuming.
    const updatedItems = taskItems.map((ti) => {
      if (ti.enrollmentId !== enrollmentId) {
        // Also check legacy ID pattern for older tasks
        const legacyMatch =
          ti.id.startsWith(`taskitem-call-${enrollmentId}-`) ||
          ti.id.startsWith(`taskitem-flow-${enrollmentId}-`);
        if (!legacyMatch) return ti;
      }
      if (status === "paused" && ti.status === "pending") {
        return { ...ti, status: "suspended" as const };
      }
      if (status === "active" && ti.status === "suspended") {
        return { ...ti, status: "pending" as const };
      }
      return ti;
    });

    const activityType = status === "paused" ? "enrollment_paused" : "enrollment_resumed";
    const taskActivityType = status === "paused" ? "task_suspended" : "task_reactivated";
    const suspendedTasks = updatedItems.filter(
      (ti) =>
        (ti.enrollmentId === enrollmentId ||
          ti.id.startsWith(`taskitem-call-${enrollmentId}-`) ||
          ti.id.startsWith(`taskitem-flow-${enrollmentId}-`)) &&
        (status === "paused" ? ti.status === "suspended" : ti.status === "pending"),
    );

    const newActivities: ContactActivityRecord[] = [
      {
        id: `activity-flow-${enrollmentId}-${status}-${Date.now()}`,
        contactId: enrollment.contactId,
        type: activityType,
        source: workflow?.name,
        sourceType: "flow",
        assignee: "You",
        timestamp: now,
      },
      ...suspendedTasks.map((ti, i) => ({
        id: `activity-task-${status}-${Date.now()}-${i}`,
        contactId: enrollment.contactId,
        type: taskActivityType as ContactActivityRecord["type"],
        taskType: ti.taskType,
        source: ti.source,
        sourceType: ti.sourceType,
        assignee: ti.assignee,
        timestamp: now,
      })),
    ];

    const updatedActivity = [...contactActivity, ...newActivities];
    setWorkflowEnrollments(updatedEnrollments);
    setTaskItems(updatedItems);
    setContactActivity(updatedActivity);
    store.workflowEnrollments.write(updatedEnrollments);
    store.taskItems.write(updatedItems);
    store.contactActivity.write(updatedActivity);
  };

  const handleBulkSetEnrollmentStatus = (enrollmentIds: string[], status: "active" | "paused") => {
    const idSet = new Set(enrollmentIds);
    const now = new Date();
    const activityType = status === "paused" ? "enrollment_paused" : "enrollment_resumed";
    const taskActivityType = status === "paused" ? "task_suspended" : "task_reactivated";

    const updatedEnrollments = workflowEnrollments.map((e) =>
      idSet.has(e.id) ? { ...e, status } : e,
    );

    const updatedItems = taskItems.map((ti) => {
      const inSet = enrollmentIds.some(
        (eid) =>
          ti.enrollmentId === eid ||
          ti.id.startsWith(`taskitem-call-${eid}-`) ||
          ti.id.startsWith(`taskitem-flow-${eid}-`),
      );
      if (!inSet) return ti;
      if (status === "paused" && ti.status === "pending") return { ...ti, status: "suspended" as const };
      if (status === "active" && ti.status === "suspended") return { ...ti, status: "pending" as const };
      return ti;
    });

    const newActivities: ContactActivityRecord[] = enrollmentIds.flatMap((eid, i) => {
      const enrollment = workflowEnrollments.find((e) => e.id === eid);
      if (!enrollment) return [];
      const wf = workflows.find((w) => w.id === enrollment.workflowId);
      const affected = updatedItems.filter(
        (ti) =>
          (ti.enrollmentId === eid ||
            ti.id.startsWith(`taskitem-call-${eid}-`) ||
            ti.id.startsWith(`taskitem-flow-${eid}-`)) &&
          (status === "paused" ? ti.status === "suspended" : ti.status === "pending"),
      );
      return [
        {
          id: `activity-bulk-enrollment-${status}-${Date.now()}-${i}`,
          contactId: enrollment.contactId,
          type: activityType as ContactActivityRecord["type"],
          source: wf?.name,
          sourceType: "flow" as const,
          assignee: "You",
          timestamp: now,
        },
        ...affected.map((ti, j) => ({
          id: `activity-bulk-task-${status}-${Date.now()}-${i}-${j}`,
          contactId: enrollment.contactId,
          type: taskActivityType as ContactActivityRecord["type"],
          taskType: ti.taskType,
          source: ti.source,
          sourceType: ti.sourceType,
          assignee: ti.assignee,
          timestamp: now,
        })),
      ];
    });

    const updatedActivity = [...contactActivity, ...newActivities];
    setWorkflowEnrollments(updatedEnrollments);
    setTaskItems(updatedItems);
    setContactActivity(updatedActivity);
    store.workflowEnrollments.write(updatedEnrollments);
    store.taskItems.write(updatedItems);
    store.contactActivity.write(updatedActivity);
  };

  const handlePauseAllEnrollments = (contactId: string, pausedUntil: Date | null, reason: string) => {
    const activeEnrollments = workflowEnrollments.filter(
      (e) => e.contactId === contactId && e.status === "active",
    );
    if (activeEnrollments.length === 0) return;
    const idSet = new Set(activeEnrollments.map((e) => e.id));
    const now = new Date();

    const updatedEnrollments = workflowEnrollments.map((e) => {
      if (!idSet.has(e.id)) return e;
      return {
        ...e,
        status: "paused" as const,
        ...(pausedUntil ? { pausedUntil } : {}),
        ...(reason ? { pauseReason: reason } : {}),
      };
    });

    const updatedItems = taskItems.map((ti) => {
      const inSet = activeEnrollments.some(
        (e) =>
          ti.enrollmentId === e.id ||
          ti.id.startsWith(`taskitem-call-${e.id}-`) ||
          ti.id.startsWith(`taskitem-flow-${e.id}-`),
      );
      if (!inSet || ti.status !== "pending") return ti;
      return { ...ti, status: "suspended" as const };
    });

    const newActivities: ContactActivityRecord[] = activeEnrollments.map((e, i) => {
      const wf = workflows.find((w) => w.id === e.workflowId);
      return {
        id: `activity-pauseall-${e.id}-${Date.now()}-${i}`,
        contactId,
        type: "enrollment_paused" as const,
        source: wf?.name,
        sourceType: "flow" as const,
        note: reason || undefined,
        assignee: "You",
        timestamp: now,
      };
    });

    const updatedActivity = [...contactActivity, ...newActivities];
    setWorkflowEnrollments(updatedEnrollments);
    setTaskItems(updatedItems);
    setContactActivity(updatedActivity);
    store.workflowEnrollments.write(updatedEnrollments);
    store.taskItems.write(updatedItems);
    store.contactActivity.write(updatedActivity);
  };

  const handleSkipStep = (enrollmentId: string, stepId: string) => {
    const enrollment = workflowEnrollments.find((e) => e.id === enrollmentId);
    if (!enrollment) return;
    const workflow = workflows.find((wf) => wf.id === enrollment.workflowId);
    const allSteps = mergeSteps(workflow?.steps ?? [], enrollment.customSteps);
    const step = allSteps.find((s) => s.id === stepId);
    if (!step || step.actionType === "delay") return;
    const updatedProgress = enrollment.stepProgress.map((p) =>
      p.stepId === stepId && p.status === "pending"
        ? { ...p, status: "skipped" as const }
        : p,
    );
    const allDone = updatedProgress.every((p) => p.status === "done" || p.status === "skipped");
    const updatedEnrollment: WorkflowEnrollment = {
      ...enrollment,
      stepProgress: updatedProgress,
      status: allDone ? "completed" : enrollment.status,
    };
    const updated = workflowEnrollments.map((e) =>
      e.id === enrollmentId ? updatedEnrollment : e,
    );
    const now = new Date();

    // Also mark the linked TaskItem as skipped so the task queue stays in sync
    const updatedItems = taskItems.map((ti) => {
      const linkedByFields = ti.enrollmentId === enrollmentId && ti.stepId === stepId;
      const linkedByLegacyId = ti.id === `taskitem-call-${enrollmentId}-${stepId}`;
      if ((linkedByFields || linkedByLegacyId) && ti.status === "pending") {
        return { ...ti, status: "completed" as const, disposition: "Skipped", completedAt: now };
      }
      return ti;
    });

    const newActivity: ContactActivityRecord = {
      id: `activity-flow-${enrollmentId}-skip-${stepId}-${Date.now()}`,
      contactId: enrollment.contactId,
      type: "step_skipped",
      source: workflow?.name,
      sourceType: "flow",
      stepName: step?.name,
      assignee: "You",
      timestamp: now,
    };
    const updatedActivity = [...contactActivity, newActivity];
    setWorkflowEnrollments(updated);
    setTaskItems(updatedItems);
    setContactActivity(updatedActivity);
    store.workflowEnrollments.write(updated);
    store.taskItems.write(updatedItems);
    store.contactActivity.write(updatedActivity);
  };

  const handleBulkSkipSteps = (items: { enrollmentId: string; stepId: string }[]) => {
    const now = new Date();
    let updatedEnrollments = [...workflowEnrollments];
    let updatedItems = [...taskItems];
    const newActivities: ContactActivityRecord[] = [];

    items.forEach(({ enrollmentId, stepId }, i) => {
      const enrollment = updatedEnrollments.find((e) => e.id === enrollmentId);
      if (!enrollment) return;
      const wf = workflows.find((w) => w.id === enrollment.workflowId);
      const allSteps = mergeSteps(wf?.steps ?? [], enrollment.customSteps);
      const step = allSteps.find((s) => s.id === stepId);
      if (!step || step.actionType === "delay") return;

      const updatedProgress = enrollment.stepProgress.map((p) =>
        p.stepId === stepId && p.status === "pending" ? { ...p, status: "skipped" as const } : p,
      );
      const allDone = updatedProgress.every((p) => p.status === "done" || p.status === "skipped");
      updatedEnrollments = updatedEnrollments.map((e) =>
        e.id === enrollmentId
          ? { ...e, stepProgress: updatedProgress, status: allDone ? ("completed" as const) : e.status }
          : e,
      );

      updatedItems = updatedItems.map((ti) => {
        const linked =
          (ti.enrollmentId === enrollmentId && ti.stepId === stepId) ||
          ti.id === `taskitem-call-${enrollmentId}-${stepId}`;
        return linked && ti.status === "pending"
          ? { ...ti, status: "completed" as const, disposition: "Skipped", completedAt: now }
          : ti;
      });

      newActivities.push({
        id: `activity-bulk-skip-${enrollmentId}-${stepId}-${Date.now()}-${i}`,
        contactId: enrollment.contactId,
        type: "step_skipped",
        source: wf?.name,
        sourceType: "flow",
        stepName: step.name,
        assignee: "You",
        timestamp: now,
      });
    });

    const updatedActivity = [...contactActivity, ...newActivities];
    setWorkflowEnrollments(updatedEnrollments);
    setTaskItems(updatedItems);
    setContactActivity(updatedActivity);
    store.workflowEnrollments.write(updatedEnrollments);
    store.taskItems.write(updatedItems);
    store.contactActivity.write(updatedActivity);
  };

  const handleUnskipStep = (enrollmentId: string, stepId: string) => {
    const enrollment = workflowEnrollments.find((e) => e.id === enrollmentId);
    if (!enrollment) return;
    const workflow = workflows.find((wf) => wf.id === enrollment.workflowId);
    const allSteps = mergeSteps(workflow?.steps ?? [], enrollment.customSteps);
    const step = allSteps.find((s) => s.id === stepId);
    if (!step || step.actionType === "delay") return;
    const updatedProgress = enrollment.stepProgress.map((p) =>
      p.stepId === stepId && p.status === "skipped"
        ? { ...p, status: "pending" as const }
        : p,
    );
    const updatedEnrollment: WorkflowEnrollment = {
      ...enrollment,
      stepProgress: updatedProgress,
      status: enrollment.status === "completed" ? "active" : enrollment.status,
    };
    const updated = workflowEnrollments.map((e) =>
      e.id === enrollmentId ? updatedEnrollment : e,
    );
    const now = new Date();
    const newActivity: ContactActivityRecord = {
      id: `activity-flow-${enrollmentId}-unskip-${stepId}-${Date.now()}`,
      contactId: enrollment.contactId,
      type: "step_unskipped",
      source: workflow?.name,
      sourceType: "flow",
      stepName: step?.name,
      assignee: "You",
      timestamp: now,
    };
    const updatedActivity = [...contactActivity, newActivity];
    setWorkflowEnrollments(updated);
    setContactActivity(updatedActivity);
    store.workflowEnrollments.write(updated);
    store.contactActivity.write(updatedActivity);
  };

  const handleMoveToStep = (enrollmentId: string, targetStepId: string | "completed") => {
    const enrollment = workflowEnrollments.find((e) => e.id === enrollmentId);
    if (!enrollment) return;
    const workflow = workflows.find((wf) => wf.id === enrollment.workflowId);
    if (!workflow) return;

    const sortedSteps = mergeSteps(workflow.steps, enrollment.customSteps);
    const targetIndex =
      targetStepId === "completed"
        ? sortedSteps.length
        : sortedSteps.findIndex((s) => s.id === targetStepId);
    if (targetIndex === -1) return;

    const now = new Date();
    const finalProgress = enrollment.stepProgress.map((p) => {
      const stepIndex = sortedSteps.findIndex((s) => s.id === p.stepId);
      if (stepIndex === -1) return p;
      if (stepIndex < targetIndex) {
        return { ...p, status: "done" as const, completedAt: p.completedAt ?? now };
      }
      return { stepId: p.stepId, status: "pending" as const };
    });

    const allDone = finalProgress.every((p) => p.status === "done" || p.status === "skipped");
    const wasCompleted = enrollment.status === "completed";
    const updatedEnrollment: WorkflowEnrollment = {
      ...enrollment,
      stepProgress: finalProgress,
      status: allDone ? "completed" : "active",
    };

    const updatedEnrollments = workflowEnrollments.map((e) =>
      e.id === enrollmentId ? updatedEnrollment : e,
    );

    let updatedWorkflows = workflows;
    if (!wasCompleted && allDone) {
      updatedWorkflows = workflows.map((wf) =>
        wf.id === workflow.id ? { ...wf, enrolledCount: Math.max(0, wf.enrolledCount - 1) } : wf,
      );
    } else if (wasCompleted && !allDone) {
      updatedWorkflows = workflows.map((wf) =>
        wf.id === workflow.id ? { ...wf, enrolledCount: wf.enrolledCount + 1 } : wf,
      );
    }

    const targetStep = targetStepId !== "completed" ? sortedSteps[targetIndex] : null;
    const newActivity: ContactActivityRecord = {
      id: `activity-flow-${enrollmentId}-movetostep-${Date.now()}`,
      contactId: enrollment.contactId,
      type: "contact_moved_to_step",
      source: workflow.name,
      sourceType: "flow",
      stepName: targetStep?.name ?? "Completed",
      assignee: "You",
      timestamp: now,
    };
    const updatedActivity = [...contactActivity, newActivity];

    setWorkflowEnrollments(updatedEnrollments);
    setWorkflows(updatedWorkflows);
    setContactActivity(updatedActivity);
    store.workflowEnrollments.write(updatedEnrollments);
    store.workflows.write(updatedWorkflows);
    store.contactActivity.write(updatedActivity);
  };

  const handleAddCustomStep = (
    enrollmentId: string,
    stepDef: Omit<WorkflowStep, "id" | "order" | "dayOffset">,
    insertAfterStepId: string | null,
  ) => {
    const enrollment = workflowEnrollments.find((e) => e.id === enrollmentId);
    if (!enrollment) return;
    const workflow = workflows.find((wf) => wf.id === enrollment.workflowId);
    if (!workflow) return;

    const allSteps = mergeSteps(workflow.steps, enrollment.customSteps);
    const existingOrders = allSteps.map((s) => s.order);
    const afterOrder = insertAfterStepId
      ? (allSteps.find((s) => s.id === insertAfterStepId)?.order ?? existingOrders[existingOrders.length - 1] ?? 0)
      : (existingOrders[existingOrders.length - 1] ?? 0);
    const newOrder = nextFractionalOrder(afterOrder, existingOrders);

    const newStep: CustomWorkflowStep = {
      ...stepDef,
      id: `custom-${enrollmentId}-${Date.now()}`,
      order: newOrder,
      dayOffset: 0,
      isCustom: true,
      insertAfterStepId,
      createdAt: new Date(),
    };

    const updatedCustomSteps = [...(enrollment.customSteps ?? []), newStep];
    const updatedProgress = [...enrollment.stepProgress, { stepId: newStep.id, status: "pending" as const }];
    const updated = workflowEnrollments.map((e) =>
      e.id === enrollmentId ? { ...e, customSteps: updatedCustomSteps, stepProgress: updatedProgress } : e,
    );

    const now = new Date();
    const newActivity: ContactActivityRecord = {
      id: `activity-flow-${enrollmentId}-addcustom-${Date.now()}`,
      contactId: enrollment.contactId,
      type: "custom_step_added",
      source: workflow.name,
      sourceType: "flow",
      stepName: newStep.name,
      assignee: "You",
      timestamp: now,
    };
    const updatedActivity = [...contactActivity, newActivity];

    setWorkflowEnrollments(updated);
    setContactActivity(updatedActivity);
    store.workflowEnrollments.write(updated);
    store.contactActivity.write(updatedActivity);
  };

  const handleRemoveCustomStep = (enrollmentId: string, stepId: string) => {
    const enrollment = workflowEnrollments.find((e) => e.id === enrollmentId);
    if (!enrollment) return;
    const workflow = workflows.find((wf) => wf.id === enrollment.workflowId);
    const step = enrollment.customSteps?.find((cs) => cs.id === stepId);
    if (!step) return;

    const updatedCustomSteps = (enrollment.customSteps ?? []).filter((cs) => cs.id !== stepId);
    const updatedProgress = enrollment.stepProgress.filter((p) => p.stepId !== stepId);
    const updated = workflowEnrollments.map((e) =>
      e.id === enrollmentId ? { ...e, customSteps: updatedCustomSteps, stepProgress: updatedProgress } : e,
    );

    const now = new Date();
    const newActivity: ContactActivityRecord = {
      id: `activity-flow-${enrollmentId}-removecustom-${Date.now()}`,
      contactId: enrollment.contactId,
      type: "custom_step_removed",
      source: workflow?.name,
      sourceType: "flow",
      stepName: step.name,
      assignee: "You",
      timestamp: now,
    };
    const updatedActivity = [...contactActivity, newActivity];

    setWorkflowEnrollments(updated);
    setContactActivity(updatedActivity);
    store.workflowEnrollments.write(updated);
    store.contactActivity.write(updatedActivity);
  };

  const handleCustomizeDelay = (enrollmentId: string, stepId: string, delayDays: number, delayHours: number, delayMinutes: number) => {
    const enrollment = workflowEnrollments.find((e) => e.id === enrollmentId);
    if (!enrollment) return;
    const updatedProgress = enrollment.stepProgress.map((p) =>
      p.stepId === stepId
        ? { ...p, customDelayDays: Math.max(0, delayDays), customDelayHours: Math.min(23, Math.max(0, delayHours)), customDelayMinutes: Math.min(59, Math.max(0, delayMinutes)) }
        : p,
    );
    const updated = workflowEnrollments.map((e) =>
      e.id === enrollmentId ? { ...e, stepProgress: updatedProgress } : e,
    );
    setWorkflowEnrollments(updated);
    store.workflowEnrollments.write(updated);
  };


  return (
    <AppDataContext.Provider
      value={{
        contacts,
        emailHistory,
        tasks,
        taskItems,
        contactActivity,
        segments,
        applications,
        businessAcquisitions,
        handleLogCallDisposition,
        handleCompleteTask,
        handleCompleteTaskWithOutcome,
        handleRescheduleTask,
        handleDeleteTask,
        handleBulkCompleteTask,
        handleBulkRescheduleTask,
        handleBulkDeleteTask,
        handleUpdateContact,
        handleCreateContact,
        handleImportContacts,
        companies,
        handleCreateCompany,
        listings,
        campaigns,
        leadForms,
        contactLeadAnswers,
        inboundLeadEvents,
        handleResolveLeadEvent,
        handleConfirmLeadEvent,
        handleUpdateLeadForm,
        platformAccounts,
        handleUpdatePlatformAccount,
        handleCreateCampaign,
        handleUpdateCampaign,
        handleDeleteCampaign,
        customFieldDefinitions,
        handleCreateCustomField,
        handleUpdateCustomField,
        handleArchiveCustomField,
        handleRestoreCustomField,
        handleIngestLeadForm,
        handleIngestMetaLead,
        handleCreateTask,
        handleBulkCreateTasks,
        loGroups,
        handleCreateLoGroup,
        handleUpdateLoGroup,
        handleDeleteLoGroup,
        handleCreateSegment,
        handleUpdateSegment,
        handleDeleteSegment,
        workflows,
        workflowEnrollments,
        handleCreateWorkflow,
        handleUpdateWorkflow,
        handleDeleteWorkflow,
        handleEnrollContacts,
        handleActivateWorkflow,
        handleAdvanceStep,
        handleMoveToStep,
        handleSetEnrollmentStatus,
        handleBulkSetEnrollmentStatus,
        handlePauseAllEnrollments,
        handleSkipStep,
        handleBulkSkipSteps,
        handleUnskipStep,
        handleCustomizeDelay,
        handleAddCustomStep,
        handleRemoveCustomStep,
        adminEmailTemplates,
        smsTemplates,
        voicemailScripts,
        voicemailSettings,
        senderIdentities,
        templateFolders,
        currentUserRole,
        handleSetCurrentUserRole,
        handleCreateFolder,
        handleRenameFolder,
        handleMoveFolder,
        handleSetFolderVisibility,
        handleDeleteFolder,
        handleMoveTemplateToFolder,
        handleCreateAdminEmailTemplate,
        handleUpdateAdminEmailTemplate,
        handleDeleteAdminEmailTemplate,
        handleCreateSmsTemplate,
        handleUpdateSmsTemplate,
        handleDeleteSmsTemplate,
        handleCreateVoicemailScript,
        handleUpdateVoicemailScript,
        handleDeleteVoicemailScript,
        handleUpdateVoicemailSettings,
        handleSendTaskEmail,
        handleCreateSenderIdentity,
        handleUpdateSenderIdentity,
        handleDeleteSenderIdentity,
        handleSetDefaultSenderIdentity,
        smsCategories,
        voicemailCategories,
        handleAddSmsCategory,
        handleDeleteSmsCategory,
        handleRenameSmsCategory,
        handleAddVoicemailCategory,
        handleDeleteVoicemailCategory,
        handleRenameVoicemailCategory,
        notifications,
        notificationPrefs,
        handleMarkNotificationRead,
        handleMarkNotificationUnread,
        handleMarkAllNotificationsRead,
        handleDismissNotification,
        handleUpdateNotificationPrefs,
        handleMarkEmailRead,
        handleMarkContactEmailsRead,
        handleSendReply,
        handleResendMessage,
        handleSetChannelOptOut,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside AppDataProvider");
  return ctx;
}
