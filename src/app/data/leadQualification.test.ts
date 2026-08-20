import { describe, expect, it } from "vitest";
import {
  displayedQualification,
  formatFicoRange,
  leadQualificationFromAnswers,
  matchesQualificationRule,
  parseFicoBand,
  parseRequestedAmount,
} from "./leadQualification";
import type { Application, Contact, FilterRule } from "../types";

function contact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "c-1",
    firstName: "Dana",
    lastName: "Whitfield",
    email: "dana@example.com",
    phone: "(555) 000-0000",
    listingName: "Working Capital",
    listingStatus: "New",
    userType: "Borrower",
    optedOut: false,
    openReminders: 0,
    createAt: new Date("2026-01-01"),
    ...overrides,
  } as Contact;
}

function application(overrides: Partial<Application> = {}): Application {
  return {
    id: "app-1",
    applicationNumber: "00001",
    stage: "Prequalification Review",
    loanPurpose: "Working Capital",
    branchName: "Test Branch",
    loanOfficerName: "Test Officer",
    assigneeName: "Test Assignee",
    loanAmount: 100000,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-02-01"),
    ...overrides,
  };
}

function rule(overrides: Partial<FilterRule>): FilterRule {
  return {
    field: "self_reported_fico",
    operator: "<",
    value: "640",
    logic: "and",
    ...overrides,
  } as FilterRule;
}

describe("parseFicoBand", () => {
  it("reads Meta's own option label", () => {
    expect(parseFicoBand("580-639_(poor)")).toEqual({ min: 580, max: 639 });
    expect(parseFicoBand("500-579_(very_poor)")).toEqual({ min: 500, max: 579 });
  });

  it("reads the tidied label the CRM shows", () => {
    expect(parseFicoBand("600 – 639")).toEqual({ min: 600, max: 639 });
  });

  it("leaves an open-ended band open", () => {
    expect(parseFicoBand("720+")).toEqual({ min: 720 });
    expect(parseFicoBand("Below 600")).toEqual({ max: 599 });
    expect(parseFicoBand("Under 600")).toEqual({ max: 599 });
  });

  it("normalises a reversed range", () => {
    expect(parseFicoBand("639-580")).toEqual({ min: 580, max: 639 });
  });

  it("returns null rather than a zero band when there is no number", () => {
    // A zero band would satisfy every "under X" filter — worse than no answer.
    expect(parseFicoBand("prefer not to say")).toBeNull();
    expect(parseFicoBand("")).toBeNull();
    expect(parseFicoBand(undefined)).toBeNull();
  });
});

describe("formatFicoRange", () => {
  it("formats each shape of band", () => {
    expect(formatFicoRange({ min: 580, max: 639 })).toBe("580 – 639");
    expect(formatFicoRange({ min: 720 })).toBe("720+");
    expect(formatFicoRange({ max: 599 })).toBe("Up to 599");
    expect(formatFicoRange(null)).toBeNull();
  });
});

describe("parseRequestedAmount", () => {
  it("reads a typed figure with separators or a currency symbol", () => {
    expect(parseRequestedAmount("50,000")).toBe(50000);
    expect(parseRequestedAmount("50000")).toBe(50000);
    expect(parseRequestedAmount("$1,200,000")).toBe(1200000);
  });

  it("expands k and m suffixes", () => {
    expect(parseRequestedAmount("250k")).toBe(250000);
    expect(parseRequestedAmount("Over $1M")).toBe(1000000);
  });

  it("collapses a band to its lower bound", () => {
    expect(parseRequestedAmount("$100k – $250k")).toBe(100000);
    expect(parseRequestedAmount("$250k – $500k")).toBe(250000);
  });

  it("treats a ceiling-only band as establishing no floor", () => {
    // "Under $100k" must not satisfy "wants at least $250k".
    expect(parseRequestedAmount("Under $100k")).toBe(0);
  });

  it("returns null when there is no number", () => {
    expect(parseRequestedAmount("not sure")).toBeNull();
    expect(parseRequestedAmount(undefined)).toBeNull();
  });
});

