import type {
  Application,
  Contact,
  FilterRule,
  QualificationField,
} from "../types";

/**
 * The four underwriting criteria, and the two places they can come from.
 *
 * A lead who filled in a Facebook ad has told us a FICO band, a purpose, an amount
 * and a timeline. Someone who went on to apply has told the *application* the same
 * four things, verified. Both are real, and neither one supersedes the other for
 * every purpose — which is why there are two rules in this file rather than one:
 *
 *   filtering  → OR. A contact matches if any source satisfies the rule.
 *   displaying → precedence. The application wins, because it is the checked figure.
 *
 * Pure functions only — no components — so the segment builder and the contact
 * screen can both import from here under the repo's react-refresh rule.
 */

export const QUALIFICATION_FIELDS: QualificationField[] = [
  "self_reported_fico",
  "funding_purpose",
  "requested_amount",
  "funding_timeline",
];

const QUALIFICATION_FIELD_SET = new Set<string>(QUALIFICATION_FIELDS);

export function isQualificationField(field: string): field is QualificationField {
  return QUALIFICATION_FIELD_SET.has(field);
}

// ── Parsing what the ad platform actually sends ──────────────────────────────

/** A credit-score band. Either end may be open. */
export interface FicoRange {
  min?: number;
  max?: number;
}

/**
 * Meta sends the FICO answer as the option's label, and the label is whatever the
 * marketer typed: "580-639_(poor)", "580 – 639", "720+", "Below 600". All of them
 * carry the same two numbers, so pull the numbers out rather than matching strings.
 *
 * Returns null when there is no number at all — an unparseable answer must not
 * silently become a range of zero, which would match every "under X" filter.
 */
export function parseFicoBand(raw: string | undefined): FicoRange | null {
  if (!raw) return null;

  const text = raw.trim().toLowerCase();
  const numbers = text.match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length === 0) return null;

  if (numbers.length >= 2) {
    const [first, second] = numbers;
    return { min: Math.min(first, second), max: Math.max(first, second) };
  }

  const [only] = numbers;
  // "720+", "over 720", "720 or above" — open at the top.
  if (/\+|over|above|greater|more than|at least/.test(text)) return { min: only };
  // "below 600", "under 600" — open at the bottom, and exclusive of the number.
  if (/below|under|less than|up to|max/.test(text)) return { max: only - 1 };

  return { min: only, max: only };
}

/** "580 – 639", "720+", "Up to 599" — how a band reads on screen. */
export function formatFicoRange(range: FicoRange | null | undefined): string | null {
  if (!range) return null;
  if (range.min !== undefined && range.max !== undefined) {
    return `${range.min} – ${range.max}`;
  }
  if (range.min !== undefined) return `${range.min}+`;
  if (range.max !== undefined) return `Up to ${range.max}`;
  return null;
}

const MULTIPLIERS: Record<string, number> = { k: 1_000, m: 1_000_000 };

/**
 * The requested amount as a number.
 *
 * Handles what the forms actually produce: a free-typed figure ("50,000",
 * "$1,200,000", "250k") from the forms that ask for one, and a band label
 * ("$100k – $250k", "Under $100k", "Over $1M") from the ones that offer a picker.
 *
 * A band collapses to its **lower** bound — the smallest amount the lead is known to
 * want. "Under $100k" therefore parses to 0, not 100,000: the only thing that answer
 * establishes is that they did not commit to any floor, so a "wants at least $250k"
 * filter must not pick them up.
 */
export function parseRequestedAmount(raw: string | undefined): number | null {
  if (!raw) return null;

  const text = raw.trim().toLowerCase();
  if (!text) return null;

  const matches = [...text.matchAll(/(\d[\d,.]*)\s*([km])?/g)];
  const values = matches
    .map((match) => {
      const digits = Number(match[1].replace(/,/g, ""));
      if (!Number.isFinite(digits)) return null;
      const suffix = match[2];
      return suffix ? digits * MULTIPLIERS[suffix] : digits;
    })
    .filter((value): value is number => value !== null);

  if (values.length === 0) return null;
  // "Under $100k" states a ceiling, so the floor it establishes is nothing at all.
  if (/^(under|below|less than|up to)\b/.test(text)) return 0;

  return Math.min(...values);
}

