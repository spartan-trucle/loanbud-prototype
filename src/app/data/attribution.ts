import type { Contact } from "@/app/types";

/**
 * Contact attribution — RFC-013 rev 19.
 *
 * Two fields the CRM already has, and no new ones. Six were proposed during review
 * (`acquisitionOrigin`, `marketingPlatform`, `sourceOrganizationId`, `intakeMethod`,
 * `leadFormId`, `leadAnswersAt`) and every one turned out to be already covered or
 * built for a case this flow never produces:
 *
 * - `attributionSource` — which system created the record. Write-once: the backend's
 *   `ContactRepository.update` has no parameter for it at all, so there is no
 *   overwrite path to guard.
 * - `leadSource` — which channel produced the lead. **First touch wins**: a contact
 *   who first arrived through BizBuySell keeps that origin even after filling in a
 *   Facebook form. The backend guards this in the manager and again in SQL.
 *
 * Channel rollups ("what share came from paid advertising") are an `IN (...)` over
 * the LEAD_SOURCES vocabulary rather than a column, which is only safe while the
 * vocabulary stays disciplined — `lead_source` is free text with no constraint.
 */

export interface LeadSourceOption {
  id: string;
  label: string;
  /** Rollup used for "paid vs organic" reporting. */
  channel: "paid" | "referral" | "organic" | "direct";
  tone: string;
}

export const LEAD_SOURCES: LeadSourceOption[] = [
  {
    id: "meta_lead_form",
    label: "Meta lead form",
    channel: "paid",
    tone: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    id: "google_ads",
    label: "Google Ads",
    channel: "paid",
    tone: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    id: "bizbuysell_checkbox",
    label: "BizBuySell",
    channel: "referral",
    tone: "bg-violet-50 text-violet-700 border-violet-200",
  },
  {
    id: "partner_referral",
    label: "Partner referral",
    channel: "referral",
    tone: "bg-violet-50 text-violet-700 border-violet-200",
  },
  {
    id: "organic_web",
    label: "Organic web",
    channel: "organic",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    id: "direct",
    label: "Direct",
    channel: "direct",
    tone: "bg-slate-50 text-slate-700 border-slate-200",
  },
];

const BY_ID = new Map(LEAD_SOURCES.map((s) => [s.id, s]));

export function leadSourceOption(id: string | null | undefined): LeadSourceOption | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Falls back to the raw stored value: `lead_source` is free text, so unknown values are real. */
export function leadSourceLabel(id: string | null | undefined): string {
  if (!id) return "Not recorded";
  return BY_ID.get(id)?.label ?? id;
}

export function leadSourceTone(id: string | null | undefined): string {
  return BY_ID.get(id ?? "")?.tone ?? "bg-slate-50 text-slate-600 border-slate-200";
}

/** The rollup a "% from paid advertising" report groups by. */
export function leadSourceChannel(id: string | null | undefined): LeadSourceOption["channel"] | undefined {
  return BY_ID.get(id ?? "")?.channel;
}

export function isPaidLeadSource(id: string | null | undefined): boolean {
  return leadSourceChannel(id) === "paid";
}

/** One line for a list row or a tooltip. */
export function attributionSummary(contact: Contact): string {
  const source = leadSourceLabel(contact.leadSource);
  return contact.attributionSource ? `${source} · via ${contact.attributionSource}` : source;
}

/**
 * First touch wins.
 *
 * Returns the value to store, which is the existing one whenever a contact already
 * has an origin. This mirrors the backend guard exactly — and getting it wrong is
 * the one attribution regression this design can still have, because it silently
 * rewrites where an existing lead came from.
 */
export function resolveLeadSource(
  existing: string | null | undefined,
  incoming: string,
): string {
  return existing && existing.trim() !== "" ? existing : incoming;
}

/** Which lead source a web submission's UTM parameters imply. */
export function leadSourceFromUtm(utmSource?: string, utmMedium?: string): string {
  const source = utmSource?.trim().toLowerCase() ?? "";
  const medium = utmMedium?.trim().toLowerCase() ?? "";

  if (source.includes("facebook") || source.includes("meta") || source.includes("instagram")) {
    return "meta_lead_form";
  }
  if (source.includes("google")) {
    return medium.includes("cpc") || medium.includes("paid") ? "google_ads" : "organic_web";
  }
  if (medium.includes("referral")) return "partner_referral";
  if (medium.includes("organic") || source) return "organic_web";
  return "direct";
}