describe("leadQualificationFromAnswers", () => {
  it("routes the four criteria onto typed fields and leaves the rest alone", () => {
    const patch = leadQualificationFromAnswers({
      self_reported_fico: "580-639_(poor)",
      funding_purpose: "Equipment",
      requested_amount: "50,000",
      funding_timeline: "Immediately",
      years_in_business: "7",
    });

    expect(patch).toEqual({
      leadFicoMin: 580,
      leadFicoMax: 639,
      leadFundingPurpose: "Equipment",
      leadRequestedAmount: 50000,
      timeFrame: "Immediately",
    });
    // years_in_business is not one of the four and stays in customFields.
    expect("years_in_business" in patch).toBe(false);
  });

  it("writes nothing for answers it cannot parse", () => {
    expect(leadQualificationFromAnswers({ self_reported_fico: "no idea" })).toEqual({});
    expect(leadQualificationFromAnswers({})).toEqual({});
  });
});

describe("matchesQualificationRule — the OR rule", () => {
  const applications = [
    application({ id: "app-old", createdAt: new Date("2026-01-01"), selfReportedFicoMin: 600, selfReportedFicoMax: 619 }),
    application({ id: "app-new", createdAt: new Date("2026-06-01"), selfReportedFicoMin: 700, selfReportedFicoMax: 719 }),
  ];

  it("matches on a lead's own answer when there is no application at all", () => {
    const lead = contact({ leadFicoMin: 580, leadFicoMax: 639 });

    // This is the case the old customFields-only model missed silently.
    expect(matchesQualificationRule(lead, [], rule({}))).toBe(true);
  });

  it("matches on the application when the lead never declared anything", () => {
    const applicant = contact({ linkedApplicationId: "app-old" });

    expect(matchesQualificationRule(applicant, applications, rule({}))).toBe(true);
  });

  it("matches when only the lead's claim satisfies the rule", () => {
    // Verified band is 700–719; the ad claim was 600–639. OR means this still hits.
    const both = contact({
      linkedApplicationId: "app-new",
      leadFicoMin: 600,
      leadFicoMax: 639,
    });

    expect(matchesQualificationRule(both, applications, rule({}))).toBe(true);
  });

  it("matches when only the application satisfies the rule", () => {
    const both = contact({
      linkedApplicationId: "app-old",
      leadFicoMin: 720,
    });

    expect(matchesQualificationRule(both, applications, rule({}))).toBe(true);
  });

  it("is false only when no source satisfies the rule", () => {
    const both = contact({
      linkedApplicationId: "app-new",
      leadFicoMin: 720,
    });

    expect(matchesQualificationRule(both, applications, rule({}))).toBe(false);
  });

  it("does not depend on which application comes first in the array", () => {
    const both = contact({ linkedApplicationId: "app-old" });
    const forwards = matchesQualificationRule(both, applications, rule({}));
    const backwards = matchesQualificationRule(
      both,
      [...applications].reverse(),
      rule({}),
    );

    expect(forwards).toBe(backwards);
  });

  it("ignores a source that holds no value for the field", () => {
    const blank = contact({ linkedApplicationId: "app-blank" });

    expect(
      matchesQualificationRule(blank, [application({ id: "app-blank" })], rule({})),
    ).toBe(false);
  });
});

describe("matchesQualificationRule — band comparisons", () => {
  const band = contact({ leadFicoMin: 600, leadFicoMax: 639 });

  it("treats a band as satisfied when any score inside it satisfies the rule", () => {
    expect(matchesQualificationRule(band, [], rule({ operator: "<", value: "640" }))).toBe(true);
    expect(matchesQualificationRule(band, [], rule({ operator: ">=", value: "620" }))).toBe(true);
    expect(matchesQualificationRule(band, [], rule({ operator: "=", value: "615" }))).toBe(true);
  });

  it("is false when the whole band falls outside", () => {
    expect(matchesQualificationRule(band, [], rule({ operator: ">=", value: "700" }))).toBe(false);
    expect(matchesQualificationRule(band, [], rule({ operator: "<", value: "600" }))).toBe(false);
    expect(matchesQualificationRule(band, [], rule({ operator: "=", value: "700" }))).toBe(false);
  });

  it("handles an open-topped band", () => {
    const open = contact({ leadFicoMin: 720 });

    expect(matchesQualificationRule(open, [], rule({ operator: ">=", value: "800" }))).toBe(true);
    expect(matchesQualificationRule(open, [], rule({ operator: "<", value: "640" }))).toBe(false);
  });

  it("refuses a non-numeric filter value rather than guessing", () => {
    expect(matchesQualificationRule(band, [], rule({ value: "good" }))).toBe(false);
  });
});

