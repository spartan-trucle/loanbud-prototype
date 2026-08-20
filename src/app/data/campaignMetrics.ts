import type {
  ContactLeadAnswer,
  Application,
  Campaign,
  CampaignExternalRef,
  Contact,
  CustomFieldDefinition,
} from "../types";
import { answerValue } from "./contactLeadAnswers";
import { contactsInCampaign } from "./campaignUtils";

/**
 * Campaign performance maths — pure functions only, no components, so both
 * CampaignList and CampaignDetail can import from here without tripping the repo's
 * react-refresh rule.
 *
 * Scope note: there is no cost or ROI maths here on purpose. The ask is to trace
 * which campaign a lead came from and how far it got — Leads → Applications →
 * Funded. `Campaign.spend` is deprecated and deliberately unread.
 */

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const PERCENT = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0,
});

/** "$680,000" — used for loan volume, which is an outcome, not a cost. */
export function formatCurrency(value: number): string {
  return USD.format(value);
}

/** `0.32` → "32%". */
export function formatPercent(ratio: number): string {
  return PERCENT.format(ratio);
}

/** Funded is a stage, not a separate flag — one source of truth. */
export function isFundedApplication(application: Application): boolean {
  return application.stage === "Funded";
}

export interface CampaignFunnel {
  campaignId: string;
  leads: number;
  applications: number;
  funded: number;
  /** Total loan amount of the funded applications. */
  fundedAmount: number;
  /** Step conversion rates; undefined when the previous step is empty. */
  leadToApplication?: number;
  applicationToFunded?: number;
  leadToFunded?: number;
}

function rate(numerator: number, denominator: number): number | undefined {
  return denominator > 0 ? numerator / denominator : undefined;
}

/**
 * The funnel for one campaign: Leads → Applications → Funded.
 *
 * Applications are reached through `contact.linkedApplicationId`, so an application
 * only counts for a campaign when a contact attributed to that campaign points at it.
 */
export function campaignFunnel(
  campaign: Campaign,
  contacts: Contact[],
  applications: Application[],
): CampaignFunnel {
  return funnelFromMembers(
    campaign.id,
    contactsInCampaign(campaign.id, contacts),
    applications,
  );
}

/** Same maths when the caller already has the campaign's contacts in hand. */
export function funnelFromMembers(
  campaignId: string,
  members: Contact[],
  applications: Application[],
): CampaignFunnel {
  const byId = new Map(applications.map((a) => [a.id, a]));

  const linked: Application[] = [];
  for (const contact of members) {
    const application = contact.linkedApplicationId
      ? byId.get(contact.linkedApplicationId)
      : undefined;
    if (application) linked.push(application);
  }

  const fundedApps = linked.filter(isFundedApplication);
  const leads = members.length;
  const applicationCount = linked.length;
  const funded = fundedApps.length;

  return {
    campaignId,
    leads,
    applications: applicationCount,
    funded,
    fundedAmount: fundedApps.reduce((sum, a) => sum + a.loanAmount, 0),
    leadToApplication: rate(applicationCount, leads),
    applicationToFunded: rate(funded, applicationCount),
    leadToFunded: rate(funded, leads),
  };
}

/** Roll-up across campaigns — the same funnel, summed. */
export function totalsAcrossCampaigns(funnels: CampaignFunnel[]): CampaignFunnel {
  const leads = funnels.reduce((sum, f) => sum + f.leads, 0);
  const applications = funnels.reduce((sum, f) => sum + f.applications, 0);
  const funded = funnels.reduce((sum, f) => sum + f.funded, 0);

  return {
    campaignId: "__totals__",
    leads,
    applications,
    funded,
    fundedAmount: funnels.reduce((sum, f) => sum + f.fundedAmount, 0),
    leadToApplication: rate(applications, leads),
    applicationToFunded: rate(funded, applications),
    leadToFunded: rate(funded, leads),
  };
}

/**
 * Default ordering: most funded loans first, then most applications.
 *
 * Funded is the outcome the campaign is judged on; applications break the tie among
 * the many campaigns that have funded nothing yet, because an application in flight
 * is the nearest thing to evidence they will. Lead count breaks nothing — a campaign
 * does not rank higher for producing more leads that went nowhere.
 */
export function compareByOutcome(a: CampaignFunnel, b: CampaignFunnel): number {
  return b.funded - a.funded || b.applications - a.applications;
}

/** One bucket of answers to a questionnaire field. */
export interface QualityBucket {
  value: string;
  count: number;
  /** Share of the contacts that answered this field. */
  share: number;
}

export interface QualityBreakdown {
  key: string;
  label: string;
  /** How many of the campaign's contacts answered. */
  answered: number;
  /** How many did not — a lead that told us nothing is its own quality signal. */
  unanswered: number;
  buckets: QualityBucket[];
}

/**
 * Answer distribution per visible questionnaire field, for one campaign's contacts.
 *
 * Only `select` fields are summarised: their options are a closed list, so the
 * buckets mean something. Free-text fields would produce one bucket per lead.
 * Fields nobody answered are dropped rather than shown as an empty chart.
 *
 * Buckets follow the definition's declared option order — FICO bands read worst to
 * best, which is what makes a bottom-heavy campaign obvious at a glance.
 */
export function leadQualityBreakdown(
  members: Contact[],
  definitions: CustomFieldDefinition[],
  leadAnswers: ContactLeadAnswer[],
): QualityBreakdown[] {
  const breakdowns: QualityBreakdown[] = [];

  for (const definition of definitions) {
    if (!definition.isVisible || definition.type !== "select") continue;

    const counts = new Map<string, number>();
    let answered = 0;
    for (const contact of members) {
      const value = answerValue(contact.id, definition.key, leadAnswers);
      if (!value) continue;
      answered += 1;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    if (answered === 0) continue;

    // Declared options first, in order; anything else a form sent lands after them.
    const known = definition.options ?? [];
    const extras = [...counts.keys()].filter((v) => !known.includes(v)).sort();
    const buckets = [...known, ...extras]
      .filter((value) => counts.has(value))
      .map((value) => ({
        value,
        count: counts.get(value) ?? 0,
        share: (counts.get(value) ?? 0) / answered,
      }));

    breakdowns.push({
      key: definition.key,
      label: definition.label,
      answered,
      unanswered: members.length - answered,
      buckets,
    });
  }

  return breakdowns;
}

/** External campaigns grouped by platform, so one row per ad account. */
export interface PlatformSplit {
  platform: string;
  label: string;
  refs: CampaignExternalRef[];
}

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  tiktok: "TikTok Ads",
  linkedin: "LinkedIn Ads",
  bing: "Bing Ads",
  bizbuysell: "BizBuySell",
};

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

export function platformSplit(campaign: Campaign): PlatformSplit[] {
  const groups = new Map<string, CampaignExternalRef[]>();
  for (const ref of campaign.externalRefs ?? []) {
    const existing = groups.get(ref.platform);
    if (existing) existing.push(ref);
    else groups.set(ref.platform, [ref]);
  }

  return [...groups.entries()]
    .map(([platform, refs]) => ({ platform, label: platformLabel(platform), refs }))
    .sort((a, b) => b.refs.length - a.refs.length || a.label.localeCompare(b.label));
}
