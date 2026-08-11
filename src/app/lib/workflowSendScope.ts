import type { Contact, FilterRule, WorkflowStep } from "../types";
import { extractPlaceholders } from "../components/email-workflows/settings/placeholderCatalog";
import { getMatchedListings } from "./segmentUtils";

export type SendMode = "once" | "per-listing" | "per-application";

/** Minimal shape shared by a persisted WorkflowStep and the builder's StepDraft. */
export type SendableLike = Pick<WorkflowStep, "actionType" | "subject" | "body" | "message" | "sendMode">;

const SENDABLE = new Set(["email", "sms"]);

/** The merge tokens a step's content references ({{namespace.field}}). */
function stepTokens(step: SendableLike): string[] {
  if (step.actionType === "email") {
    return extractPlaceholders(`${step.subject ?? ""} ${step.body ?? ""}`);
  }
  if (step.actionType === "sms") {
    return extractPlaceholders(step.message ?? "");
  }
  return [];
}

/** True when the step's template references any listing-scoped token ({{listing.*}}). */
export function hasListingToken(step: SendableLike): boolean {
  return stepTokens(step).some((t) => t.startsWith("listing."));
}

/**
 * The scope a step actually runs at.
 * - Non-sendable steps (delay, call-reminder, voicemail, conditional) are always once.
 * - A listing-token template is forced to per-listing — the CRM cannot know which
 *   listing to populate for a single send.
 * - Otherwise the author's stored choice wins, defaulting to once (no duplicate sends).
 */
export function effectiveSendMode(step: SendableLike): SendMode {
  if (!SENDABLE.has(step.actionType)) return "once";
  if (hasListingToken(step)) return "per-listing";
  return step.sendMode ?? "once";
}

/**
 * How many sends a step produces for one enrolled contact, re-hydrated at call time.
 * - "once": exactly 1.
 * - "per-listing": one per currently-matching listing (0 if none match).
 * - "per-application": one per linked application (0 if the contact has none).
 */
export function resolveStepSendCount(
  step: SendableLike,
  contact: Contact,
  segmentFilters: FilterRule[],
): number {
  const mode = effectiveSendMode(step);
  if (mode === "per-listing") return getMatchedListings(contact, segmentFilters).length;
  if (mode === "per-application") return contact.linkedApplicationId ? 1 : 0;
  return 1;
}
