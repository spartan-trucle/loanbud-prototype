import type React from "react";

export type MainSection =
  | "applications"
  | "business-acquisition"
  | "crm"
  | "email-workflows"
  | "users"
  | "automations"
  | "questionnaires"
  | "configurations";

export type CRMView =
  | "contacts"
  | "companies"
  | "segments"
  | "workflows"
  | "inbox"
  | "settings"
  | "tasks";

export type EmailWorkflowView =
  | "overview"
  | "flows"
  | "user-segments"
  | "flow-builder"
  | "templates"
  | "history"
  | "tasks";

export type View = MainSection | CRMView | EmailWorkflowView;

export interface IconNavItem {
  id: MainSection;
  label: string;
  icon: React.ElementType;
  tooltip: string;
  hasSubMenu?: boolean;
}

export interface CRMSubItem {
  id: CRMView;
  label: string;
  dividerAfter?: boolean;
  icon?: React.ElementType;
  tooltip?: string;
}

export interface EmailWorkflowSubItem {
  id: EmailWorkflowView;
  label: string;
  dividerAfter?: boolean;
}

export interface AppSidebarSubItem {
  id: string;
  label: string;
  route: string;
  icon?: React.ElementType;
  /** When true, this item is greyed out in V1 and only active in V2 */
  v2Only?: boolean;
  /** V2 (RFC-008): dynamic count badge (e.g. open tasks). 0/undefined hides it. */
  badgeCount?: number;
}

export interface AppSidebarItem {
  id: string;
  label: string;
  icon: React.ElementType;
  route?: string;
  action?: "openComposer" | "openDialer";
  externalIcon?: boolean;
  children?: AppSidebarSubItem[];
  /** V2 (RFC-008): dynamic count badge rolled up from children (e.g. open tasks). */
  badgeCount?: number;
}

export interface AppSidebarSection {
  label?: string;
  items: AppSidebarItem[];
}

export type ListingStatus = "New" | "Draft" | "Submitted" | "On Hold" | "Declined";

export interface Listing {
  id: string;
  name: string;
  status: ListingStatus;
}

export interface ChannelOptOut {
  optedOut: boolean;
  source?: "manual" | "sms-stop" | "email-unsubscribe";
  optedOutAt?: string; // ISO string — nested, not revived by store
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  listingName: string;
  listingStatus: ListingStatus;
  /** V2: all listings associated with this contact. Falls back to listingName/listingStatus when absent. */
  listings?: Listing[];
  createAt: Date;
  updatedAt?: Date | string;
  userType: "Broker" | "Lender" | "Partner" | "Borrower" | "Co-Borrower";
  optedOut: boolean;
  openReminders: number;
  // Extended profile fields
  loanOfficer?: string;
  timeZone?: string;
  preferredLanguage?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  linkedApplicationId?: string;
  companies?: string[];
  // Per-channel opt-out
  emailOptOut?: ChannelOptOut;
  smsOptOut?: ChannelOptOut;
  /** V2 (RFC-008): Do-Not-Call flag — surfaced as a warn-and-choose count for bulk CALL tasks. */
  isDoNotCall?: boolean;
  /** V2 (RFC-009): attribution taxonomy classification — id of the deepest AttributionNode this contact resolves to. */
  attributionNodeId?: string;
}

/** V2 (RFC-009): one level of the attribution pyramid (Channel > Platform > Campaign > Ad Set > Creative). */
export type AttributionNodeKind = "channel" | "platform" | "campaign" | "ad_set" | "creative";

/** V2 (RFC-009): a node in the attribution taxonomy tree (adjacency list; parentId null = top-level channel). */
export interface AttributionNode {
  id: string;
  parentId: string | null;
  level: 1 | 2 | 3 | 4 | 5;
  kind: AttributionNodeKind;
  name: string;
  /** Phase-2 preview: node was auto-created from live UTM data, not curated by an admin. */
  isAutoCreated?: boolean;
  /** The node's name is user-defined (a campaign / ad / email the marketer names via UTMs), not a fixed system category. */
  userDefined?: boolean;
}