describe("matchesQualificationRule — the other three fields", () => {
  const applications = [
    application({
      id: "app-1",
      requestedAmount: 750000,
      fundingPurpose: "Refinance",
      timeFrame: "4 weeks+",
    }),
  ];
  const person = contact({
    linkedApplicationId: "app-1",
    leadRequestedAmount: 50000,
    leadFundingPurpose: "Equipment",
    timeFrame: "Immediately",
  });

  it("matches an amount from either source", () => {
    const asked = (operator: FilterRule["operator"], value: string) =>
      matchesQualificationRule(
        person,
        applications,
        rule({ field: "requested_amount", operator, value }),
      );

    expect(asked(">=", "500000")).toBe(true); // application
    expect(asked("<=", "60000")).toBe(true); // lead
    expect(asked(">=", "1000000")).toBe(false); // neither
  });

  it("matches a purpose from either source, case-insensitively", () => {
    const asked = (value: string) =>
      matchesQualificationRule(
        person,
        applications,
        rule({ field: "funding_purpose", operator: "=", value }),
      );

    expect(asked("Refinance")).toBe(true);
    expect(asked("equipment")).toBe(true);
    expect(asked("Real estate")).toBe(false);
  });

  it("matches a timeline from either source", () => {
    const asked = (value: string) =>
      matchesQualificationRule(
        person,
        applications,
        rule({ field: "funding_timeline", operator: "=", value }),
      );

    expect(asked("4 weeks+")).toBe(true);
    expect(asked("Immediately")).toBe(true);
    expect(asked("2 – 4 weeks")).toBe(false);
  });
});

describe("displayedQualification — precedence, not OR", () => {
  const applications = [
    application({
      id: "app-old",
      createdAt: new Date("2026-01-01"),
      selfReportedFicoMin: 600,
      selfReportedFicoMax: 619,
      fundingPurpose: "Working capital",
      requestedAmount: 90000,
    }),
    application({
      id: "app-new",
      createdAt: new Date("2026-06-01"),
      selfReportedFicoMin: 700,
      selfReportedFicoMax: 719,
      requestedAmount: 400000,
    }),
  ];

  it("prefers the application over the lead's own claim", () => {
    const both = contact({
      linkedApplicationId: "app-new",
      leadFicoMin: 600,
      leadFicoMax: 639,
    });
    const shown = displayedQualification(both, applications);

    expect(shown.fico).toEqual({ min: 700, max: 719 });
    expect(shown.ficoSource).toBe("application");
  });

  it("falls back to the lead's claim when there is no application", () => {
    const lead = contact({ leadFicoMin: 580, leadFicoMax: 639, leadRequestedAmount: 50000 });
    const shown = displayedQualification(lead, applications);

    expect(shown.fico).toEqual({ min: 580, max: 639 });
    expect(shown.ficoSource).toBe("lead");
    expect(shown.requestedAmountSource).toBe("lead");
  });

  it("falls back per field, so one gap does not blank the rest", () => {
    // app-new carries no purpose; the lead's answer fills that row only.
    const both = contact({
      linkedApplicationId: "app-new",
      leadFundingPurpose: "Equipment",
    });
    const shown = displayedQualification(both, applications);

    expect(shown.requestedAmount).toBe(400000);
    expect(shown.requestedAmountSource).toBe("application");
    expect(shown.fundingPurpose).toBe("Equipment");
    expect(shown.fundingPurposeSource).toBe("lead");
  });

  it("reports no source when neither side has anything", () => {
    const shown = displayedQualification(contact(), []);

    expect(shown.fico).toBeNull();
    expect(shown.ficoSource).toBeUndefined();
  });
});
