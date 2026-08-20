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
  /**
   * Mirrors `contacts.lead_source` — which channel produced this lead.
   *
   * **First touch wins.** A contact who first arrived through BizBuySell keeps that
   * origin even after later filling in a Facebook form: attribution answers a
   * historical question, so a return visit must not move it, or last month's
   * reporting changes every time somebody clicks an ad.
   *
   * "Most recent touch" is deliberately NOT a field: it is a query over
   * `inboundLeadEvents`, which holds one row per submission and so returns the whole
   * history rather than only the last of it.
   */
  leadSource?: string;
  /**
   * Mirrors `contacts.attribution_source` — which system created the record, and the
   * field that gates who may see this contact. Write-once: the backend's update path
   * has no parameter for it at all.
   */
  attributionSource?: string;
  /** Campaign this contact is attributed to. Wave 3 — the underlying platform id is
   *  captured on the inbound event from day one, and backfilled here later. */
  campaignId?: string;
  /** Mirrors `contacts.status` — lifecycle state used by the contact list Status filter. */
  status?: ContactStatus;
  /** Record visibility. The CRM only exposes PUBLIC today; kept as a field for parity. */
  visibility?: ContactVisibility;
  /** Id of the Company acting as this contact's office. */
  officeCompanyId?: string;

  /**
   * The four underwriting criteria **as the lead typed them into an ad**.
   *
   * The `lead` prefix is load-bearing. These are self-reported on a Facebook form by
   * someone who wants money; the verified figures live on the application and are the
   * ones a decision is made on. A bare name like `ficoScore` would invite the next
   * person to treat this as the truth and stop looking at `Application`.
   */
  leadFicoMin?: number;
  leadFicoMax?: number;
  leadFundingPurpose?: string;
  leadRequestedAmount?: number;
  /** How soon the lead says they need the money. Mirrors the CRM's own column. */
  timeFrame?: string;
}


/** Contact lifecycle status (mirrors the CRM's `contacts.status` filter values). */
export type ContactStatus = "Active" | "Inactive" | "Unqualified";

/** Record visibility. The CRM ships a single option today, same as the real header. */
export type ContactVisibility = "Public";

export type CampaignStatus = "Draft" | "Active" | "Paused" | "Completed";

/**
 * One campaign object on the ad platform side. A CRM campaign fans out to many of
 * these on purpose: eight of LoanBud's eleven live Meta campaigns belong to the same
 * "Epsilon" program, and spend only means anything once they are added up.
 *
 * `externalId` is the key — `externalName` is for display only, because marketers
 * rename campaigns inside Ads Manager and the id is what survives that.
 */
export interface CampaignExternalRef {
  /** Ad platform slug, e.g. "meta" or "google". */
  platform: string;
  /** The platform's own campaign id — the join key. */
  externalId: string;
  /** The platform's current campaign name. Display only; never match on it. */
  externalName: string;
}

/**
 * A marketing campaign — its own object, keyed by `utmCampaign`. Contacts point at
 * it, so one campaign running across several channels stays a single row.
 *
 * There is no single `channel` field: a campaign's channels are derived from its
 * `externalRefs` and from the traffic sources of the contacts attributed to it, both
 * of which can be more than one.
 */
export interface Campaign {
  id: string;
  name: string;
  /** The `utm_campaign` value that links inbound leads to this campaign. */
  utmCampaign: string;
  status: CampaignStatus;
  /**
   * Total media spend, in USD.
   *
   * @deprecated ROI is not in scope — Burke asked to trace which campaign a lead came
   * from, not what it cost. Nothing reads this today; it is kept as a placeholder so
   * the seeded numbers survive until cost reporting is actually asked for.
   */
  spend?: number;
  /** The platform-side campaigns this one rolls up. */
  externalRefs?: CampaignExternalRef[];
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

/** Which surface a Meta Instant Form impression was served on. */
export type MetaPlatform = "facebook" | "instagram";

/**
 * What Meta's Lead Ads webhook delivers.
 *
 * Deliberately UTM-free: an Instant Form opens inside Facebook or Instagram, the lead
 * never loads a page we control, and no `utm_*` exists to read. Attribution comes
 * from the platform's own ids instead — which is why this is a separate payload shape
 * with a separate adapter rather than a few extra fields on `LeadFormPayload`.
 */
export interface MetaLeadPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  /** Instant Form id — the stable key for the form. */
  formId: string;
  /** Form name as it currently reads in Meta. Display only. */
  formName: string;
  /** Meta campaign id. The join key for find-or-create; the name never is. */
  campaignId?: string;
  campaignName?: string;
  adsetId?: string;
  adsetName?: string;
  adId?: string;
  adName?: string;
  platform: MetaPlatform;
  /** True when the form was opened from an unpaid post rather than an ad. */
  isOrganic?: boolean;
  /** Questionnaire answers keyed by field key; unknown keys are auto-discovered. */
  answers: Record<string, string>;
}

