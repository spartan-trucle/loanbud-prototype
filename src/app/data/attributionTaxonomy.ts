import type { AttributionNode } from "../types";

/**
 * V2 (RFC-009): Attribution Source Hierarchy — the "lead source pyramid",
 * modelled on HubSpot's 10 contact traffic sources (the taxonomy marketing uses today).
 *
 * Source (L1) > Drill-down 1 (L2) > Drill-down 2 (L3) [> Ad Set (L4) > Creative (L5)].
 * The 10 L1 sources match HubSpot exactly. The "ready now" sources — Email marketing,
 * Referrals, Direct traffic, Offline sources — carry the CRM's existing leads; the
 * web-tracked sources (Organic/Paid Search & Social, AI Referrals, Other campaigns)
 * fill in as ad accounts + website tracking connect. The Meta Ads subtree under
 * Paid social is a Phase-2 preview: nodes auto-created from live UTM data
 * (`isAutoCreated`) — campaigns/ad sets/creatives appear by themselves as leads arrive.
 *
 * Static reference data — in the real system this is the `attribution_nodes` table,
 * editable as data without code changes.
 */
export const ATTRIBUTION_NODES: AttributionNode[] = [
  // ---- L1: HubSpot's 10 contact traffic sources (channels) ----
  { id: "paid-search", parentId: null, level: 1, kind: "channel", name: "Paid search" },
  { id: "email-marketing", parentId: null, level: 1, kind: "channel", name: "Email marketing" },
  { id: "referrals", parentId: null, level: 1, kind: "channel", name: "Referrals" },
  { id: "paid-social", parentId: null, level: 1, kind: "channel", name: "Paid social" },
  { id: "offline-sources", parentId: null, level: 1, kind: "channel", name: "Offline sources" },

  // ==== READY NOW — sources the CRM already carries ==============================

  // Referrals — external sites & partners (BizBuySell lives here)
  { id: "bizbuysell", parentId: "referrals", level: 2, kind: "platform", name: "BizBuySell" },
  { id: "bbs-api-leads", parentId: "bizbuysell", level: 3, kind: "campaign", name: "API leads" },
  { id: "bbs-checkbox-leads", parentId: "bizbuysell", level: 3, kind: "campaign", name: "Checkbox leads" },
  { id: "transworld", parentId: "referrals", level: 2, kind: "platform", name: "Transworld Business Advisors" },
  { id: "referral-partners", parentId: "referrals", level: 2, kind: "platform", name: "Referral partners" },

  // Email marketing — campaign (drill-down 1) > specific email (drill-down 2)
  { id: "em-monthly-newsletter", parentId: "email-marketing", level: 2, kind: "campaign", name: "Monthly newsletter", userDefined: true },
  { id: "em-nl-march", parentId: "em-monthly-newsletter", level: 3, kind: "creative", name: "March newsletter", userDefined: true },
  { id: "em-rate-drop", parentId: "email-marketing", level: 2, kind: "campaign", name: "Rate-drop announcement", userDefined: true },

  // Direct traffic — entrance page (drill-down 1)

  // Offline sources — imports / API / manual / phone / events / website form fills
  { id: "off-loanbud-io", parentId: "offline-sources", level: 2, kind: "platform", name: "loanbud.io form" },
  { id: "off-loanbud-hub", parentId: "offline-sources", level: 2, kind: "platform", name: "LoanBud Hub form" },
  { id: "off-wordpress", parentId: "offline-sources", level: 2, kind: "platform", name: "WordPress form" },
  { id: "off-manual", parentId: "offline-sources", level: 2, kind: "platform", name: "Manual CRM entry" },
  { id: "off-cold-call", parentId: "offline-sources", level: 2, kind: "platform", name: "Cold call" },
  { id: "off-csv-import", parentId: "offline-sources", level: 2, kind: "platform", name: "Spreadsheet import" },
  { id: "off-events", parentId: "offline-sources", level: 2, kind: "platform", name: "Trade shows & webinars" },

  // ==== FILLS IN AS TRACKING CONNECTS — web-tracked sources ======================

  // Paid social — Meta Ads subtree is a Phase-2 preview (auto-created from UTM data)
  { id: "meta-ads", parentId: "paid-social", level: 2, kind: "platform", name: "Meta Ads" },
  { id: "meta-black-friday", parentId: "meta-ads", level: 3, kind: "campaign", name: "black_friday_2026", isAutoCreated: true, userDefined: true },
  { id: "meta-bf-bizowners", parentId: "meta-black-friday", level: 4, kind: "ad_set", name: "biz_owners_25_54_us", isAutoCreated: true, userDefined: true },
  { id: "meta-bf-bo-video", parentId: "meta-bf-bizowners", level: 5, kind: "creative", name: "video_testimonial_v2", isAutoCreated: true, userDefined: true },
  { id: "tiktok-ads", parentId: "paid-social", level: 2, kind: "platform", name: "TikTok Ads" },
  { id: "linkedin-ads", parentId: "paid-social", level: 2, kind: "platform", name: "LinkedIn Ads" },

  // Paid search — campaign (drill-down 1) > search term (drill-down 2)
  { id: "google-ads", parentId: "paid-search", level: 2, kind: "platform", name: "Google Ads" },
  { id: "bing-ads", parentId: "paid-search", level: 2, kind: "platform", name: "Bing Ads" },

  // Organic search — search engine

  // Organic social — social network

  // AI Referrals — AI platform

  // Other campaigns — tracked campaigns that aren't email / paid search / paid social
];

const NODE_BY_ID = new Map(ATTRIBUTION_NODES.map((n) => [n.id, n]));

const CHILDREN_BY_PARENT = new Map<string | null, AttributionNode[]>();
for (const node of ATTRIBUTION_NODES) {
  const siblings = CHILDREN_BY_PARENT.get(node.parentId) ?? [];
  siblings.push(node);
  CHILDREN_BY_PARENT.set(node.parentId, siblings);
}

export function attributionNodeById(id: string): AttributionNode | undefined {
  return NODE_BY_ID.get(id);
}

export function attributionChildren(parentId: string | null): AttributionNode[] {
  return CHILDREN_BY_PARENT.get(parentId) ?? [];
}

/**
 * Self-inclusive descendant expansion — the core of hierarchical filtering.
 * Selecting "Referrals" returns Referrals + BizBuySell + both its leaves + Transworld
 * + Referral partners, so a parent selection matches every contact classified anywhere
 * under that branch. (Real system: one indexed path-prefix query on attribution_nodes.)
 */
export function attributionDescendantIds(selectedIds: string[]): Set<string> {
  const result = new Set<string>();
  const queue = [...selectedIds];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (result.has(id)) continue;
    result.add(id);
    for (const child of attributionChildren(id)) queue.push(child.id);
  }
  return result;
}

/** Ancestor chain (root first, self last) for a node id. */
export function attributionPathNodes(id: string): AttributionNode[] {
  const path: AttributionNode[] = [];
  let current = NODE_BY_ID.get(id);
  while (current) {
    path.unshift(current);
    current = current.parentId ? NODE_BY_ID.get(current.parentId) : undefined;
  }
  return path;
}

/** Human-readable classification path, e.g. "Referrals > BizBuySell > API leads". */
export function attributionPathLabel(id: string, separator = " > "): string {
  const path = attributionPathNodes(id);
  return path.length > 0 ? path.map((n) => n.name).join(separator) : "N/A";
}
