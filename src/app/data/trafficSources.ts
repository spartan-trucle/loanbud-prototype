import type { Contact, TrafficSourceId } from "../types";
import { attributionPathNodes } from "./attributionTaxonomy";

/**
 * Flat attribution model (the decided design): a **closed** set of traffic sources
 * owned by code — never user-editable — plus two free-text drill-downs, plus a
 * campaign that lives in its own object rather than as a level of a tree.
 *
 * This mirrors HubSpot: Original Traffic Source + Drill-down 1/2, with Campaigns
 * managed separately. The older `attribution_nodes` tree is kept only as the seed
 * source below — a contact's L1 node IS its traffic source, its L2/L3 nodes are the
 * drill-downs — so no seed JSON had to be rewritten.
 */
export const TRAFFIC_SOURCES: { id: TrafficSourceId; label: string; tone: string }[] = [
  { id: "referrals", label: "Referrals", tone: "bg-violet-50 text-violet-700 border-violet-200" },
  { id: "offline-sources", label: "Offline sources", tone: "bg-stone-50 text-stone-700 border-stone-200" },
  { id: "paid-social", label: "Paid social", tone: "bg-rose-50 text-rose-700 border-rose-200" },
  { id: "paid-search", label: "Paid search", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "email-marketing", label: "Email marketing", tone: "bg-sky-50 text-sky-700 border-sky-200" },
];

const BY_ID = new Map(TRAFFIC_SOURCES.map((s) => [s.id, s]));

export function trafficSourceLabel(id: TrafficSourceId | null | undefined): string {
  return id ? (BY_ID.get(id)?.label ?? id) : "Unknown";
}

export function trafficSourceTone(id: TrafficSourceId | null | undefined): string {
  return (id && BY_ID.get(id)?.tone) || "bg-muted text-muted-foreground border-border";
}

export interface ResolvedAttribution {
  trafficSource: TrafficSourceId | null;
  /** UTM-ish drill-down (e.g. "Meta Ads", "Google"). */
  detail1: string | null;
  /** Second drill-down (e.g. ad set, keyword, specific email). */
  detail2: string | null;
}

/**
 * A contact's flat attribution. Explicit fields win; otherwise it falls back to the
 * legacy taxonomy path so seeded contacts display correctly without a data rewrite.
 */
export function resolveAttribution(contact: Contact): ResolvedAttribution {
  if (contact.originalTrafficSource) {
    return {
      trafficSource: contact.originalTrafficSource,
      detail1: contact.sourceDetail1 ?? null,
      detail2: contact.sourceDetail2 ?? null,
    };
  }

  if (!contact.attributionNodeId) {
    return { trafficSource: null, detail1: null, detail2: null };
  }

  const path = attributionPathNodes(contact.attributionNodeId);
  const root = path[0];
  const source = root && BY_ID.has(root.id as TrafficSourceId)
    ? (root.id as TrafficSourceId)
    : null;

  return {
    trafficSource: source,
    detail1: path[1]?.name ?? null,
    detail2: path[2]?.name ?? null,
  };
}

const PAID_SOCIAL_PLATFORMS = ["facebook", "instagram", "meta", "linkedin", "tiktok"];
const PAID_MEDIUMS = ["cpc", "ppc", "paid", "paidsearch", "paid_search"];

/**
 * UTM → traffic source. This mapping is code-owned on purpose: it is the rule that
 * keeps the source list closed, so no one can invent a new "source" from a form.
 * Everything a marketer *does* control lives in the campaign, not here.
 */
export function trafficSourceFromUtm(
  utmSource?: string,
  utmMedium?: string,
): TrafficSourceId {
  const source = (utmSource ?? "").trim().toLowerCase();
  const medium = (utmMedium ?? "").trim().toLowerCase();

  if (medium.includes("email") || source.includes("newsletter")) return "email-marketing";
  if (medium === "paid_social" || medium === "paidsocial") return "paid-social";
  if (PAID_MEDIUMS.includes(medium)) {
    return PAID_SOCIAL_PLATFORMS.some((p) => source.includes(p))
      ? "paid-social"
      : "paid-search";
  }
  if (medium === "referral" || medium === "partner") return "referrals";

  // Everything else — no UTM at all, organic, social, direct — is untracked until
  // website analytics is connected, so it lands in Offline sources rather than
  // guessing at a channel we cannot actually observe.
  return "offline-sources";
}

/** "Paid social · Meta Ads · Business Owners video" — one-line summary for tooltips. */
export function attributionSummary(contact: Contact): string {
  const { trafficSource, detail1, detail2 } = resolveAttribution(contact);
  return [trafficSourceLabel(trafficSource), detail1, detail2]
    .filter(Boolean)
    .join(" · ");
}
