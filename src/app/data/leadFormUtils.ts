import type {
  ContactLeadAnswer,
  Contact,
  CoreMappingTarget,
  CustomFieldDefinition,
  CustomFieldType,
  LeadFormDefinition,
  LeadFormFieldMapping,
  LeadIdentityKind,
  PlatformAccount,
} from "../types";
import { answerMapForContact } from "./contactLeadAnswers";

/**
 * Lead-form reading helpers — pure functions, no components, so the contact detail
 * screen can import them without tripping the repo's react-refresh rule.
 *
 * The idea this file exists to serve: the CRM stores one answer per *field*, but a
 * contact's detail page should show what the form they filled actually *asked*. Three
 * forms map onto the same four fields; two of them word the questions identically and
 * the third does not. Keeping the question with the form is what makes that visible.
 */

/** Surfaces a Meta impression can be served on — what `sourceDetail1` holds. */

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta",
  google: "Google",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
};

export function leadFormPlatformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

export function leadFormById(
  forms: LeadFormDefinition[],
  id: string | undefined,
): LeadFormDefinition | undefined {
  return id ? forms.find((form) => form.id === id) : undefined;
}

/** Looks a form up by the platform's own id — the key a webhook would send. */
export function leadFormByExternalRef(
  forms: LeadFormDefinition[],
  platform: string,
  externalRef: string,
): LeadFormDefinition | undefined {
  return forms.find(
    (form) => form.platform === platform && form.externalRef === externalRef,
  );
}

/**
 * The question, spelled out, from the platform's own key.
 *
 * Platform keys are the question text slugged — so unslugging them gives back what
 * the lead actually read. Only spacing and capitalisation are touched: every other
 * character survives, including the ® in "fico®_credit_score", which is part of the
 * question and not decoration to be stripped.
 */
export function questionFromExternalKey(externalKey: string): string {
  const words = externalKey.replace(/_/g, " ").trim();
  if (!words) return externalKey;

  const capitalised = words.charAt(0).toUpperCase() + words.slice(1);
  // FICO is an acronym in every form's wording; leave any trailing ® attached.
  return capitalised.replace(/fico/gi, "FICO");
}

/** One question on the form the contact filled, with their answer. */
export interface InboundAnswer {
  /** The platform's key — stable, and unique within a form. */
  externalKey: string;
  /** The question as the form asked it. */
  question: string;
  /** The CRM field the answer landed in; empty when the question is unmapped. */
  customFieldKey: string;
  /** `null` when the form asked and the lead left it blank. */
  answer: string | null;
}

/**
 * The questionnaire part of `form`, in form order, paired with this contact's answer.
 *
 * Core mappings (name, email, phone) are left out — they are already on the contact
 * record, and repeating them under "what the form asked" would be the same fact
 * twice. Questions the lead skipped are kept with a null answer rather than dropped:
 * "the form asked and they would not say" is a different fact from "the form never
 * asked", and only the first one tells you something about the lead.
 */
export function inboundAnswers(
  contact: Contact,
  form: LeadFormDefinition,
  leadAnswers: ContactLeadAnswer[],
): InboundAnswer[] {
  const answers = answerMapForContact(contact.id, leadAnswers);

  return [...form.fieldMappings]
    .filter((mapping) => mapping.targetKind === "custom" && !mapping.isIgnored)
    .sort((a, b) => a.order - b.order)
    .map((mapping) => ({
      externalKey: mapping.externalKey,
      question: questionFromExternalKey(mapping.externalKey),
      customFieldKey: mapping.targetKey,
      answer: mapping.targetKey
        ? answers[mapping.targetKey]?.trim() || null
        : null,
    }));
}

/**
 * What to call the platform in the section heading.
 *
 * Prefers the surface the lead actually came in on — `sourceDetail1` carries
 * "Facebook" or "Instagram" for Meta leads — and falls back to the form's platform
 * when the surface was never captured, which is the case for every lead that reached
 * a form without tracking. Never hard-codes one network.
 */
export function inboundPlatformName(form: LeadFormDefinition): string {
  // The exact surface (Facebook vs Instagram) arrives on the raw submission but is
  // not one of the fields we extract yet, so the form's platform is the honest answer.
  return leadFormPlatformLabel(form.platform);
}

