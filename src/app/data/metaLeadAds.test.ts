import { describe, expect, it } from "vitest";
import {
  META_LEAD_FORMS,
  findCampaignByExternalId,
  metaFormById,
  metaLeadAttribution,
  metaLeadSource,
} from "./metaLeadAds";
import { leadSourceFromUtm } from "./attribution";
import type { Campaign, MetaLeadPayload } from "../types";

function payload(overrides: Partial<MetaLeadPayload> = {}): MetaLeadPayload {
  return {
    firstName: "Dana",
    lastName: "Whitfield",
    email: "dana@example.com",
    formId: "1204487339112045",
    formName: "SBA financing — Instant Form V2",
    campaignId: "23851004417650137",
    campaignName: "Epsilon | Lead form V2",
    platform: "facebook",
    answers: {},
    ...overrides,
  };
}

const CAMPAIGNS: Campaign[] = [
  {
    id: "meta-black-friday",
    name: "Black Friday 2026",
    utmCampaign: "black_friday_2026",
    status: "Active",
    createdAt: new Date("2026-05-20"),
    externalRefs: [
      {
        platform: "meta",
        externalId: "23851004417650137",
        externalName: "Epsilon | Lead form V2",
      },
    ],
  },
  {
    id: "summer-sba-2026",
    name: "Summer SBA 2026",
    utmCampaign: "summer_sba_2026",
    status: "Active",
    createdAt: new Date("2026-06-10"),
    externalRefs: [
      { platform: "google", externalId: "20481553907", externalName: "SBA 7(a)" },
    ],
  },
  {
    id: "em-monthly-newsletter",
    name: "Monthly newsletter",
    utmCampaign: "monthly_newsletter",
    status: "Active",
    createdAt: new Date("2025-12-15"),
  },
];

describe("metaLeadAttribution", () => {
  it("classifies a paid Instant Form as paid social", () => {
    const result = metaLeadAttribution(payload());

    expect(result.leadSource).toBe("meta_lead_form");
    expect(result.detail1).toBe("Facebook");
    expect(result.detail2).toBe("SBA financing — Instant Form V2");
  });

  it("uses the platform the impression was served on as drill-down 1", () => {
    expect(metaLeadAttribution(payload({ platform: "instagram" })).detail1).toBe(
      "Instagram",
    );
  });

  it("sends organic submissions to offline sources, not paid social", () => {
    const result = metaLeadAttribution(payload({ isOrganic: true }));

    // Organic social is not in the closed enum, so it cannot be invented here.
    expect(result.leadSource).toBe("organic_web");
    expect(result.leadSourceReason).toContain("Organic social");
  });

  it("falls back to the form id when Meta sends no form name", () => {
    expect(metaLeadAttribution(payload({ formName: "  " })).detail2).toBe(
      "1204487339112045",
    );
  });

  it("never consults the UTM resolver — there is no UTM to consult", () => {
    // A Meta lead carries no utm_source/utm_medium at all; run the UTM path on the
    // empty input it would receive and confirm the two adapters disagree.
    expect(leadSourceFromUtm(undefined, undefined)).toBe("direct");
    expect(metaLeadAttribution(payload()).leadSource).toBe("meta_lead_form");
  });
});

describe("findCampaignByExternalId", () => {
  it("matches a campaign on the platform's id", () => {
    expect(
      findCampaignByExternalId(CAMPAIGNS, "meta", "23851004417650137")?.id,
    ).toBe("meta-black-friday");
  });

  it("does not match across platforms on the same id", () => {
    expect(
      findCampaignByExternalId(CAMPAIGNS, "meta", "20481553907"),
    ).toBeUndefined();
  });

  it("ignores the campaign name entirely", () => {
    const renamed = CAMPAIGNS.map((c) =>
      c.id === "meta-black-friday"
        ? {
            ...c,
            name: "Q4 push (renamed in Ads Manager)",
            externalRefs: c.externalRefs?.map((ref) => ({
              ...ref,
              externalName: "Something else entirely",
            })),
          }
        : c,
    );

    expect(
      findCampaignByExternalId(renamed, "meta", "23851004417650137")?.id,
    ).toBe("meta-black-friday");
  });

  it("returns nothing for a blank or unknown id", () => {
    expect(findCampaignByExternalId(CAMPAIGNS, "meta", "  ")).toBeUndefined();
    expect(findCampaignByExternalId(CAMPAIGNS, "meta", "999")).toBeUndefined();
  });
});

describe("form catalog", () => {
  it("looks a form up by id", () => {
    expect(metaFormById(META_LEAD_FORMS[1].id)?.name).toBe(META_LEAD_FORMS[1].name);
    expect(metaFormById("nope")).toBeUndefined();
  });

  it("records the form id in the lead source", () => {
    expect(metaLeadSource(payload())).toBe("meta_lead_ads:1204487339112045");
  });
});
