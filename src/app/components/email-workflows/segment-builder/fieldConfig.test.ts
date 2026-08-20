import { describe, expect, it } from "vitest";
import { buildAllFields, buildFieldConfig, fieldConfigFor } from "./fieldConfig";
import { getMatchedListings } from "@/app/lib/segmentUtils";
import type {
  Contact,
  ContactLeadAnswer,
  CustomFieldDefinition,
  FilterRule,
} from "@/app/types";

function definition(
  overrides: Partial<CustomFieldDefinition> = {},
): CustomFieldDefinition {
  return {
    id: "cfd-1",
    key: "years_in_business",
    label: "Years in business",
    type: "number",
    section: "Questionnaire",
    isVisible: true,
    isFilterable: true,
    isAutoDiscovered: false,
    createdAt: new Date("2026-06-01"),
    ...overrides,
  };
}

function contact(id: string): Contact {
  return {
    id,
    firstName: "Test",
    lastName: id,
    email: `${id}@example.com`,
    phone: "(555) 000-0000",
    listingName: "Working Capital",
    listingStatus: "New",
    userType: "Borrower",
    optedOut: false,
    openReminders: 0,
    createAt: new Date("2026-01-01"),
  } as Contact;
}

/**
 * These are the tests for the bug the redesign started from: the "Filterable"
 * switch wrote a boolean nothing read, so a field turned on here never appeared in
 * the segment builder.
 */
describe("filterable custom fields reach the segment builder", () => {
  it("offers a field that is visible and filterable", () => {
    expect(buildAllFields([definition()])).toContain("years_in_business");
  });

  it("does not offer one that is only filterable", () => {
    expect(buildAllFields([definition({ isVisible: false })])).not.toContain(
      "years_in_business",
    );
  });

  it("does not offer one that is only visible", () => {
    expect(buildAllFields([definition({ isFilterable: false })])).not.toContain(
      "years_in_business",
    );
  });

  it("withdraws it once archived", () => {
    expect(
      buildAllFields([definition({ archivedAt: new Date("2026-08-01") })]),
    ).not.toContain("years_in_business");
  });

  it("picks operators from the field's type", () => {
    const config = buildFieldConfig([
      definition(),
      definition({ id: "cfd-2", key: "industry", label: "Industry", type: "text" }),
      definition({
        id: "cfd-3",
        key: "preferred_slot",
        label: "Preferred slot",
        type: "select",
        options: ["Morning", "Afternoon"],
      }),
    ]);

    expect(config.years_in_business.operators).toContain(">=");
    expect(config.years_in_business.operators).not.toContain("contains");
    expect(config.industry.operators).toContain("contains");
    expect(config.preferred_slot.options).toEqual(["Morning", "Afternoon"]);
  });

  it("never lets a custom key shadow a core field", () => {
    // Four ad-form fields share a key with an underwriting criterion. The core entry
    // wins: it matches the application as well as the lead's answer, and compares
    // numbers rather than band labels.
    const config = buildFieldConfig([
      definition({ id: "cfd-x", key: "self_reported_fico", label: "Hijacked", type: "select" }),
    ]);

    expect(config.self_reported_fico.label).toBe("FICO Score");
    expect(config.self_reported_fico.type).toBe("number");
  });

  it("falls back rather than throwing on a field id that no longer exists", () => {
    expect(fieldConfigFor("deleted_key", buildFieldConfig([])).label).toBe(
      "Unknown field",
    );
  });
});

describe("a custom-field rule actually selects contacts", () => {
  const rule = (overrides: Partial<FilterRule>): FilterRule => ({
    field: "years_in_business",
    operator: ">=",
    value: "6",
    logic: "and",
    ...overrides,
  });

  /** Answers are rows, so a fixture supplies them beside the contact rather than on it. */
  const answersOf = (id: string, answers: Record<string, string>): ContactLeadAnswer[] =>
    Object.entries(answers).map(([targetKey, value]) => ({
      id: `${id}-${targetKey}`,
      contactId: id,
      targetKey,
      value,
      answeredAt: "2026-01-01T00:00:00.000Z",
    }));

  const matches = (answers: Record<string, string>, r: FilterRule) =>
    getMatchedListings(contact("1"), [r], [], answersOf("1", answers)).length > 0;

  it("compares numbers numerically", () => {
    expect(matches({ years_in_business: "7" }, rule({}))).toBe(true);
    expect(matches({ years_in_business: "3" }, rule({}))).toBe(false);
    // "10" must beat "6" — a string comparison would say otherwise.
    expect(matches({ years_in_business: "10" }, rule({}))).toBe(true);
  });

  it("compares text with contains", () => {
    expect(
      matches(
        { industry: "Commercial Landscaping" },
        rule({ field: "industry", operator: "contains", value: "landscap" }),
      ),
    ).toBe(true);
  });

  it("fails a positive rule when the contact never answered", () => {
    expect(matches({}, rule({}))).toBe(false);
    expect(matches({}, rule({ operator: "=", value: "7" }))).toBe(false);
  });

  it("satisfies a negative rule when the contact never answered", () => {
    expect(
      matches({}, rule({ field: "industry", operator: "!=", value: "Retail" })),
    ).toBe(true);
  });

  it("never lets a custom key shadow a real contact column", () => {
    // A field keyed "email" must not hijack the contact's actual email.
    expect(
      matches(
        { email: "wrong@example.com" },
        rule({ field: "email", operator: "=", value: "1@example.com" }),
      ),
    ).toBe(true);
  });
});
