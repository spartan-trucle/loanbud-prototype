import type { Contact } from "../types";

/**
 * Contacts that share a phone number with another contact.
 *
 * Email is the only key used when a lead arrives, deliberately: a phone number is
 * routinely shared by a couple, a household, or a business line, so matching on it
 * risks attaching a lead to the wrong person. The price of that safety is that one
 * person using two email addresses becomes two contacts.
 *
 * This finds those afterwards rather than guessing at ingest — the same shape as
 * HubSpot's duplicate management: surfaced for a human to look at, never merged
 * automatically.
 */
export function contactsSharingPhone(contacts: Contact[]): Set<string> {
  const byPhone = new Map<string, string[]>();
  for (const c of contacts) {
    const key = normalisePhone(c.phone);
    if (!key) continue;
    byPhone.set(key, [...(byPhone.get(key) ?? []), c.id]);
  }
  const shared = new Set<string>();
  for (const ids of byPhone.values()) {
    if (ids.length > 1) ids.forEach((id) => shared.add(id));
  }
  return shared;
}

/** Formatting varies by whoever typed it; the digits are what identify the line. */
function normalisePhone(phone: string | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-10) : null;
}
