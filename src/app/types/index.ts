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
  /** Dynamic count badge (e.g. open tasks). 0/undefined hides it. */
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
  /** Mirrors `contacts.lead_source` — the ingest channel that first created this contact. */
  leadSource?: string;
  /** Flat attribution: the closed-enum traffic source. Falls back to the taxonomy path when absent. */
  originalTrafficSource?: TrafficSourceId;
  /** Drill-down 1 (utm_source / platform). */
  sourceDetail1?: string;
  /** Drill-down 2 (utm_content / utm_term, ad set, keyword). */
  sourceDetail2?: string;
  /** Campaign this contact is attributed to — a first-class object, not a taxonomy level. */
  campaignId?: string;
  /** Answers to admin-defined custom fields, keyed by CustomFieldDefinition.key. */
  customFields?: Record<string, string>;
  /** Mirrors `contacts.status` — lifecycle state used by the contact list Status filter. */
  status?: ContactStatus;
  /** Record visibility. The CRM only exposes PUBLIC today; kept as a field for parity. */
  visibility?: ContactVisibility;
  /** Id of the Company acting as this contact's office. */
  officeCompanyId?: string;
}

/** Contact lifecycle status (mirrors the CRM's `contacts.status` filter values). */
export type ContactStatus = "Active" | "Inactive" | "Unqualified";

/** Record visibility. The CRM ships a single option today, same as the real header. */
export type ContactVisibility = "Public";

/**
 * The closed set of traffic sources — code-owned, never editable in Settings.
 *
 * Deliberately a subset of HubSpot's ten: these are the channels LoanBud can attribute
 * today (referrals, offline/untracked forms, our own email) plus the two paid channels
 * being run now. The web-tracked ones — Organic search, Organic social, Direct traffic,
 * AI referrals, Other campaigns — need website analytics that is not connected yet, so
 * leads that would belong to them currently land in `offline-sources`.
 *
 * To add one back: add the member here, add a row to TRAFFIC_SOURCES in
 * data/trafficSources.ts, and teach trafficSourceFromUtm() how to reach it.
 */
export type TrafficSourceId =
  | "referrals"
  | "offline-sources"
  | "paid-social"
  | "paid-search"
  | "email-marketing";

export type CampaignStatus = "Draft" | "Active" | "Paused" | "Completed";

/**
 * A marketing campaign — its own object, keyed by `utmCampaign`. Contacts point at
 * it, so one campaign running across several channels stays a single row.
 */
export interface Campaign {
  id: string;
  name: string;
  /** The `utm_campaign` value that links inbound leads to this campaign. */
  utmCampaign: string;
  /** Primary channel; a campaign can still receive contacts from other sources. */
  channel: TrafficSourceId;
  status: CampaignStatus;
  startDate?: Date;
  endDate?: Date;
  description?: string;
  createdAt: Date;
}

/** What a marketing form posts to the CRM's lead-ingest endpoint. */
export interface LeadFormPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  /** The form's own name, recorded as the lead source. */
  formName?: string;
  /** Questionnaire answers keyed by field key; unknown keys are auto-discovered. */
  answers: Record<string, string>;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

/** What the CRM did with an ingested form submission — drives the demo screen's result panel. */
export interface LeadIngestResult {
  contact: Contact;
  trafficSource: TrafficSourceId;
  campaignId: string | null;
  campaignCreated: boolean;
  discoveredKeys: string[];
}

/** A company record — mirrors the CRM's companies list. */
export interface Company {
  id: string;
  name: string;
  companyType: string;
  /** Contact id of the primary contact. */
  primaryContactId?: string;
  tags?: string[];
  /** Office fields, shown when this company acts as a contact's office. */
  brokerage?: string;
  officeId?: string;
  applyLink?: string;
  /** System field: which system created the record. */
  attributionSource?: string;
  createdAt: Date;
  updatedAt?: Date;
}

/** A business listing — mirrors the CRM's listings list. */
export interface ListingRecord {
  id: string;
  name: string;
  askingPrice: number;
  status: ListingStatus;
  industry: string;
  location: string;
  /** Contact id of the broker or seller. */
  brokerContactId?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export type CustomFieldType = "text" | "number" | "date" | "select";

/**
 * An admin-defined field. Marketing forms can post unknown keys; those arrive as
 * auto-discovered definitions that stay hidden until someone turns them on.
 */
export interface CustomFieldDefinition {
  id: string;
  /** Stable key sent by forms and used in Contact.customFields. */
  key: string;
  label: string;
  type: CustomFieldType;
  /** Options for `select` fields. */
  options?: string[];
  /** Which detail section it renders under. */
  section: string;
  /** Hidden fields are stored but not shown — the default for auto-discovered keys. */
  isVisible: boolean;
  /** Whether the field is offered as a segment filter. */
  isFilterable: boolean;
  /** Discovered from an inbound form payload rather than created by an admin. */
  isAutoDiscovered: boolean;
  createdAt: Date;
}

/** Where a bulk contact import originated. Drives the import modal's parsing rules. */
export type ContactImportSource = "csv" | "bizbuysell";

/** The minimum a caller must supply to create a contact; everything else is defaulted. */
export type NewContactInput = Partial<Contact> &
  Pick<Contact, "firstName" | "lastName" | "email">;

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
  /** Dynamic segments re-evaluate their filters; static ones freeze a contact list. */
  segmentType?: "dynamic" | "static";
  /** Populated when segmentType = "static"; contact ids locked at save time. */
  snapshotContactIds?: string[];
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
  outcomeRules?: OutcomeRule[];
  // ── V2: Conditional (if/else) step fields ────────────────────────────────────
  conditionField?: string;
  /** Same operator vocabulary the segment builder uses — see {@link FilterOperatorV2}. */
  conditionOperator?: FilterOperatorV2;
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
  /** V2: which listing this enrollment is for. Undefined for non-listing-filtered enrollments. */
  listingId?: string;
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

/** @deprecated Its fields now live on {@link Segment}; kept as an alias for call sites. */
export type SegmentV2 = Segment;

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
