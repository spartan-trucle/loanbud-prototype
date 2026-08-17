import { describe, it, expect } from "vitest";
import { getRunObjects, resolveRunLabel } from "./workflowDimension";
import type { Contact, FilterRule, Application } from "../types";

const contact = {
  id: "1",
  firstName: "James",
  lastName: "Lee",
  listingName: "Working Capital",
  listingStatus: "New",
  linkedApplicationId: "app-001",
  listings: [
    { id: "lst-1-1", name: "Working Capital", status: "New" },
    { id: "lst-1-2", name: "SBA 7(a)", status: "New" },
  ],
} as unknown as Contact;
const noFilters: FilterRule[] = [];
const apps = [
  { id: "app-001", applicationNumber: "00001", stage: "Underwriting" },
  { id: "app-003", applicationNumber: "00003", stage: "Leads" },
] as unknown as Application[];

describe("getRunObjects", () => {
  it("CONTACT → one run with no object when the contact matches", () => {
    expect(getRunObjects(contact, "CONTACT", noFilters)).toEqual([{}]);
  });
  it("LISTING → one run per matched listing", () => {
    expect(getRunObjects(contact, "LISTING", noFilters).map((r) => r.objectId)).toEqual(["lst-1-1", "lst-1-2"]);
  });
  it("APPLICATION → one run per applicationId when present", () => {
    const multi = { ...contact, applicationIds: ["app-001", "app-003"] } as unknown as Contact;
    expect(getRunObjects(multi, "APPLICATION", noFilters).map((r) => r.objectId)).toEqual(["app-001", "app-003"]);
  });
  it("APPLICATION → falls back to linkedApplicationId when applicationIds is absent", () => {
    expect(getRunObjects(contact, "APPLICATION", noFilters)).toEqual([{ objectId: "app-001" }]);
  });
  it("APPLICATION → zero runs when the contact has no applications at all", () => {
    const noApp = { ...contact, linkedApplicationId: undefined, applicationIds: undefined } as unknown as Contact;
    expect(getRunObjects(noApp, "APPLICATION", noFilters)).toEqual([]);
  });
  it("returns [] for any dimension when the contact is not in the segment", () => {
    const filters: FilterRule[] = [{ field: "listingStatus", operator: "=", value: "Submitted", logic: "and" } as unknown as FilterRule];
    const unmatched = { ...contact, listings: [{ id: "x", name: "x", status: "New" }] } as unknown as Contact;
    expect(getRunObjects(unmatched, "CONTACT", filters)).toEqual([]);
    expect(getRunObjects(unmatched, "LISTING", filters)).toEqual([]);
  });
});

describe("resolveRunLabel", () => {
  it("labels a CONTACT run with the contact name", () => {
    expect(resolveRunLabel("CONTACT", undefined, contact, apps)).toEqual({ label: "James Lee" });
  });
  it("labels a LISTING run with the listing name + status", () => {
    expect(resolveRunLabel("LISTING", "lst-1-2", contact, apps)).toEqual({ label: "SBA 7(a)", sublabel: "New" });
  });
  it("labels an APPLICATION run with the application number + stage", () => {
    expect(resolveRunLabel("APPLICATION", "app-001", contact, apps)).toEqual({ label: "#APP-001", sublabel: "Underwriting" });
  });
});