/**
 * A connected page or ad account on an advertising platform.
 *
 * Lead forms hang off one of these because the connection has state of its own —
 * who authorised it, when, and how much history it back-fills — none of which
 * belongs on the individual forms.
 */
export interface PlatformAccount {
  id: string;
  /** Platform slug, e.g. "meta". */
  platform: string;
  /** "page" | "ad_account". */
  accountKind: string;
  /** The platform's own id for the page or account — the key. */
  externalRef: string;
  displayName: string;
  isActive: boolean;
  /** "New & recent leads" | "New leads only". */
  /** Whether contacts created by this sync count against the marketing quota. */
  setAsMarketingContacts: boolean;
  /** The CRM user who authorised the connection. */
  connectedByName: string;
  connectedAt: Date;
  /** Their account name on the platform — often not the same person's CRM name. */
  externalUserName: string;
}

/** Where a form answer lands: a built-in contact column, or a custom field. */
export type MappingTargetKind = "core" | "custom";

/** The built-in contact columns a form answer can be routed to. */
export type CoreMappingTarget = "firstname" | "lastname" | "email" | "phone";

/** One question on a lead form, and the CRM field its answer lands in. */
export interface LeadFormFieldMapping {
  /** The platform's own question key, verbatim. What the form actually asked. */
  externalKey: string;
  /**
   * The question's input type on the platform — "Short answer", "Multiple choice",
   * "Number". Kept because it is what makes a mismatch detectable: a multiple choice
   * routed into a free-text field arrives intact and loses its option set silently.
   */
  externalType?: string;
  /**
   * Where the answer goes: a `CoreMappingTarget` when `targetKind` is "core", a
   * CustomFieldDefinition key when it is "custom". Empty means the form sends this
   * question but nothing has been told to receive it — the answer is kept, unused.
   */
  targetKey: string;
  targetKind: MappingTargetKind;
  /** Position of the question on the form. */
  order: number;
  /** Deliberately not collected — distinct from simply not mapped yet. */
  isIgnored?: boolean;
}

/**
 * A lead form as it exists on the platform.
 *
 * The point of the mappings is that two forms can ask the same thing in different
 * words — "What is your FICO® credit score?" and "What is your FICO score?" — and
 * both land in one CRM field. The question text stays with the form, so a contact's
 * detail page can show what *that* form asked rather than a normalised label.
 */
export interface LeadFormDefinition {
  id: string;
  /** Platform slug, e.g. "meta". */
  platform: string;
  /** Id of the PlatformAccount this form belongs to. */
  platformAccountId: string;
  /** The platform's own form id — the key. `name` is display only. */
  externalRef: string;
  name: string;
  isActive: boolean;
  /** When the form was created on the platform, not in the CRM. */
  createdAtExternal?: Date;
  /**
   * When submissions were last pulled from the platform.
   *
   * A timestamp, not a count — this is a fact about the sync itself and cannot be
   * derived from the contacts, whereas the number of submissions can and therefore
   * is not stored.
   */
  submissionsLastSyncedAt?: Date;
  fieldMappings: LeadFormFieldMapping[];
}

/** How the CRM decided which campaign an ingested lead belongs to. */
export type CampaignMatchKey = "utm_campaign" | "meta_campaign_id";

