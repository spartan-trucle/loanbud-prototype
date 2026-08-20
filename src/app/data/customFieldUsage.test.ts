import { describe, expect, it } from "vitest";
import type { ContactLeadAnswer } from "../types";
import {
  activeFields,
  archiveImpact,
  archivedFields,
  displayableFields,
  fieldGroupNames,
  fieldUsage,
  filterableFields,
  groupFields,
  isKeyAvailable,
  isUnused,
  matchesFieldFilters,
  usageByField,
  EMPTY_FIELD_FILTERS,
  SYSTEM_FIELDS,
} from "./customFieldUsage";
import type {
  Contact,
  CustomFieldDefinition,
  FilterRule,
  LeadFormDefinition,
  Segment,
} from "../types";

function field(
  overrides: Partial<CustomFieldDefinition> = {},
): CustomFieldDefinition {
  return {
    id: "cfd-1",
    key: "funding_purpose",
    label: "Funding purpose",
    type: "select",
    section: "Questionnaire",
    isVisible: true,
    isFilterable: true,
    isAutoDiscovered: false,
    createdAt: new Date("2026-06-01"),
    ...overrides,
  };
}

function form(
  id: string,
  targets: { key: string; kind?: "core" | "custom" }[],
): LeadFormDefinition {
  return {
    id,
    platform: "meta",
    platformAccountId: "acc-1",
    externalRef: id,
    name: `Form ${id}`,
    isActive: true,
    fieldMappings: targets.map((target, index) => ({
      externalKey: `q_${index}`,
      targetKey: target.key,
      targetKind: target.kind ?? "custom",
      order: index + 1,
    })),
  };
}