/** Everything the four criteria amount to for one lead, already parsed. */
export interface LeadDeclaredQualification {
  fico: FicoRange | null;
  fundingPurpose?: string;
  requestedAmount: number | null;
  timeFrame?: string;
}

/** Maps a form payload's four answers onto the typed contact fields. */
export function leadQualificationFromAnswers(
  answers: Record<string, string>,
): Partial<Contact> {
  const fico = parseFicoBand(answers.self_reported_fico);
  const amount = parseRequestedAmount(answers.requested_amount);

  const patch: Partial<Contact> = {};
  if (fico?.min !== undefined) patch.leadFicoMin = fico.min;
  if (fico?.max !== undefined) patch.leadFicoMax = fico.max;
  if (answers.funding_purpose) patch.leadFundingPurpose = answers.funding_purpose;
  if (amount !== null) patch.leadRequestedAmount = amount;
  if (answers.funding_timeline) patch.timeFrame = answers.funding_timeline;

  return patch;
}

export function leadDeclaredQualification(contact: Contact): LeadDeclaredQualification {
  const hasFico =
    contact.leadFicoMin !== undefined || contact.leadFicoMax !== undefined;

  return {
    fico: hasFico ? { min: contact.leadFicoMin, max: contact.leadFicoMax } : null,
    fundingPurpose: contact.leadFundingPurpose,
    requestedAmount: contact.leadRequestedAmount ?? null,
    timeFrame: contact.timeFrame,
  };
}

// ── Matching ─────────────────────────────────────────────────────────────────

/** A contact's applications. An array because a contact may have more than one. */
export function applicationsForContact(
  contact: Contact,
  applications: Application[],
): Application[] {
  return contact.linkedApplicationId
    ? applications.filter((a) => a.id === contact.linkedApplicationId)
    : [];
}

type NumericOperator = ">" | "<" | ">=" | "<=" | "=" | "!=";

function compareNumber(
  value: number,
  operator: FilterRule["operator"],
  target: number,
): boolean {
  switch (operator as NumericOperator) {
    case ">":
      return value > target;
    case "<":
      return value < target;
    case ">=":
      return value >= target;
    case "<=":
      return value <= target;
    case "=":
      return value === target;
    case "!=":
      return value !== target;
    default:
      return false;
  }
}

/**
 * Does a *band* satisfy a comparison?
 *
 * A band is a set of possible scores, so the rule is overlap: satisfied when some
 * score inside the band satisfies it. "FICO under 640" catches a 600–639 lead and a
 * 580–649 one; it does not catch a 720+ one. Collapsing the band to one number
 * first — its midpoint, say — would drop the second of those three, silently.
 */
function rangeSatisfies(
  range: FicoRange,
  operator: FilterRule["operator"],
  target: number,
): boolean {
  const min = range.min ?? Number.NEGATIVE_INFINITY;
  const max = range.max ?? Number.POSITIVE_INFINITY;

  switch (operator as NumericOperator) {
    case ">":
      return max > target;
    case ">=":
      return max >= target;
    case "<":
      return min < target;
    case "<=":
      return min <= target;
    case "=":
      return min <= target && target <= max;
    case "!=":
      return !(min === target && max === target);
    default:
      return false;
  }
}

function textSatisfies(
  value: string | undefined,
  operator: FilterRule["operator"],
  target: string,
): boolean {
  if (value === undefined || value === "") return false;
  const left = value.toLowerCase();
  const right = target.trim().toLowerCase();

  switch (operator) {
    case "=":
      return left === right;
    case "!=":
      return left !== right;
    case "contains":
      return left.includes(right);
    case "not_contains":
      return !left.includes(right);
    default:
      return false;
  }
}

/**
 * One qualification rule, matched against every source the contact has.
 *
 * OR, not first-one-wins. A contact can hold several applications plus their own
 * ad-declared answer, and the question a segment asks is "does any of this qualify
 * them" — so picking a single source would make the result depend on which
 * application happened to be first in the array. Two applications, FICO 600 and 700,
 * must both be able to satisfy their own rule.
 */
