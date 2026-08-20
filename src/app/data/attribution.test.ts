import { describe, expect, it } from "vitest";
import type { Contact } from "../types";
import {
  attributionSummary,
  isPaidLeadSource,
  leadSourceChannel,
  leadSourceFromUtm,
  leadSourceLabel,
  resolveLeadSource,
} from "./attribution";
import seed from "./contacts.json";

describe("resolveLeadSource — first touch wins", () => {
  it("keeps the origin a contact already had", () => {
    // The case the backend guard exists for: someone who first arrived through
    // BizBuySell and later fills in a Facebook form is still a BizBuySell lead.
    expect(resolveLeadSource("bizbuysell_checkbox", "meta_lead_form")).toBe(
      "bizbuysell_checkbox",
    );
  });

  it("fills an absent origin", () => {
    expect(resolveLeadSource(undefined, "meta_lead_form")).toBe("meta_lead_form");
    expect(resolveLeadSource(null, "meta_lead_form")).toBe("meta_lead_form");
  });

  it("treats blank as absent, exactly as the SQL guard does", () => {
    // ContactRepository guards on `isNull() or trim() eq ""` — a stored " " must not
    // count as an origin, or it would block the real one forever.
    expect(resolveLeadSource("   ", "meta_lead_form")).toBe("meta_lead_form");
  });
});

describe("lead source vocabulary", () => {
  it("rolls paid channels up for a 'share from paid advertising' report", () => {
    expect(isPaidLeadSource("meta_lead_form")).toBe(true);
    expect(isPaidLeadSource("google_ads")).toBe(true);
    expect(isPaidLeadSource("organic_web")).toBe(false);
    expect(isPaidLeadSource("bizbuysell_checkbox")).toBe(false);
  });

  it("shows an unknown value rather than hiding it", () => {
    // lead_source is free text in the database, so a value from another integration
    // is real data, not a bug. Falling back to "Unknown" would lose it on screen.
    expect(leadSourceLabel("some_integration_we_do_not_know")).toBe(
      "some_integration_we_do_not_know",
    );
    expect(leadSourceChannel("some_integration_we_do_not_know")).toBeUndefined();
  });

  it("says so plainly when nothing was recorded", () => {
    expect(leadSourceLabel(undefined)).toBe("Not recorded");
  });
});

describe("leadSourceFromUtm", () => {
  it("reads the platform out of the source", () => {
    expect(leadSourceFromUtm("facebook", "cpc")).toBe("meta_lead_form");
    expect(leadSourceFromUtm("instagram", "paid")).toBe("meta_lead_form");
  });

  it("separates paid Google from organic Google", () => {
    expect(leadSourceFromUtm("google", "cpc")).toBe("google_ads");
    expect(leadSourceFromUtm("google", "organic")).toBe("organic_web");
  });

  it("falls back to direct when there is nothing to read", () => {
    expect(leadSourceFromUtm(undefined, undefined)).toBe("direct");
  });
});

describe("the seed", () => {
  const contacts = seed as unknown as Contact[];

  it("gives every contact a lead source and a creating system", () => {
    expect(contacts.every((c) => c.leadSource && c.attributionSource)).toBe(true);
  });

  it("keeps attribution_source coherent with lead_source", () => {
    // attribution_source gates who may see a contact, so a partner referral stamped
    // with the Meta service would be wrong twice over.
    const meta = contacts.filter((c) => c.leadSource === "meta_lead_form");
    expect(meta.every((c) => c.attributionSource === "service-meta-lead-ads")).toBe(true);

    const biz = contacts.filter((c) => c.leadSource === "bizbuysell_checkbox");
    expect(biz.length).toBeGreaterThan(0);
    expect(biz.every((c) => c.attributionSource === "client-biz-buy-sell")).toBe(true);
  });

  it("carries no trace of the six columns dropped in review", () => {
    const dropped = [
      "acquisitionOrigin",
      "marketingPlatform",
      "sourceOrganizationId",
      "intakeMethod",
      "leadFormId",
      "leadAnswersAt",
    ];
    const offenders = contacts.flatMap((c) =>
      dropped.filter((k) => k in (c as unknown as Record<string, unknown>)),
    );

    expect(offenders).toEqual([]);
  });
});

describe("attributionSummary", () => {
  it("names the channel and the system behind it", () => {
    const contact = {
      leadSource: "meta_lead_form",
      attributionSource: "service-meta-lead-ads",
    } as Contact;

    expect(attributionSummary(contact)).toBe("Meta lead form · via service-meta-lead-ads");
  });
});