/**
 * How the CRM decided who a submission belongs to.
 *
 * Email first, phone second, and nothing third. The third case is not an error — a
 * lead ad can be submitted with neither — so it is a named outcome rather than a
 * silent drop.
 */
export type LeadIdentityKind = "email" | "phone" | "none";


/** What the CRM did with an ingested form submission — drives the demo screen's result panel. */
export interface LeadIngestResult {
  /** Absent when the submission was skipped — see `identity`. */
  contact?: Contact;
  /** Which identifier the contact was matched or created on. */
  identity?: LeadIdentityKind;
  /** True when no contact was created: no email, and policy or phone did not allow one. */
  skipped?: boolean;
  /** The lead source the worker resolved. May differ from what was stored — first touch wins. */
  leadSource: string;
  /** True when an existing contact already had a lead source, so this one was NOT stored. */
  leadSourceKept?: boolean;
  campaignId: string | null;
  campaignCreated: boolean;
  discoveredKeys: string[];
  /** Which field the campaign was matched on. Null when no campaign was resolved. */
  campaignMatchedBy: CampaignMatchKey | null;
  /** The value that was matched — the utm_campaign key, or the Meta campaign id. */
  campaignMatchValue?: string;
  /**
   * True when the email already belonged to a contact. The original traffic source
   * was left alone and the latest one was updated instead.
   */
  isReturningContact: boolean;
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

/**
 * One answer a lead gave to one form question — the prototype's mirror of the
 * `contact_lead_answers` table (RFC-013 rev 18).
 *
 * Deliberately NOT a `Record<string, string>` on the Contact. The segment builder
 * can only filter on a real typed column, so a blob of answers is unfilterable:
 * `value` backs equality/IN, and `valueMin`/`valueMax` back range comparisons with
 * no cast. A bucketed answer ("580-639", "Under $100k") is a range, not a scalar —
 * which is why there are two bounds rather than one number.
 *
 * One row per contact per question: a second submission updates the answer in place
 * rather than appending, and a question the newer form did not ask keeps its earlier
 * answer. Full per-submission history lives on InboundLeadEvent.
 */
export interface ContactLeadAnswer {
  id: string;
  contactId: string;
  /** The mapped key the answer lands under — LeadFormFieldMapping.targetKey. */
  targetKey: string;
  /** Normalised answer text: "580-639", never "580-639_(poor)". */
  value: string;
  /** Lower bound when the answer is numeric. Equal to valueMax for a scalar. */
  valueMin?: number;
  /** Upper bound when the answer is numeric. Absent for an open-ended "720+". */
  valueMax?: number;
  /** The form this answer came from. */
  leadFormId?: string;
  /** When the lead answered — Meta's created_time, not our arrival time. Newest wins. */
  answeredAt: string;
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
  /** What the field means. Shown as a tooltip beside the label. */
  description?: string;
  /** Which detail section it renders under. Shown in the UI as "Group". */
  section: string;
  /** Hidden fields are stored but not shown — the default for auto-discovered keys. */
  isVisible: boolean;
  /** Whether the field is offered as a segment filter. */
  isFilterable: boolean;
  /** Discovered from an inbound form payload rather than created by an admin. */
  isAutoDiscovered: boolean;
  createdAt: Date;
  /**
   * When the field was archived. Archived fields disappear from the contact tab and
   * the segment builder but keep every answer already stored under their key.
   *
   * There is no delete. `Contact.customFields[key]` is the only copy of what a lead
   * typed into an ad, and dropping the definition would orphan it with no way back.
   */
  archivedAt?: Date;
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

/** The contact columns a segment can filter on, before custom fields are added. */
export type CoreFilterField =
  | "listingStatus"
  | "userType"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "listingName"
  | QualificationField;

/**
 * A filter's field id.
 *
 * `(string & {})` widens this to any string — a filterable CustomFieldDefinition
 * contributes its own `key` as a field id — while keeping the core names as
 * autocomplete suggestions rather than losing them to a bare `string`.
 */
export type FilterFieldId = CoreFilterField | (string & {});

export interface FilterRule {
  field: FilterFieldId;
  operator:
    | "="
    | "!="
    | "contains"
    | "not_contains"
    | ">"
    | "<"
    | ">="
    | "<="
    | "before"
    | "after";
  value: string;
  logic: "and" | "or";
}

/**
 * The four underwriting criteria a segment can filter on.
 *
 * Named after the CRM's own columns rather than after either source, because a rule
 * on one of these matches an application value *or* a lead-declared value — see
 * `matchesQualificationRule`.
 */
export type QualificationField =
  | "self_reported_fico"
  | "funding_purpose"
  | "requested_amount"
  | "funding_timeline";

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
  /**
   * When the loan actually funded. `stage === "Funded"` stays the single source of
   * truth for *whether* it funded — this is only the date, so campaign reporting can
   * say when the money landed without a second boolean to keep in sync.
   */
  fundedAt?: Date;

