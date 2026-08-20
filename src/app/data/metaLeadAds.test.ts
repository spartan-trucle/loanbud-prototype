import { describe, expect, it } from "vitest";
import {
  META_LEAD_FORMS,
  metaFormById,
  metaLeadAttribution,
  metaLeadSource,
} from "./metaLeadAds";
import { leadSourceFromUtm } from "./attribution";
import type { MetaLeadPayload } from "../types";

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

describe("form catalog", () => {
  it("looks a form up by id", () => {
    expect(metaFormById(META_LEAD_FORMS[1].id)?.name).toBe(META_LEAD_FORMS[1].name);
    expect(metaFormById("nope")).toBeUndefined();
  });

  it("records the form id in the lead source", () => {
    expect(metaLeadSource(payload())).toBe("meta_lead_ads:1204487339112045");
  });
});
