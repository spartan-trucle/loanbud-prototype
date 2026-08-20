import type { MetaLeadPayload, MetaPlatform } from "../types";

/**
 * The Meta Lead Ads adapter.
 *
 * Instant Forms open *inside* Facebook or Instagram — the lead never visits a URL we
 * control, so there is no `utm_*` to read. Meta hands us ids instead: form, campaign,
 * ad set, ad, plus the platform the impression was served on. Every attribution
 * decision below is derived from those ids, which is why this lives beside
 * `trafficSourceFromUtm()` rather than inside it: one platform, one adapter.
 *
 * Pure functions only — the CRM's ingest handler applies the results.
 */

/** One Instant Form in the connected Meta account. */
export interface MetaLeadForm {
  id: string;
  name: string;
  /** The campaign this form usually runs under — prefills the demo screen. */
  defaultCampaignId?: string;
  defaultCampaignName?: string;
  defaultAdsetId?: string;
  defaultAdsetName?: string;
  defaultAdId?: string;
  defaultAdName?: string;
}

/**
 * Forms as they read in LoanBud's Meta account. Ids match the `externalRef` of the
 * LeadFormDefinitions the CRM holds, so an ingested lead lands on a known form.
 *
 * V2 and V3 are the two live forms whose volumes diverge so sharply — V2 pulls
 * roughly twice the leads and a fraction of the qualified ones.
 */
export const META_LEAD_FORMS: MetaLeadForm[] = [
  {
    id: "1204487339112045",
    name: "Lead Form_Rich Creative_2026_V2",
    defaultCampaignId: "23851004417650137",
    defaultCampaignName: "Epsilon | Lead form V2",
    defaultAdsetId: "23851004417660211",
    defaultAdsetName: "BO 25-54 US — broad",
    defaultAdId: "23851004417670318",
    defaultAdName: "video_testimonial_v2",
  },
  {
    id: "1204487339112046",
    name: "Lead Form_More Volume_2026_V3",
    defaultCampaignId: "23851004417650138",
    defaultCampaignName: "Epsilon | Lead form V3",
    defaultAdsetId: "23851004417660212",
    defaultAdsetName: "BO 25-54 US — FICO prequalified",
    defaultAdId: "23851004417670319",
    defaultAdName: "carousel_prequal_v1",
  },
  {
    id: "1204487339112047",
    name: "2026 FastTrack Form",
    defaultCampaignId: "23851004418220441",
    defaultCampaignName: "Summer SBA | Retargeting | Search visitors",
    defaultAdsetId: "23851004418230118",
    defaultAdsetName: "Search visitors 30d",
    defaultAdId: "23851004418240226",
    defaultAdName: "static_acquisition_terms",
  },
];

export const META_PLATFORMS: { id: MetaPlatform; label: string }[] = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
];

export function metaFormById(id: string): MetaLeadForm | undefined {
  return META_LEAD_FORMS.find((form) => form.id === id);
}

export function metaPlatformLabel(platform: MetaPlatform): string {
  return platform === "instagram" ? "Instagram" : "Facebook";
}

/** How the CRM classified a Meta lead, and the one-line reason for each decision. */
export interface MetaAttribution {
  leadSource: string;
  /** Which platform served the impression — "Facebook" or "Instagram". */
  detail1: string;
  /** The Instant Form's name; falls back to its id when Meta sends no name. */
  detail2: string;
  /** Why the traffic source came out the way it did — shown in the result panel. */
  leadSourceReason: string;
}

/**
 * Traffic source for a Meta lead.
 *
 * Paid impressions are `paid-social`. Organic ones — a form opened from an unpaid
 * page post — land in `offline-sources`, not because that describes them well, but
 * because "Organic social" is not in the closed traffic-source enum: it needs website
 * analytics the CRM does not have connected. Adding it back is an enum change, not
 * something this adapter is allowed to invent.
 */
export function metaLeadAttribution(payload: MetaLeadPayload): MetaAttribution {
  const platformLabel = metaPlatformLabel(payload.platform);
  const formName = payload.formName.trim() || payload.formId;

  return {
    leadSource: payload.isOrganic ? "organic_web" : "meta_lead_form",
    detail1: platformLabel,
    detail2: formName,
    leadSourceReason: payload.isOrganic
      ? "is_organic = true, and Organic social is not in the traffic-source enum — it needs website analytics that is not connected, so the lead lands in Offline sources"
      : `Paid ${platformLabel} impression — every Lead Ads submission with is_organic = false is paid social`,
  };
}

/** Lead source recorded on the contact — where the record came from, in one string. */
export function metaLeadSource(payload: MetaLeadPayload): string {
  return `meta_lead_ads:${payload.formId}`;
}