export interface EmailRecord {
  id: string;
  contactId: string;
  contactName: string;
  subject: string;
  senderIdentity: string;
  status: "Sent" | "Delivered" | "Opened" | "Failed" | "Bounced" | "Undelivered" | "Received";
  sequenceDay: number;
  sentAt: Date;
  channel?: "email" | "sms";
  // ── V2 fields ────────────────────────────────────────────────────────────────
  /** Direction of the message. Defaults to "outbound" for all V1 records. */
  direction?: "inbound" | "outbound";
  /** Workflow and step context for inbound replies */
  workflowId?: string;
  workflowName?: string;
  stepName?: string;
  /** Email body text (present on inbound records). */
  body?: string;
  /** Whether the message has been read. Undefined/true = read; false = unread. */
  read?: boolean;
}

export interface Task {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  listingStatus: string;
  callObjective: string;
  voicemailScript: string;
  dueDay: number;
  scheduledFor: Date;
  status: "pending" | "completed";
  disposition?: "Answered" | "VM Left" | "No Answer" | "Not Needed" | string;
}

export interface FilterRule {
  field:
    | "listingStatus"
    | "userType"
    | "firstName"
    | "lastName"
    | "email"
    | "phone"
    | "listingName";
  operator: "=" | "!=" | "contains" | "not_contains";
  value: string;
  logic: "and" | "or";
}

export interface FilterGroup {
  id: string;
  filters: FilterRule[];
  connectorAfter: "and" | "or";
}

export interface SavedSegment {
  id: string;
  name: string;
  description: string;
  filters: FilterRule[];
  createdAt: Date;
  excludeFilters?: FilterRule[];
  includedContactIds?: string[];
  excludedContactIds?: string[];
}

export interface Segment {
  id: string;
  name: string;
  description?: string;
  contactCount: number;
  status: "Active" | "Inactive";
  lastUpdatedAt: Date;
  lastUpdatedBy?: string;
  createdBy: string;
  createdAt: Date;
  filters: FilterRule[];
  excludeFilters?: FilterRule[];
  includedContactIds?: string[];
  excludedContactIds?: string[];
}

export interface TaskItem {
  id: string;
  contactName: string;
  contactId: string;
  contactStatus: string;
  taskType: string;
  source: string;
  sourceType: "flow" | "manual";
  dueDate: Date;
  assignee?: string;
  status: "pending" | "completed" | "overdue" | "suspended";
  disposition?: string;
  dispositionLoggedAt?: Date;
  callStartedAt?: Date;
  droppedVoicemailName?: string;
  ruleId?: string;
  ruleName?: string;
  triggerContext?: string;
  notes?: string;
  completedAt?: Date;
  outcome?: string;
  // Explicit workflow links — replaces brittle string-pattern ID lookup
  enrollmentId?: string;
  stepId?: string;
  // Retry tracking
  retryCount?: number;
  parentTaskId?: string;
  priority?: "low" | "normal" | "high" | "urgent";
}

export type OutcomeAction =
  | "advance"
  | "advance-and-insert-followup"
  | "retry"
  | "skip-remaining"
  | "pause-enrollment";

export interface OutcomeFollowup {
  taskType: string;
  delayDays: number;
  objective: string;
  notes?: string;
}