export function matchesQualificationRule(
  contact: Contact,
  applications: Application[],
  rule: FilterRule,
): boolean {
  const owned = applicationsForContact(contact, applications);
  const lead = leadDeclaredQualification(contact);

  switch (rule.field as QualificationField) {
    case "self_reported_fico": {
      const target = Number(rule.value);
      if (!Number.isFinite(target)) return false;

      const fromApplications = owned.some((application) => {
        const range: FicoRange = {
          min: application.selfReportedFicoMin,
          max: application.selfReportedFicoMax,
        };
        if (range.min === undefined && range.max === undefined) return false;
        return rangeSatisfies(range, rule.operator, target);
      });

      const fromLead = lead.fico
        ? rangeSatisfies(lead.fico, rule.operator, target)
        : false;

      return fromApplications || fromLead;
    }

    case "requested_amount": {
      const target = Number(rule.value);
      if (!Number.isFinite(target)) return false;

      const fromApplications = owned.some(
        (application) =>
          application.requestedAmount !== undefined &&
          compareNumber(application.requestedAmount, rule.operator, target),
      );
      const fromLead =
        lead.requestedAmount !== null &&
        compareNumber(lead.requestedAmount, rule.operator, target);

      return fromApplications || fromLead;
    }

    case "funding_purpose": {
      const fromApplications = owned.some((application) =>
        textSatisfies(application.fundingPurpose, rule.operator, rule.value),
      );
      return fromApplications || textSatisfies(lead.fundingPurpose, rule.operator, rule.value);
    }

    case "funding_timeline": {
      const fromApplications = owned.some((application) =>
        textSatisfies(application.timeFrame, rule.operator, rule.value),
      );
      return fromApplications || textSatisfies(lead.timeFrame, rule.operator, rule.value);
    }

    default:
      return false;
  }
}

// ── Display ──────────────────────────────────────────────────────────────────

/** Where a displayed value came from — worth saying out loud on screen. */
export type QualificationSource = "application" | "lead";

export interface DisplayedQualification {
  fico: FicoRange | null;
  ficoSource?: QualificationSource;
  fundingPurpose?: string;
  fundingPurposeSource?: QualificationSource;
  requestedAmount: number | null;
  requestedAmountSource?: QualificationSource;
  timeFrame?: string;
  timeFrameSource?: QualificationSource;
}

/**
 * What to show, as opposed to what to match.
 *
 * Precedence, not OR: the newest application that actually carries a value wins,
 * and the lead's own claim fills the gap. Resolved per field rather than per record
 * because an application can be missing one of the four, and falling back to the
 * lead's answer for that one field beats showing a blank next to three filled rows.
 */
export function displayedQualification(
  contact: Contact,
  applications: Application[],
): DisplayedQualification {
  const newestFirst = applicationsForContact(contact, applications).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const lead = leadDeclaredQualification(contact);

  const applicationFico = newestFirst.find(
    (a) => a.selfReportedFicoMin !== undefined || a.selfReportedFicoMax !== undefined,
  );
  const applicationPurpose = newestFirst.find((a) => a.fundingPurpose);
  const applicationAmount = newestFirst.find((a) => a.requestedAmount !== undefined);
  const applicationTimeFrame = newestFirst.find((a) => a.timeFrame);

  return {
    fico: applicationFico
      ? {
          min: applicationFico.selfReportedFicoMin,
          max: applicationFico.selfReportedFicoMax,
        }
      : lead.fico,
    ficoSource: applicationFico ? "application" : lead.fico ? "lead" : undefined,

    fundingPurpose: applicationPurpose?.fundingPurpose ?? lead.fundingPurpose,
    fundingPurposeSource: applicationPurpose
      ? "application"
      : lead.fundingPurpose
        ? "lead"
        : undefined,

    requestedAmount: applicationAmount?.requestedAmount ?? lead.requestedAmount,
    requestedAmountSource: applicationAmount
      ? "application"
      : lead.requestedAmount !== null
        ? "lead"
        : undefined,

    timeFrame: applicationTimeFrame?.timeFrame ?? lead.timeFrame,
    timeFrameSource: applicationTimeFrame
      ? "application"
      : lead.timeFrame
        ? "lead"
        : undefined,
  };
}
