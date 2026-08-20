import { describe, expect, it } from "vitest";
import {
  compareByOutcome,
  funnelFromMembers,
  leadQualityBreakdown,
  platformSplit,
  totalsAcrossCampaigns,
  type CampaignFunnel,
} from "./campaignMetrics";
import type {
  Application,
  Campaign,
  Contact,
  ContactLeadAnswer,
  CustomFieldDefinition,
} from "../types";

function application(
  id: string,
  stage: Application["stage"],
  loanAmount = 100000,
): Application {
  return {
    id,
    applicationNumber: id,
    stage,
    loanPurpose: "Working Capital",
    branchName: "Test Branch",
    loanOfficerName: "Test Officer",
    assigneeName: "Test Assignee",
    loanAmount,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-02-01"),
  };
}

function contact(id: string, overrides: Partial<Contact> = {}): Contact {
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
    campaignId: "camp-1",
    ...overrides,
  } as Contact;
}

const APPLICATIONS = [
  application("app-funded", "Funded", 500000),
  application("app-open", "Prequalification Review"),
];

function funnel(overrides: Partial<CampaignFunnel>): CampaignFunnel {
  return {
    campaignId: "camp",
    leads: 0,
    applications: 0,
    funded: 0,
    fundedAmount: 0,
    ...overrides,
  };
}

describe("funnelFromMembers", () => {
  const members = [
    contact("1", { linkedApplicationId: "app-funded" }),
    contact("2", { linkedApplicationId: "app-open" }),
    contact("3"),
    contact("4", { linkedApplicationId: "does-not-exist" }),
  ];

  it("counts leads, applications and funded loans", () => {
    const result = funnelFromMembers("camp-1", members, APPLICATIONS);

    expect(result.leads).toBe(4);
    expect(result.applications).toBe(2); // the dangling link does not count
    expect(result.funded).toBe(1);
    expect(result.fundedAmount).toBe(500000);
  });

  it("reports the conversion rate between each step", () => {
    const result = funnelFromMembers("camp-1", members, APPLICATIONS);

    expect(result.leadToApplication).toBe(0.5);
    expect(result.applicationToFunded).toBe(0.5);
    expect(result.leadToFunded).toBe(0.25);
  });

  it("does not divide by zero when a step is empty", () => {
    const result = funnelFromMembers("camp-1", [contact("1")], APPLICATIONS);

    expect(result.applications).toBe(0);
    expect(result.leadToApplication).toBe(0);
    expect(result.applicationToFunded).toBeUndefined();
  });

  it("returns an empty funnel for a campaign with no contacts", () => {
    const result = funnelFromMembers("camp-1", [], APPLICATIONS);

    expect(result.leads).toBe(0);
    expect(result.leadToApplication).toBeUndefined();
    expect(result.fundedAmount).toBe(0);
  });
});

describe("compareByOutcome", () => {
  it("ranks the most funded loans first", () => {
    const two = funnel({ campaignId: "two", leads: 4, applications: 3, funded: 2 });
    const one = funnel({ campaignId: "one", leads: 3, applications: 2, funded: 1 });

    expect([one, two].sort(compareByOutcome).map((f) => f.campaignId)).toEqual([
      "two",
      "one",
    ]);
  });

  it("breaks a tie on applications in flight", () => {
    const busy = funnel({ campaignId: "busy", leads: 4, applications: 3, funded: 1 });
    const quiet = funnel({ campaignId: "quiet", leads: 9, applications: 1, funded: 1 });

    expect([quiet, busy].sort(compareByOutcome).map((f) => f.campaignId)).toEqual([
      "busy",
      "quiet",
    ]);
  });

  it("does not reward lead volume that went nowhere", () => {
    const volume = funnel({ campaignId: "volume", leads: 800 });
    const producing = funnel({ campaignId: "producing", leads: 2, applications: 1, funded: 1 });

    expect([volume, producing].sort(compareByOutcome).map((f) => f.campaignId)).toEqual([
      "producing",
      "volume",
    ]);
  });
});