/** "Inbound Details — Facebook". */
export function inboundSectionTitle(form: LeadFormDefinition): string {
  return `Inbound Details — ${inboundPlatformName(form)}`;
}

/**
 * How many times this person has come back.
 *
 * This used to compare an "original" against a "latest" attribution column. Those
 * columns are gone: the submission log answers the question directly, and answers it
 * completely — two submissions through the *same* channel are still two visits, which
 * the old comparison silently reported as none.
 */
export function submissionCount(
  contactId: string,
  events: { contactId?: string }[],
): number {
  return events.filter((e) => e.contactId === contactId).length;
}


// ── Mapping health ───────────────────────────────────────────────────────────

/** The built-in contact columns a mapping can target. */
export const CORE_TARGETS: { key: CoreMappingTarget; label: string }[] = [
  { key: "firstname", label: "First name" },
  { key: "lastname", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
];

export function coreTargetLabel(key: string): string {
  return CORE_TARGETS.find((t) => t.key === key)?.label ?? key;
}

export type MappingStatus =
  | "mapped"
  | "unmapped"
  | "conflict"
  | "ignored"
  | "type-mismatch";

/** What each core target can actually hold. */
const CORE_TARGET_TYPES: Record<CoreMappingTarget, CustomFieldType> = {
  firstname: "text",
  lastname: "text",
  email: "text",
  phone: "text",
};

/**
 * The CRM type a platform question ought to land in.
 *
 * Meta's own input types are the source: a multiple choice carries a closed option
 * set, a number carries ordering. Both of those are properties of the data, not of
 * the label, and both are lost the moment the answer is filed as free text.
 */
const EXPECTED_CRM_TYPE: Record<string, CustomFieldType> = {
  "short answer": "text",
  "email": "text",
  "phone number": "text",
  "multiple choice": "select",
  "conditional": "select",
  "number": "number",
  "number range": "number",
  "date": "date",
  "date time": "date",
};

export function expectedCrmType(
  externalType: string | undefined,
): CustomFieldType | undefined {
  return externalType
    ? EXPECTED_CRM_TYPE[externalType.trim().toLowerCase()]
    : undefined;
}

/** The type of whatever a mapping points at, core column or custom field. */
export function targetFieldType(
  mapping: LeadFormFieldMapping,
  definitions: CustomFieldDefinition[],
): CustomFieldType | undefined {
  if (!mapping.targetKey) return undefined;
  if (mapping.targetKind === "core") {
    return CORE_TARGET_TYPES[mapping.targetKey as CoreMappingTarget];
  }
  return definitions.find((d) => d.key === mapping.targetKey)?.type;
}

/**
 * Whether a mapping quietly downgrades the answer on its way in.
 *
 * This is the check the platform's own UI does not make. A multiple choice routed
 * into a single-line text field syncs perfectly and reports success — the value
 * arrives, nothing errors — and the option set is gone, so nobody can filter on it
 * or chart it again. Same for a number landing in a text field: it stores fine and
 * stops being comparable.
 *
 * Unmapped and ignored rows are excluded: there is no destination to disagree with.
 */
export function hasTypeMismatch(
  mapping: LeadFormFieldMapping,
  definitions: CustomFieldDefinition[],
): boolean {
  if (mapping.isIgnored || !mapping.targetKey) return false;

  const expected = expectedCrmType(mapping.externalType);
  const actual = targetFieldType(mapping, definitions);
  if (!expected || !actual) return false;

  return expected !== actual;
}

/** "Multiple choice → select, but funding_purpose is text" — the sentence to show. */
export function typeMismatchReason(
  mapping: LeadFormFieldMapping,
  definitions: CustomFieldDefinition[],
): string | null {
  if (!hasTypeMismatch(mapping, definitions)) return null;

  const expected = expectedCrmType(mapping.externalType);
  const actual = targetFieldType(mapping, definitions);
  return `Meta sends ${mapping.externalType} (${expected}); ${mapping.targetKey} is ${actual}. The answer still arrives, but it stops being filterable as ${expected}.`;
}

/**
 * External keys whose destination is not agreed across forms.
 *
 * The rule that matters is the direction of the check. Several *different* questions
 * feeding one CRM field is the design working — "what is your FICO® credit score?"
 * and "what is your FICO score?" are the same question in different words. The
 * failure is the reverse: one question key pointing at different fields depending on
 * which form it arrived through. That silently splits a single question's answers
 * across two columns, and nothing in the platform's own UI will tell you it happened.
 *
 * Returns externalKey → the distinct target keys it was pointed at, sorted.
 */
export function conflictingExternalKeys(
  forms: LeadFormDefinition[],
): Map<string, string[]> {
  const targetsByKey = new Map<string, Set<string>>();

  for (const form of forms) {
    for (const mapping of form.fieldMappings) {
      // An ignored or not-yet-mapped row has no opinion about the destination.
      if (mapping.isIgnored || !mapping.targetKey) continue;
      const seen = targetsByKey.get(mapping.externalKey) ?? new Set<string>();
      seen.add(mapping.targetKey);
      targetsByKey.set(mapping.externalKey, seen);
    }
  }

  const conflicts = new Map<string, string[]>();
  for (const [externalKey, targets] of targetsByKey) {
    if (targets.size > 1) conflicts.set(externalKey, [...targets].sort());
  }
  return conflicts;
}

export function mappingStatus(
  mapping: LeadFormFieldMapping,
  conflicts: Map<string, string[]>,
  definitions: CustomFieldDefinition[] = [],
): MappingStatus {
  if (mapping.isIgnored) return "ignored";
  if (!mapping.targetKey) return "unmapped";
  // A cross-form conflict outranks a type mismatch: two destinations is a worse
  // problem than one destination of the wrong shape.
  if (conflicts.has(mapping.externalKey)) return "conflict";
  return hasTypeMismatch(mapping, definitions) ? "type-mismatch" : "mapped";
}

export interface FormMappingSummary {
  mapped: number;
  unmapped: number;
  conflict: number;
  ignored: number;
  "type-mismatch": number;
  total: number;
  /** The worst state on the form — what the row badge shows. */
  status: MappingStatus;
}

/**
 * A form's mapping health. A form with no mappings at all counts as unmapped rather
 * than as perfectly fine with zero problems: nothing it collects can reach the CRM.
 */
export function formMappingSummary(
  form: LeadFormDefinition,
  conflicts: Map<string, string[]>,
  definitions: CustomFieldDefinition[] = [],
): FormMappingSummary {
  const counts = {
    mapped: 0,
    unmapped: 0,
    conflict: 0,
    ignored: 0,
    "type-mismatch": 0,
  };
  for (const mapping of form.fieldMappings) {
    counts[mappingStatus(mapping, conflicts, definitions)] += 1;
  }

  const total = form.fieldMappings.length;
  let status: MappingStatus = "mapped";
  if (counts.conflict > 0) status = "conflict";
  else if (counts.unmapped > 0 || total === 0) status = "unmapped";
  else if (counts["type-mismatch"] > 0) status = "type-mismatch";

  return { ...counts, total, status };
}

// ── Counts, derived from the contacts themselves ─────────────────────────────

export interface LeadFormStats {
  /** Contacts attributed to this form. */
  leads: number;
  /** When the newest of them arrived; undefined when there are none. */
  lastLeadAt?: Date;
}

/**
 * Lead counts per form, counted from the contacts rather than stored on the form.
 *
 * A stored `submissionCount` cannot tell "no new leads this week" apart from "the
 * sync broke on Tuesday" — both leave the number where it was. Counting the records
 * that actually exist, and reading the newest one's date, keeps those two apart.
 */
export function leadStatsByForm(
  contacts: Contact[],
  leadAnswers: ContactLeadAnswer[],
): Map<string, LeadFormStats> {
  const stats = new Map<string, LeadFormStats>();
  const byId = new Map(contacts.map((c) => [c.id, c]));

  // One contact can have answered two forms, so the form lives on the answer rows
  // rather than on the person. Count each contact once per form they actually used.
  const seen = new Set<string>();
  for (const answer of leadAnswers) {
    const formId = answer.leadFormId;
    if (!formId || seen.has(`${answer.contactId}::${formId}`)) continue;
    if (!byId.has(answer.contactId)) continue;
    seen.add(`${answer.contactId}::${formId}`);

    const current = stats.get(formId) ?? { leads: 0 };
    current.leads += 1;

    const arrived = new Date(answer.answeredAt);
    if (!current.lastLeadAt || arrived > current.lastLeadAt) {
      current.lastLeadAt = arrived;
    }
    stats.set(formId, current);
  }

  return stats;
}

export interface PlatformAccountStats extends LeadFormStats {
  /** Forms belonging to this account, active or not. */
  forms: number;
}

export function platformAccountStats(
  account: PlatformAccount,
  forms: LeadFormDefinition[],
  contacts: Contact[],
  leadAnswers: ContactLeadAnswer[],
): PlatformAccountStats {
  const owned = forms.filter((f) => f.platformAccountId === account.id);
  const byForm = leadStatsByForm(contacts, leadAnswers);

  let leads = 0;
  let lastLeadAt: Date | undefined;
  for (const form of owned) {
    const stats = byForm.get(form.id);
    if (!stats) continue;
    leads += stats.leads;
    if (stats.lastLeadAt && (!lastLeadAt || stats.lastLeadAt > lastLeadAt)) {
      lastLeadAt = stats.lastLeadAt;
    }
  }

  return { forms: owned.length, leads, lastLeadAt };
}

export function formsForAccount(
  accountId: string,
  forms: LeadFormDefinition[],
): LeadFormDefinition[] {
  return forms.filter((form) => form.platformAccountId === accountId);
}

/** Accounts grouped by platform, so the settings screen can head each group. */
export function accountsByPlatform(
  accounts: PlatformAccount[],
): { platform: string; label: string; accounts: PlatformAccount[] }[] {
  const groups = new Map<string, PlatformAccount[]>();
  for (const account of accounts) {
    const existing = groups.get(account.platform);
    if (existing) existing.push(account);
    else groups.set(account.platform, [account]);
  }

  return [...groups.entries()]
    .map(([platform, list]) => ({
      platform,
      label: leadFormPlatformLabel(platform),
      accounts: list,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}


// ── Who a submission belongs to ──────────────────────────────────────────────

/** The identifiers a lead ad submission can arrive with. */
export interface SubmissionIdentity {
  email?: string;
  phone?: string;
}

export interface ResolvedIdentity {
  kind: LeadIdentityKind;
  /** The value the contact is matched or created on. Empty when nothing usable. */
  value: string;
  /** Why it came out this way — shown in the ingest demo. */
  reason: string;
}

/**
 * Email, or nothing.
 *
 * There is no phone fallback and no switch to enable one: `contacts.email` is NOT NULL
 * and unique, so a contact without a real email cannot exist. A submission carrying a
 * phone but no email is not "nearly a contact" — it is kept whole as a raw event.
 */
export function resolveSubmissionIdentity(
  submission: SubmissionIdentity,
): ResolvedIdentity {
  const email = submission.email?.trim() ?? "";

  if (email) {
    return { kind: "email", value: email, reason: "Matched on the email address." };
  }

  // No phone fallback and no switch to turn one on: `contacts.email` is NOT NULL and
  // unique, so a contact without a real email cannot exist. The submission is kept
  // whole as a raw event instead.
  return {
    kind: "none",
    value: "",
    reason: submission.phone?.trim()
      ? "No email — kept as a raw event, even though a phone number was sent."
      : "No email — kept as a raw event.",
  };
}

/** An existing contact carrying this identity, if there is one. */
export function findContactByIdentity(
  identity: ResolvedIdentity,
  contacts: Contact[],
): Contact | undefined {
  const needle = identity.value.trim().toLowerCase();
  if (!needle) return undefined;

  if (identity.kind === "email") {
    return contacts.find((c) => c.email.trim().toLowerCase() === needle);
  }
  if (identity.kind === "phone") {
    const digits = (value: string) => value.replace(/\D/g, "");
    return contacts.find((c) => c.phone && digits(c.phone) === digits(needle));
  }
  return undefined;
}

// ── Sync timestamps ──────────────────────────────────────────────────────────

/**
 * When an account last pulled anything.
 *
 * Derived from its forms rather than stored on the account: the account does not
 * sync, its forms do, and a second copy of the same fact is a second thing to keep
 * in step.
 */
export function accountLastSyncedAt(
  account: PlatformAccount,
  forms: LeadFormDefinition[],
): Date | undefined {
  let latest: Date | undefined;
  for (const form of formsForAccount(account.id, forms)) {
    const synced = form.submissionsLastSyncedAt
      ? new Date(form.submissionsLastSyncedAt)
      : undefined;
    if (synced && (!latest || synced > latest)) latest = synced;
  }
  return latest;
}