  /**
   * The same four criteria, captured on the application itself. These are what
   * segments should match on first; the contact's `lead*` fields only carry weight
   * for people who have not applied yet.
   */
  selfReportedFicoMin?: number;
  selfReportedFicoMax?: number;
  fundingPurpose?: string;
  requestedAmount?: number;
  timeFrame?: string;
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
  | "lastContacted"
  | QualificationField
  // Custom fields contribute their key; see FilterFieldId.
  | (string & {});

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


/* ─── Attribution ─────────────────────────────────────────────────────────────
 * RFC-013 rev 19: contact attribution needs NO new fields. `attributionSource` and
 * `leadSource` already carry it, and both are already frozen — the first by having
 * no update path at all, the second by a first-touch guard.
 *
 * Six fields were proposed across earlier revisions and all six were dropped; the
 * reasoning lives on `data/attribution.ts`. The lead-source vocabulary is data, not
 * a union type, because `lead_source` is free text in the database and unknown
 * values from other integrations are real.
 */

/* ─── Inbound lead events ─────────────────────────────────────────────────────
 * The raw inbox. One row per submission, kept whole and forever, written before
 * anything about it is interpreted. Every deferred feature is built later against
 * this rather than against a re-fetch that is no longer possible.
 */

/** Whether the pipeline finished. Separate from what it concluded. */
export type InboundEventStatus = "received" | "processed" | "failed";

/**
 * What the worker concluded about identity.
 *
 * **Email is the only matching key.** This follows HubSpot, which staff already use,
 * and it is stricter than treating phone as a signal too: a phone number is routinely
 * shared by a couple, a household, or a business line, so matching on it can attach a
 * lead to the wrong person. Refusing to look at it removes that failure entirely.
 *
 * The database makes the rest simple. `contacts.email` carries a unique index over
 * active rows, so a lookup returns nought or one — never several. There is no
 * ambiguity branch to write because there is no ambiguity to have.
 *
 * The cost is duplicates: somebody using a work address on one form and a personal
 * one on another becomes two contacts. Those surface in a possible-duplicates view
 * computed from shared phone numbers, and are merged by hand — the same trade HubSpot
 * makes, and the visible failure rather than the silent one.
 */
export type LeadResolution = "matched" | "created" | "skipped";

export type LeadResolutionReason =
  | "matched_email"
  | "created_new"
  /** No email on the submission, and the form is set not to create contacts without one. */
  | "no_email";


export interface InboundLeadEvent {
  id: string;
  platform: string;
  /** The platform's own submission id. Unique per platform — this is what makes a
   *  retry harmless, and it is why the table can dedupe permanently where a queue
   *  could only dedupe inside a short window. */
  externalEventId: string;
  externalFormId?: string;
  /** Stored although Campaigns do not exist until Wave 3, so that wave can backfill
   *  instead of starting from nothing. */
  externalCampaignId?: string;
  /** What the person actually submitted, before any of our interpretation. */
  answers: Record<string, string>;
  contactId?: string;
  status: InboundEventStatus;
  resolution: LeadResolution;
  resolutionReason: LeadResolutionReason;
  receivedAt: Date;
  /** Set when an operator has worked the row. */
  resolvedAt?: Date;
  resolvedByNote?: string;
}
