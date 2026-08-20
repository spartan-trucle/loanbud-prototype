import { describe, expect, it } from "vitest";
import {
  findCampaignByExternalId,
  toUtmKey,
  webCampaignKey,
  withWebCampaignKey,
} from "./campaignUtils";
import type { Campaign } from "../types";

const CAMPAIGNS: Campaign[] = [
  {
    id: "meta-black-friday",
    name: "Black Friday 2026",
    status: "Active",
    createdAt: new Date("2026-05-20"),
    externalRefs: [
      {
        platform: "meta",
        externalId: "23851004417650137",
        externalName: "Epsilon | Lead form V2",
      },
      {
        platform: "web",
        externalId: "black_friday_2026",
        externalName: "utm_campaign=black_friday_2026",
      },
    ],
  },
  {
    id: "summer-sba-2026",
    name: "Summer SBA 2026",
    status: "Active",
    createdAt: new Date("2026-06-10"),
    externalRefs: [
      { platform: "google", externalId: "20481553907", externalName: "SBA 7(a)" },
    ],
  },
  {
    id: "em-monthly-newsletter",
    name: "Monthly newsletter",
    status: "Active",
    createdAt: new Date("2025-12-15"),
  },
];

describe("findCampaignByExternalId", () => {
  it("matches a campaign on the platform's id", () => {
    expect(
      findCampaignByExternalId(CAMPAIGNS, "meta", "23851004417650137")?.id,
    ).toBe("meta-black-friday");
  });

  it("matches a web lead on its utm_campaign value — one lookup for every channel", () => {
    expect(findCampaignByExternalId(CAMPAIGNS, "web", "black_friday_2026")?.id).toBe(
      "meta-black-friday",
    );
  });

  it("matches a web key regardless of case, because a URL is typed by hand", () => {
    expect(findCampaignByExternalId(CAMPAIGNS, "web", "Black_Friday_2026")?.id).toBe(
      "meta-black-friday",
    );
  });

  it("does not match across platforms on the same id", () => {
    expect(
      findCampaignByExternalId(CAMPAIGNS, "meta", "20481553907"),
    ).toBeUndefined();
    // The Meta id is not a web key, however identical the string.
    expect(
      findCampaignByExternalId(CAMPAIGNS, "web", "23851004417650137"),
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

describe("webCampaignKey", () => {
  it("returns the web ref's id", () => {
    expect(webCampaignKey(CAMPAIGNS[0])).toBe("black_friday_2026");
  });

  it("is undefined for a campaign with no landing page of ours", () => {
    // Summer SBA runs on Google and Meta only; the newsletter has no refs at all.
    expect(webCampaignKey(CAMPAIGNS[1])).toBeUndefined();
    expect(webCampaignKey(CAMPAIGNS[2])).toBeUndefined();
  });
});

describe("withWebCampaignKey", () => {
  it("replaces the web ref and leaves every platform ref alone", () => {
    const next = withWebCampaignKey(CAMPAIGNS[0].externalRefs, "q4_push");

    expect(next?.filter((r) => r.platform === "meta")).toHaveLength(1);
    expect(next?.filter((r) => r.platform === "web")).toEqual([
      {
        platform: "web",
        externalId: "q4_push",
        externalName: "utm_campaign=q4_push",
      },
    ]);
  });

  it("drops the web ref when the key is cleared", () => {
    const next = withWebCampaignKey(CAMPAIGNS[0].externalRefs, "   ");

    expect(next?.some((r) => r.platform === "web")).toBe(false);
    expect(next).toHaveLength(1);
  });

  it("returns undefined rather than an empty array", () => {
    expect(withWebCampaignKey(undefined, "")).toBeUndefined();
  });

  it("adds a web ref to a campaign that had none", () => {
    expect(withWebCampaignKey(undefined, "monthly_newsletter")).toEqual([
      {
        platform: "web",
        externalId: "monthly_newsletter",
        externalName: "utm_campaign=monthly_newsletter",
      },
    ]);
  });
});

describe("toUtmKey", () => {
  it("normalises a name into a key a URL can carry", () => {
    expect(toUtmKey("  Black Friday 2026! ")).toBe("black_friday_2026");
  });
});
