/**
 * Filter set mirrors the CRM contact list in frontend-hub:
 * Company · Role · Status · Assignee · Created at (range).
 * Attribution Source has its own tree popover and stays separate.
 *
 * Kept out of the component file so the filter bar exports only components
 * (the repo's react-refresh lint rule runs at zero warnings).
 */
export interface ContactFilters {
  company: string;
  role: string;
  status: string;
  assignee: string;
  /** Acquisition origin — how the person reached us. */
  trafficSource: string;
  /** Campaign id — campaigns are their own object, not a taxonomy level. */
  campaign: string;
  /** "Needs identity review" — the leads we would not attach to an existing person. */
  identityReview: string;
  createdFrom: string;
  createdTo: string;
}

export const EMPTY_CONTACT_FILTERS: ContactFilters = {
  company: "ALL",
  role: "ALL",
  status: "ALL",
  assignee: "ALL",
  trafficSource: "ALL",
  campaign: "ALL",
  identityReview: "ALL",
  createdFrom: "",
  createdTo: "",
};

export function countActiveFilters(filters: ContactFilters): number {
  const dropdowns = [
    filters.company,
    filters.role,
    filters.status,
    filters.assignee,
    filters.trafficSource,
    filters.campaign,
    filters.identityReview,
  ].filter((v) => v !== "ALL").length;
  const dateRange = filters.createdFrom || filters.createdTo ? 1 : 0;
  return dropdowns + dateRange;
}