export interface OutcomeRule {
  disposition: string;
  action: OutcomeAction;
  followup?: OutcomeFollowup;
  retryAfterDays?: number;
  maxRetries?: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  order: number;
  dayOffset: number;
  actionType: "email" | "sms" | "call-reminder" | "voicemail-reminder" | "delay" | "conditional";
  delayDays?: number;
  delayHours?: number;
  delayMinutes?: number;
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
  /** CRM-700: send scope for email/SMS steps. "once" = one send per contact; "per-listing" = one per matching listing; "per-application" = one per application. Forced to per-listing at runtime when the template uses a {{listing.*}} token. */
  sendMode?: "once" | "per-listing" | "per-application";
  outcomeRules?: OutcomeRule[];
  // ── V2: Conditional (if/else) step fields ────────────────────────────────────
  conditionField?: string;
  conditionOperator?: "=" | "!=" | "is true" | "is false" | ">" | "<" | ">=" | "<=";
  conditionValue?: string;
  ifBranch?: WorkflowStep[];
  elseBranch?: WorkflowStep[];
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  segmentId: string;
  segmentName: string;
  status: "active" | "draft" | "paused";
  steps: WorkflowStep[];
  createdAt: Date;
  createdBy: string;
  enrolledCount: number;
  // ── V2 fields ────────────────────────────────────────────────────────────────
  /** When true, this workflow was duplicated from another; original id stored here */
  duplicatedFromId?: string;
}

export interface WorkflowStepProgress {
  stepId: string;
  status: "pending" | "done" | "skipped";
  completedAt?: Date;
  customDelayDays?: number;
  customDelayHours?: number;
  customDelayMinutes?: number;
}

export interface CustomWorkflowStep extends WorkflowStep {
  isCustom: true;
  insertAfterStepId: string | null;
  createdAt: Date;
}

export interface WorkflowEnrollment {
  id: string;
  workflowId: string;
  contactId: string;
  startDate: Date;
  status: "active" | "completed" | "paused";
  stepProgress: WorkflowStepProgress[];
  customSteps?: CustomWorkflowStep[];
  pausedUntil?: Date;   // V2
  pauseReason?: string; // V2
}

export type ApplicationStage =
  | "Leads"
  | "Prequalification Review"
  | "Completed Initial Application"
  | "Submitted to Underwriting"
  | "Requested Prepaid Docs"
  | "On Hold"
  | "Withdrawn"
  | "Funded";

export type LoanPurpose =
  | "Start a Business"
  | "Buy Commercial Real Estate"
  | "Debt Refinance"
  | "Equipment Purchase"
  | "Working Capital";

