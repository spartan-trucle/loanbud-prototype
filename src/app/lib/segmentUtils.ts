import type { Application, Contact, ContactLeadAnswer, FilterRule, Listing, Segment } from "../types";
import { answerValue } from "../data/contactLeadAnswers";
import {
  isQualificationField,
  matchesQualificationRule,
} from "../data/leadQualification";

// ── Segment / listing helpers ─────────────────────────────────────────────────

const LISTING_FIELDS = new Set<FilterRule["field"]>(["listingStatus", "listingName"]);

/**
 * Pure boolean chain evaluator — mirrors the original matchContact logic.
 *
 * The four underwriting criteria cannot be answered from the flat string record:
 * each has two possible sources and a numeric comparison, so they are delegated to
 * `matchesQualificationRule`. Everything else reads a field off the record as before.
 */
export function evaluateFilterChain(
  filters: FilterRule[],
  record: Record<string, string>,
  qualification?: {
    contact: Contact;
    applications: Application[];
    leadAnswers: ContactLeadAnswer[];
  },
): boolean {
  if (filters.length === 0) return true;

  const evalOne = (f: FilterRule): boolean => {
    if (isQualificationField(f.field)) {
      return qualification
        ? matchesQualificationRule(
            qualification.contact,
            qualification.applications,
            f,
          )
        : false;
    }

    // A lead-answer's target key is its filter id. The record is checked first so an
    // answer key can never shadow a real column.
    const raw =
      record[f.field] ??
      (qualification
        ? answerValue(qualification.contact.id, f.field, qualification.leadAnswers)
        : undefined) ??
      "";
    const val = String(raw);

    switch (f.operator) {
      case "=":
        return val === f.value;
      case "!=":
        return val !== f.value;
      case "contains":
        return val.toLowerCase().includes(f.value.toLowerCase());
      case "not_contains":
        return !val.toLowerCase().includes(f.value.toLowerCase());
      case ">":
      case "<":
      case ">=":
      case "<=": {
        const left = Number(val);
        const right = Number(f.value);
        if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
        if (f.operator === ">") return left > right;
        if (f.operator === "<") return left < right;
        if (f.operator === ">=") return left >= right;
        return left <= right;
      }
      case "before":
      case "after": {
        const left = new Date(val).getTime();
        const right = new Date(f.value).getTime();
        if (Number.isNaN(left) || Number.isNaN(right)) return false;
        return f.operator === "before" ? left < right : left > right;
      }
      default:
        return false;
    }
  };
  let result = evalOne(filters[0]);
  for (let i = 1; i < filters.length; i++) {
    const next = evalOne(filters[i]);
    result = filters[i - 1].logic === "and" ? result && next : result || next;
  }
  return result;
}

/**
 * Returns the subset of a contact's listings that satisfy the segment filters.
 * - If no listing-field filters exist: returns all listings if the contact matches (1 enrollment per contact).
 * - If listing-field filters exist: returns only the listings where the filter passes (1 enrollment per matching listing).
 * - Returns [] when the contact does not match at all.
 */
export function getMatchedListings(
  contact: Contact,
  filters: FilterRule[],
  applications: Application[] = [],
  leadAnswers: ContactLeadAnswer[] = [],
): Listing[] {
  const allListings: Listing[] = contact.listings?.length
    ? contact.listings
    : [{ id: `${contact.id}-primary`, name: contact.listingName, status: contact.listingStatus }];

  if (filters.length === 0) return allListings;

  const hasListingFilter = filters.some((f) => LISTING_FIELDS.has(f.field));

  if (!hasListingFilter) {
    // Non-listing segment: one enrollment per contact regardless of listing count
    const contactRecord = contact as unknown as Record<string, string>;
    return evaluateFilterChain(filters, contactRecord, { contact, applications, leadAnswers })
      ? allListings
      : [];
  }

  // Listing-filtered segment: evaluate each listing independently
  return allListings.filter((listing) => {
    const merged: Record<string, string> = {
      ...(contact as unknown as Record<string, string>),
      listingStatus: listing.status,
      listingName: listing.name,
    };
    return evaluateFilterChain(filters, merged, { contact, applications, leadAnswers });
  });
}

/**
 * Returns all Active segments that the given contact belongs to.
 * Matching rules (in order):
 * 1. Explicit exclude — contact is in `excludedContactIds` → excluded.
 * 2. Explicit include — contact is in `includedContactIds` → included.
 * 3. Filter-based — contact matches `segment.filters` via `getMatchedListings`
 *    AND does NOT match `segment.excludeFilters` (when present).
 */
export function getContactSegments(
  contact: Contact,
  segments: Segment[],
  applications: Application[] = [],
): Segment[] {
  return segments.filter((segment) => {
    if (segment.status !== "Active") return false;
    if (segment.excludedContactIds?.includes(contact.id)) return false;
    if (segment.includedContactIds?.includes(contact.id)) return true;
    const matched = getMatchedListings(contact, segment.filters, applications).length > 0;
    if (!matched) return false;
    if (segment.excludeFilters && segment.excludeFilters.length > 0) {
      const excluded =
        getMatchedListings(contact, segment.excludeFilters, applications).length > 0;
      if (excluded) return false;
    }
    return true;
  });
}
