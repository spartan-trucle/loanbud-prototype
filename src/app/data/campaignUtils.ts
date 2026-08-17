import type { Campaign, Contact } from "../types";
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

/** Normalises a campaign name into a usable utm_campaign key. */
export function toUtmKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
