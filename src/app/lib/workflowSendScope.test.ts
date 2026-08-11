import { describe, it, expect } from "vitest";
import { hasListingToken, effectiveSendMode, resolveStepSendCount } from "./workflowSendScope";
import type { Contact, FilterRule } from "../types";

const emailStep = (over: Record<string, unknown> = {}) =>
  ({ actionType: "email", subject: "Hi", body: "<p>Hi {{contact.first_name}}</p>", ...over } as const);
const smsStep = (over: Record<string, unknown> = {}) =>
  ({ actionType: "sms", message: "Hi {{first_name}}", ...over } as const);

describe("hasListingToken", () => {
  it("is true when an email body references a listing token", () => {
    expect(hasListingToken(emailStep({ body: "<p>{{listing.name}}</p>" }))).toBe(true);
  });
  it("is true when an email subject references a listing token", () => {
    expect(hasListingToken(emailStep({ subject: "Re: {{listing.name}}", body: "<p>hi</p>" }))).toBe(true);
  });
  it("is false for a contact-only email", () => {
    expect(hasListingToken(emailStep())).toBe(false);
  });
  it("detects listing tokens in an SMS message", () => {
    expect(hasListingToken(smsStep({ message: "Update on {{listing.name}}" }))).toBe(true);
  });
  it("is false for non-sendable steps", () => {
    expect(hasListingToken({ actionType: "delay" } as never)).toBe(false);
  });
});

describe("effectiveSendMode", () => {
  it("forces per-listing when a listing token is present, ignoring the stored value", () => {
    expect(effectiveSendMode(emailStep({ body: "<p>{{listing.name}}</p>", sendMode: "once" }))).toBe("per-listing");
  });
  it("defaults contact-only email steps to once when unset", () => {
    expect(effectiveSendMode(emailStep())).toBe("once");
  });
  it("honors an explicit per-listing choice on a contact-only step", () => {
    expect(effectiveSendMode(emailStep({ sendMode: "per-listing" }))).toBe("per-listing");
  });
  it("returns once for non-sendable steps regardless of stored value", () => {
    expect(effectiveSendMode({ actionType: "call-reminder", sendMode: "per-listing" } as never)).toBe("once");
  });
});

describe("resolveStepSendCount", () => {
  const contact = {
    id: "1",
    listingName: "Working Capital",
    listingStatus: "New",
    listings: [
      { id: "lst-1-1", name: "Working Capital", status: "New" },
      { id: "lst-1-2", name: "SBA 7(a)", status: "New" },
    ],
  } as unknown as Contact;
  const noFilters: FilterRule[] = [];

  it("returns 1 for a once step", () => {
    expect(resolveStepSendCount(emailStep(), contact, noFilters)).toBe(1);
  });
  it("returns one-per-matching-listing for a per-listing step", () => {
    expect(resolveStepSendCount(emailStep({ body: "<p>{{listing.name}}</p>" }), contact, noFilters)).toBe(2);
  });
  it("returns 0 for a per-listing step when the contact has no matching listings", () => {
    const noListing = { id: "9", listingName: "", listingStatus: "New", listings: [] } as unknown as Contact;
    const filters: FilterRule[] = [{ field: "listingStatus", operator: "=", value: "Submitted", logic: "and" } as unknown as FilterRule];
    expect(resolveStepSendCount(emailStep({ sendMode: "per-listing" }), noListing, filters)).toBe(0);
  });
  it("returns 1 for a per-application step when the contact has a linked application", () => {
    const withApp = { ...contact, linkedApplicationId: "app-001" } as unknown as Contact;
    expect(resolveStepSendCount(emailStep({ sendMode: "per-application" }), withApp, noFilters)).toBe(1);
  });
  it("returns 0 for a per-application step when the contact has no linked application", () => {
    expect(resolveStepSendCount(emailStep({ sendMode: "per-application" }), contact, noFilters)).toBe(0);
  });
});

describe("effectiveSendMode with per-application", () => {
  it("honors an explicit per-application choice on a contact-only step", () => {
    expect(effectiveSendMode(emailStep({ sendMode: "per-application" }))).toBe("per-application");
  });
  it("still forces per-listing when a listing token is present, overriding per-application", () => {
    expect(effectiveSendMode(emailStep({ body: "<p>{{listing.name}}</p>", sendMode: "per-application" }))).toBe("per-listing");
  });
});