function segment(id: string, fields: string[]): Segment {
  return {
    id,
    name: `Segment ${id}`,
    status: "Active",
    filters: fields.map(
      (f): FilterRule => ({ field: f, operator: "=", value: "x", logic: "and" }),
    ),
  } as Segment;
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

/** Answers are rows now, so the fixture builds them alongside the contacts. */
function answersFor(byContact: Record<string, Record<string, string>>): ContactLeadAnswer[] {
  return Object.entries(byContact).flatMap(([contactId, answers]) =>
    Object.entries(answers).map(([targetKey, value]) => ({
      id: `${contactId}-${targetKey}`,
      contactId,
      targetKey,
      value,
      answeredAt: "2026-01-01T00:00:00.000Z",
    })),
  );
}

describe("fieldUsage", () => {
  const forms = [
    form("f-1", [{ key: "funding_purpose" }, { key: "email", kind: "core" }]),
    form("f-2", [{ key: "funding_purpose" }]),
    form("f-3", [{ key: "years_in_business" }]),
  ];
  const segments = [
    segment("s-1", ["funding_purpose", "userType"]),
    segment("s-2", ["listingStatus"]),
  ];
  const contacts = [contact("1"), contact("2"), contact("3"), contact("4")];
  const leadAnswers = answersFor({
    "1": { funding_purpose: "Equipment" },
    "2": { funding_purpose: "Refinance" },
    "3": { years_in_business: "7" },
  });

  it("finds every lead form that maps a question to the field", () => {
    const usage = fieldUsage({ key: "funding_purpose" }, forms, segments, contacts, leadAnswers);

    expect(usage.leadForms.map((r) => r.id)).toEqual(["f-1", "f-2"]);
  });

  it("does not count a core mapping that happens to share the key", () => {
    // f-1 maps a question to the core `email` column, not to a custom field.
    const usage = fieldUsage({ key: "email" }, forms, segments, contacts, leadAnswers);

    expect(usage.leadForms).toHaveLength(0);
  });

  it("finds segments that filter on the field", () => {
    const usage = fieldUsage({ key: "funding_purpose" }, forms, segments, contacts, leadAnswers);

    expect(usage.segments.map((r) => r.id)).toEqual(["s-1"]);
  });

  it("looks in exclude filters too", () => {
    const withExclude = {
      ...segment("s-3", ["userType"]),
      excludeFilters: [
        { field: "years_in_business", operator: "=", value: "1", logic: "and" },
      ],
    } as Segment;

    const usage = fieldUsage({ key: "years_in_business" }, [], [withExclude], [], []);
    expect(usage.segments.map((r) => r.id)).toEqual(["s-3"]);
  });

  it("counts contacts holding a non-blank answer", () => {
    const usage = fieldUsage({ key: "funding_purpose" }, forms, segments, contacts, leadAnswers);

    expect(usage.contactCount).toBe(2);
  });

  it("does not count a blank answer as an answer", () => {
    const blank = [contact("1"), contact("2")];
    const blankAnswers = answersFor({ "1": { funding_purpose: "   " } });

    expect(
      fieldUsage({ key: "funding_purpose" }, [], [], blank, blankAnswers).contactCount,
    ).toBe(0);
  });

  it("totals forms + segments + contacts-as-one", () => {
    const usage = fieldUsage({ key: "funding_purpose" }, forms, segments, contacts, leadAnswers);

    // 2 forms + 1 segment + (contacts counted once) = 4
    expect(usage.total).toBe(4);
  });

  it("reports zero for a field nothing points at", () => {
    const usage = fieldUsage({ key: "heard_about_us" }, forms, segments, contacts, leadAnswers);

    expect(usage.total).toBe(0);
    expect(usage.contactCount).toBe(0);
  });

  it("computes usage for every field in one call", () => {
    const map = usageByField(
      [field(), field({ id: "cfd-2", key: "years_in_business" })],
      forms,
      segments,
      contacts,
      leadAnswers,
    );

    expect(map.get("cfd-1")?.leadForms).toHaveLength(2);
    expect(map.get("cfd-2")?.leadForms).toHaveLength(1);
  });
});

describe("isUnused", () => {
  it("is true for a manual field nothing references", () => {
    const usage = fieldUsage({ key: "nope" }, [], [], [], []);

    expect(isUnused(field({ key: "nope" }), usage)).toBe(true);
  });

  it("is false as soon as anything references it", () => {
    const usage = fieldUsage(
      { key: "funding_purpose" },
      [form("f-1", [{ key: "funding_purpose" }])],
      [],
      [],
      [],
    );

    expect(isUnused(field(), usage)).toBe(false);
  });

  it("never flags an auto-discovered field, even at zero usage", () => {
    // It arrived because a form posted a key nobody registered — that is a question
    // waiting for an admin, not a leftover to sweep up.
    const usage = fieldUsage({ key: "heard_about_us" }, [], [], [], []);

    expect(isUnused(field({ isAutoDiscovered: true }), usage)).toBe(false);
  });
});

describe("archiveImpact", () => {
  it("names what would be affected rather than counting it", () => {
    const usage = fieldUsage(
      { key: "funding_purpose" },
      [form("f-1", [{ key: "funding_purpose" }])],
      [segment("s-1", ["funding_purpose"])],
      [contact("1")],
      answersFor({ "1": { funding_purpose: "Equipment" } }),
    );

    expect(archiveImpact(usage)).toEqual([
      'Lead form "Form f-1" maps a question to this field',
      'Segment "Segment s-1" filters on this field',
      "1 contact holds an answer under this key",
    ]);
  });

  it("says nothing when nothing is affected", () => {
    expect(archiveImpact(fieldUsage({ key: "nope" }, [], [], [], []))).toEqual([]);
  });
});

describe("the archive rule", () => {
  const live = field({ id: "live" });
  const gone = field({ id: "gone", key: "old_question", archivedAt: new Date("2026-08-01") });
  const all = [live, gone];

  it("splits active from archived on archivedAt alone", () => {
    expect(activeFields(all).map((f) => f.id)).toEqual(["live"]);
    expect(archivedFields(all).map((f) => f.id)).toEqual(["gone"]);
  });

  it("hides an archived field from the contact tab and the segment builder", () => {
    // Both switches are still on — being archived is what removes it, and that is
    // what restoring has to put back untouched.
    expect(gone.isVisible).toBe(true);
    expect(gone.isFilterable).toBe(true);
    expect(displayableFields(all).map((f) => f.id)).toEqual(["live"]);
    expect(filterableFields(all).map((f) => f.id)).toEqual(["live"]);
  });

  it("keeps an archived field's answers reachable by usage counting", () => {
    // The whole reason archive exists instead of delete.
    const usage = fieldUsage(
      { key: "old_question" },
      [],
      [],
      [contact("1")],
      answersFor({ "1": { old_question: "Yes" } }),
    );

    expect(usage.contactCount).toBe(1);
  });

  it("still refuses to hand an archived field's key to a new field", () => {
    expect(isKeyAvailable("old_question", all)).toBe(false);
    expect(isKeyAvailable("brand_new", all)).toBe(true);
  });

  it("refuses a system column's name too", () => {
    expect(isKeyAvailable(SYSTEM_FIELDS[0].key, all)).toBe(false);
  });

  it("lets a field keep its own key while being edited", () => {
    expect(isKeyAvailable("funding_purpose", all, "live")).toBe(true);
  });

  it("refuses an empty key", () => {
    expect(isKeyAvailable("", all)).toBe(false);
  });
});

describe("filterableFields", () => {
  it("requires visible and filterable, not just filterable", () => {
    const hidden = field({ id: "hidden", isVisible: false, isFilterable: true });

    expect(filterableFields([hidden])).toEqual([]);
  });
});

describe("grouping and filtering", () => {
  const fields = [
    field({ id: "a", key: "a_key", label: "Alpha", section: "Questionnaire" }),
    field({ id: "b", key: "b_key", label: "Beta", section: "Underwriting", type: "number" }),
    field({ id: "c", key: "heard_about_us", label: "Heard about us", section: "Questionnaire", isVisible: false, isAutoDiscovered: true }),
  ];

  it("buckets fields by group, groups alphabetically", () => {
    expect(groupFields(fields).map((g) => [g.section, g.fields.length])).toEqual([
      ["Questionnaire", 2],
      ["Underwriting", 1],
    ]);
  });

  it("lists the distinct group names", () => {
    expect(fieldGroupNames(fields)).toEqual(["Questionnaire", "Underwriting"]);
  });

  it("searches the key as well as the label", () => {
    const byKey = { ...EMPTY_FIELD_FILTERS, search: "heard_about" };
    const byLabel = { ...EMPTY_FIELD_FILTERS, search: "alpha" };

    expect(matchesFieldFilters(fields[2], byKey, undefined)).toBe(true);
    expect(matchesFieldFilters(fields[0], byKey, undefined)).toBe(false);
    expect(matchesFieldFilters(fields[0], byLabel, undefined)).toBe(true);
  });

  it("filters by type, visibility and origin", () => {
    expect(
      matchesFieldFilters(fields[1], { ...EMPTY_FIELD_FILTERS, type: "number" }, undefined),
    ).toBe(true);
    expect(
      matchesFieldFilters(fields[0], { ...EMPTY_FIELD_FILTERS, type: "number" }, undefined),
    ).toBe(false);
    expect(
      matchesFieldFilters(fields[2], { ...EMPTY_FIELD_FILTERS, visibility: "hidden" }, undefined),
    ).toBe(true);
    expect(
      matchesFieldFilters(fields[2], { ...EMPTY_FIELD_FILTERS, origin: "manual" }, undefined),
    ).toBe(false);
  });

  it("filters by whether anything references the field", () => {
    const used = fieldUsage(
      { key: "a_key" },
      [form("f-1", [{ key: "a_key" }])],
      [],
      [],
      [],
    );
    const unused = fieldUsage({ key: "b_key" }, [], [], [], []);

    expect(
      matchesFieldFilters(fields[0], { ...EMPTY_FIELD_FILTERS, usage: "used" }, used),
    ).toBe(true);
    expect(
      matchesFieldFilters(fields[1], { ...EMPTY_FIELD_FILTERS, usage: "used" }, unused),
    ).toBe(false);
    expect(
      matchesFieldFilters(fields[1], { ...EMPTY_FIELD_FILTERS, usage: "unused" }, unused),
    ).toBe(true);
  });
});