describe("totalsAcrossCampaigns", () => {
  it("sums every step and re-derives the blended conversion rates", () => {
    const totals = totalsAcrossCampaigns([
      funnel({ leads: 2, applications: 1, funded: 1, fundedAmount: 500000 }),
      funnel({ leads: 3, applications: 2, funded: 1, fundedAmount: 95000 }),
      funnel({ leads: 3, applications: 1, funded: 0 }),
    ]);

    expect(totals.leads).toBe(8);
    expect(totals.applications).toBe(4);
    expect(totals.funded).toBe(2);
    expect(totals.fundedAmount).toBe(595000);
    expect(totals.applicationToFunded).toBe(0.5);
  });

  it("is empty, not broken, with nothing to total", () => {
    const totals = totalsAcrossCampaigns([]);

    expect(totals.leads).toBe(0);
    expect(totals.leadToApplication).toBeUndefined();
  });
});

describe("leadQualityBreakdown", () => {
  const definitions: CustomFieldDefinition[] = [
    {
      id: "cfd-fico",
      key: "fico_band",
      label: "FICO band",
      type: "select",
      options: ["Below 600", "600 – 639", "720+"],
      section: "Questionnaire",
      isVisible: true,
      isFilterable: true,
      isAutoDiscovered: false,
      createdAt: new Date("2026-06-01"),
    },
    {
      id: "cfd-hidden",
      key: "heard_about_us",
      label: "Heard about us",
      type: "select",
      options: ["Friend", "Ad"],
      section: "Questionnaire",
      isVisible: false,
      isFilterable: false,
      isAutoDiscovered: true,
      createdAt: new Date("2026-08-09"),
    },
    {
      id: "cfd-industry",
      key: "industry",
      label: "Industry",
      type: "text",
      section: "Questionnaire",
      isVisible: true,
      isFilterable: false,
      isAutoDiscovered: false,
      createdAt: new Date("2026-06-01"),
    },
  ];

  const members = [contact("1"), contact("2"), contact("3"), contact("4")];

  const answer = (contactId: string, targetKey: string, value: string): ContactLeadAnswer => ({
    id: `${contactId}-${targetKey}`,
    contactId,
    targetKey,
    value,
    answeredAt: "2026-06-01T00:00:00.000Z",
  });

  const memberAnswers: ContactLeadAnswer[] = [
    answer("1", "fico_band", "Below 600"),
    answer("1", "heard_about_us", "Ad"),
    answer("1", "industry", "Retail"),
    answer("2", "fico_band", "Below 600"),
    answer("3", "fico_band", "720+"),
  ];

  it("summarises visible select fields only", () => {
    const [first, ...rest] = leadQualityBreakdown(members, definitions, memberAnswers);

    expect(rest).toHaveLength(0); // hidden field and free text are both skipped
    expect(first.key).toBe("fico_band");
  });

  it("counts blanks separately from answers", () => {
    const [fico] = leadQualityBreakdown(members, definitions, memberAnswers);

    expect(fico.answered).toBe(3);
    expect(fico.unanswered).toBe(1);
    expect(fico.buckets.map((b) => [b.value, b.count])).toEqual([
      ["Below 600", 2],
      ["720+", 1],
    ]);
    expect(fico.buckets[0].share).toBeCloseTo(2 / 3);
  });

  it("keeps the definition's option order so bands read worst to best", () => {
    const reversed = [contact("a"), contact("b")];
    const reversedAnswers = [
      answer("a", "fico_band", "720+"),
      answer("b", "fico_band", "Below 600"),
    ];

    expect(
      leadQualityBreakdown(reversed, definitions, reversedAnswers)[0].buckets.map((b) => b.value),
    ).toEqual(["Below 600", "720+"]);
  });
});

describe("platformSplit", () => {
  const campaign: Campaign = {
    id: "camp-1",
    name: "Epsilon",
    status: "Active",
    createdAt: new Date("2026-05-20"),
    externalRefs: [
      { platform: "google", externalId: "g-1", externalName: "Search exact" },
      { platform: "meta", externalId: "m-1", externalName: "Epsilon | Prospecting" },
      { platform: "meta", externalId: "m-2", externalName: "Epsilon | Retargeting" },
    ],
  };

  it("groups refs by platform, biggest group first, and labels the platform", () => {
    expect(platformSplit(campaign).map((p) => [p.label, p.refs.length])).toEqual([
      ["Meta Ads", 2],
      ["Google Ads", 1],
    ]);
  });

  it("returns nothing when no ad account is linked", () => {
    expect(platformSplit({ ...campaign, externalRefs: undefined })).toEqual([]);
  });
});