export interface Application {
  id: string;
  applicationNumber: string;
  stage: ApplicationStage;
  loanPurpose: LoanPurpose;
  branchName: string;
  loanOfficerName: string;
  assigneeName: string;
  loanAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type BusinessAcquisitionStage =
  | "New Lead"
  | "Qualified"
  | "Proposal Sent"
  | "Negotiation"
  | "Closed Won"
  | "Closed Lost"
  | "On Hold";

export type AcquisitionType =
  | "Direct Referral"
  | "Cold Outreach"
  | "Partnership"
  | "Inbound Inquiry"
  | "Broker Network";

export interface BusinessAcquisitionRecord {
  id: string;
  recordNumber: string;
  stage: BusinessAcquisitionStage;
  acquisitionType: AcquisitionType;
  branchName: string;
  agentName: string;
  assigneeName: string;
  dealValue: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactActivityRecord {
  id: string;
  contactId: string;
  type:
    | "task_completed"
    | "email_sent"
    | "sms_sent"
    | "step_skipped"
    | "step_unskipped"
    | "enrollment_paused"
    | "enrollment_resumed"
    | "enrollment_created"
    | "custom_step_added"
    | "custom_step_removed"
    | "contact_moved_to_step"
    | "status_changed"
    | "contact_updated"
    // Task lifecycle
    | "task_suspended"
    | "task_reactivated"
    | "call_started"
    | "call_outcome_captured"
    | "task_retry_created";
  taskType?: string;
  disposition?: string;
  note?: string;
  source?: string;
  sourceType?: "flow" | "manual";
  stepName?: string;
  subject?: string;
  message?: string;
  assignee?: string;
  oldStatus?: string;
  newStatus?: string;
  updatedFields?: string[];
  timestamp: Date;
  dialerSessionId?: string;
  retryOf?: string;
}

// ── Admin Configuration Types ─────────────────────────────────────────────────

export interface TemplateFolder {
  id: string;
  name: string;
  parentId: string | null;        // null = top-level
  visibleToLoanOfficers: boolean;
  createdAt: Date;
}

export type UnlayerDesign = { body: { rows: unknown[]; [k: string]: unknown }; [k: string]: unknown };

export interface AdminEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  /** Unlayer design JSON (present once saved via the visual builder); null for legacy HTML-only seeds. */
  design?: UnlayerDesign | null;
  folderId: string | null;               // null = Uncategorized
  visibleToLoanOfficers: boolean | null; // override: null = inherit
  senderType: "brand" | "loan-officer";
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
  /** System templates are managed in config but hidden from manual-send pickers. */
  isSystem?: boolean;
}

export type SmsTemplateCategory = string;

export interface SmsTemplate {
  id: string;
  name: string;
  message: string;
  characterCount: number;
  category: SmsTemplateCategory;
  createdAt: Date;
  updatedAt: Date;
}

export type VoicemailCategory = string;

export type VoicemailScriptType = "record" | "script";

export interface VoicemailScript {
  id: string;
  name: string;
  type: VoicemailScriptType;
  scriptText: string;
  audioUrl: string;
  estimatedDurationSeconds: number;
  category: VoicemailCategory;
  createdAt: Date;
  updatedAt: Date;
}

export interface VoicemailSettings {
  providerName: string;
  fromPhoneNumber: string;
  ringlessEnabled: boolean;
  defaultGreeting: string;
  recordingEnabled: boolean;
}

export type SenderIdentityType = "brand" | "loan-officer";

export interface SenderIdentity {
  id: string;
  displayName: string;
  emailAddress: string;
  type: SenderIdentityType;
  isDefault: boolean;
  createdAt: Date;
}

export interface Notification {
  id: string;
  type:
    | "task_due"
    | "task_overdue"
    | "workflow_update"
    | "application_update"
    // ── V2 workflow-specific types ────────────────────────────────────────────
    | "enrollment_completed"
    | "enrollment_paused"
    | "step_bounced"
    | "workflow_completed_all"
    | "inbound_reply"
    | "segment_membership_changed";
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  /** V2: link to a specific workflow, contact, or task for actionable navigation */
  workflowId?: string;
  contactId?: string;
  taskId?: string;
}

/** V2: per-type notification opt-in preferences. All types default to true. */
export type NotificationPreferences = {
  [K in Notification["type"]]: boolean;
};

// ── V2: Segment enhancements ──────────────────────────────────────────────────

export interface SegmentV2 extends Segment {
  segmentType: "dynamic" | "static";
  /** Populated when segmentType = "static"; contact ids locked at save time */
  snapshotContactIds?: string[];
}

// ── V2: Filter rule extensions ────────────────────────────────────────────────

export type FilterFieldV2 =
  | "listingStatus"
  | "userType"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "listingName"
  | "brokerageName"
  | "createAt"
  | "openReminders"
  | "optedOut"
  | "hasActiveEnrollment"
  | "enrolledInWorkflow"
  | "lastContacted";

export type FilterOperatorV2 =
  | "="
  | "!="
  | "is true"
  | "is false"
  | "contains"
  | "not_contains"
  | "before"
  | "after"
  | "within_last_n_days"
  | ">"
  | "<"
  | ">="
  | "<=";

export interface FilterRuleV2 {
  field: FilterFieldV2;
  operator: FilterOperatorV2;
  value: string;
  logic: "and" | "or";
}

export interface FilterGroupV2 {
  id: string;
  filters: FilterRuleV2[];
  connectorAfter: "and" | "or";
}

// ── V2: LO groups (RFC-008 — named round-robin fallback pools) ─────────────────

/** A named group of internal-team users, usable as a bulk-create round-robin pool. */
export interface LoGroup {
  id: string;
  name: string;
  description?: string;
  /** Member user names (matches TeamUser.name / contact.loanOfficer values). */
  memberNames: string[];
  isActive: boolean;
  createdAt: Date;
}
