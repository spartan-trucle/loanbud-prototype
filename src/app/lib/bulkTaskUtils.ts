import type { Application, Contact, Segment } from "../types";
import { getContactSegments } from "./segmentUtils";

/**
 * Bulk-create assignment model — RFC-008 (Tasks Module Enhancements).
 *
 * A bulk-created task is assigned to the contact's EXISTING assignee
 * (`contact.loanOfficer`). Round-robin runs ONLY as a fallback for contacts with
 * NO assignee — and it assigns the picked user to BOTH the contact and the task.
 * Bulk-create never reassigns an already-assigned contact.
 */

export interface BulkAssignment {
  contactId: string;
  contactName: string;
  assignee: string;
  /** True when the assignee was chosen by round-robin (contact had no LO). */
  viaRoundRobin: boolean;
}

export interface BulkAssignmentResult {
  assignments: BulkAssignment[];
  /** tasks-per-assignee, for the projected split bar/list. */
  perAssignee: Record<string, number>;
  existingLoCount: number;
  roundRobinCount: number;
}

const contactName = (c: Contact) => `${c.firstName} ${c.lastName}`;

/**
 * Contacts that currently belong to a given segment (reuses segment matching).
 *
 * `applications` is needed because a segment can filter on the underwriting criteria,
 * which live on the application as well as on the contact.
 */
export function contactsInSegment(
  segment: Segment,
  contacts: Contact[],
  applications: Application[] = [],
): Contact[] {
  return contacts.filter((c) =>
    getContactSegments(c, [segment], applications).some((s) => s.id === segment.id),
  );
}

/** A CALL task to a Do-Not-Call contact is the DNC warn-and-choose case. */
export function isDoNotCall(contact: Contact): boolean {
  return contact.isDoNotCall === true;
}

/** No SMS consent = opted out of SMS (or globally opted out). */
export function lacksSmsConsent(contact: Contact): boolean {
  return contact.smsOptOut?.optedOut === true || contact.optedOut === true;
}

/**
 * Deterministic assignment: existing LO wins; LO-less contacts round-robin over the
 * fallback pool (cyclically, in input order). Same algorithm drives the preview and
 * the actual create, so the projected split always matches the result.
 */
export function computeBulkAssignments(
  targets: Contact[],
  fallbackPool: string[],
): BulkAssignmentResult {
  const assignments: BulkAssignment[] = [];
  const perAssignee: Record<string, number> = {};
  let existingLoCount = 0;
  let roundRobinCount = 0;
  let rrIndex = 0;

  for (const c of targets) {
    const existing = c.loanOfficer?.trim();
    let assignee: string;
    let viaRoundRobin: boolean;

    if (existing) {
      assignee = existing;
      viaRoundRobin = false;
      existingLoCount += 1;
    } else if (fallbackPool.length > 0) {
      assignee = fallbackPool[rrIndex % fallbackPool.length];
      rrIndex += 1;
      viaRoundRobin = true;
      roundRobinCount += 1;
    } else {
      assignee = "";
      viaRoundRobin = false;
    }

    assignments.push({ contactId: c.id, contactName: contactName(c), assignee, viaRoundRobin });
    if (assignee) perAssignee[assignee] = (perAssignee[assignee] ?? 0) + 1;
  }

  return { assignments, perAssignee, existingLoCount, roundRobinCount };
}
