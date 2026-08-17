import type { Application, Contact, FilterRule } from "../types";
import { getMatchedListings } from "./segmentUtils";

export type WorkflowDimension = "CONTACT" | "APPLICATION" | "LISTING";

/** One run a contact produces in a workflow. `objectId` is undefined for CONTACT. */
export interface RunObject {
  objectId?: string;
}

/**
 * Enumerate the runs a contact produces for a workflow of the given dimension.
 * Returns [] when the contact is not in the segment (or, for APPLICATION, has no linked application).
 */
export function getRunObjects(
  contact: Contact,
  dimension: WorkflowDimension,
  segmentFilters: FilterRule[],
): RunObject[] {
  const matched = getMatchedListings(contact, segmentFilters);
  if (matched.length === 0) return [];
  if (dimension === "LISTING") return matched.map((l) => ({ objectId: l.id }));
  if (dimension === "APPLICATION") {
    const ids = contact.applicationIds?.length
      ? contact.applicationIds
      : contact.linkedApplicationId
        ? [contact.linkedApplicationId]
        : [];
    return ids.map((id) => ({ objectId: id }));
  }
  return [{}];
}

export interface RunLabel {
  label: string;
  sublabel?: string;
}

/** Human label for a run's object, for the board card and contact panel header. */
export function resolveRunLabel(
  dimension: WorkflowDimension,
  objectId: string | undefined,
  contact: Contact,
  applications: Application[],
): RunLabel {
  if (dimension === "LISTING") {
    const l = contact.listings?.find((x) => x.id === objectId);
    return l
      ? { label: l.name, sublabel: l.status }
      : { label: contact.listingName, sublabel: contact.listingStatus };
  }
  if (dimension === "APPLICATION") {
    const a = applications.find((x) => x.id === objectId);
    return a ? { label: `#${a.applicationNumber}`, sublabel: a.stage } : { label: "Application" };
  }
  return { label: `${contact.firstName} ${contact.lastName}` };
}
