import type { Campaign, CampaignExternalRef, Contact } from "../types";
import { attributionPathNodes } from "./attributionTaxonomy";

/**
 * Which campaign a contact belongs to.
 *
 * `contact.campaignId` is authoritative. Seeded contacts predate the campaigns
 * object, so we fall back to the campaign-kind node on their taxonomy path —
 * campaign ids were chosen to match those node ids.
 */
export function resolveCampaignId(contact: Contact): string | null {
  if (contact.campaignId) return contact.campaignId;
  if (!contact.attributionNodeId) return null;

  const campaignNode = attributionPathNodes(contact.attributionNodeId).find(
    (node) => node.kind === "campaign",
  );
  return campaignNode?.id ?? null;
}

export function resolveCampaign(
  contact: Contact,
  campaigns: Campaign[],
): Campaign | undefined {
  const id = resolveCampaignId(contact);
  return id ? campaigns.find((c) => c.id === id) : undefined;
}

export function contactsInCampaign(
  campaignId: string,
  contacts: Contact[],
): Contact[] {
  return contacts.filter((c) => resolveCampaignId(c) === campaignId);
}

/** Normalises a campaign name into a usable web campaign key. */
export function toUtmKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Find the campaign that owns a platform-side id.
 *
 * The id is the key, never the name: marketers rename campaigns inside Ads Manager
 * whenever they feel like it, and eight of LoanBud's Meta campaigns share the
 * "Epsilon" prefix, so a name match would either miss or over-match.
 *
 * The web is a platform like any other — a landing page's `utm_campaign` value is
 * stored as a `web` ref rather than as its own column on the campaign. One lookup
 * serves every channel, and an auto-created Meta campaign no longer has to invent a
 * utm key it will never be matched on.
 */
export function findCampaignByExternalId(
  campaigns: Campaign[],
  platform: string,
  externalId: string,
): Campaign | undefined {
  const id = externalId.trim().toLowerCase();
  if (!id) return undefined;

  return campaigns.find((campaign) =>
    campaign.externalRefs?.some(
      (ref) => ref.platform === platform && ref.externalId.toLowerCase() === id,
    ),
  );
}

/** The `utm_campaign` value a landing page must carry to attribute here, if any. */
export function webCampaignKey(campaign: Campaign): string | undefined {
  return campaign.externalRefs?.find((ref) => ref.platform === "web")?.externalId;
}

/** Replaces the campaign's web ref, dropping it when the key is blank. */
export function withWebCampaignKey(
  refs: CampaignExternalRef[] | undefined,
  key: string,
): CampaignExternalRef[] | undefined {
  const others = (refs ?? []).filter((ref) => ref.platform !== "web");
  const trimmed = key.trim();
  const next = trimmed
    ? [...others, { platform: "web", externalId: trimmed, externalName: `utm_campaign=${trimmed}` }]
    : others;
  return next.length > 0 ? next : undefined;
}
