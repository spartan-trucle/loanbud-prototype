import { describe, expect, it } from "vitest";
import type { ContactLeadAnswer } from "../types";
import { answerValue, parseBounds, upsertAnswers } from "./contactLeadAnswers";
import seed from "./contactLeadAnswers.json";

const AT = "2026-03-01T00:00:00.000Z";
const EARLIER = "2026-01-01T00:00:00.000Z";
const LATER = "2026-06-01T00:00:00.000Z";

describe("parseBounds", () => {
  it("turns a bucket into a range, because that is what a bucket is", () => {
    expect(parseBounds("580-639")).toEqual({ valueMin: 580, valueMax: 639 });
    expect(parseBounds("600 – 639")).toEqual({ valueMin: 600, valueMax: 639 });
  });

  it("reads money with its units", () => {
    expect(parseBounds("$100k – $250k")).toEqual({ valueMin: 100_000, valueMax: 250_000 });
    expect(parseBounds("Over $1M")).toEqual({ valueMin: 1_000_000 });
    expect(parseBounds("Under $100k")).toEqual({ valueMax: 100_000 });
  });

  it("leaves one bound open for an open-ended band", () => {
    expect(parseBounds("720+")).toEqual({ valueMin: 720 });
  });

  it("gives a scalar equal bounds so it still satisfies a range filter", () => {
    expect(parseBounds("7")).toEqual({ valueMin: 7, valueMax: 7 });
  });

  it("maps a timeline answer to days", () => {
    expect(parseBounds("Immediately")).toEqual({ valueMin: 0, valueMax: 13 });
    expect(parseBounds("4 weeks+")).toEqual({ valueMin: 29, valueMax: undefined });
  });

  it("returns nothing for a categorical answer — correct, not a parse failure", () => {
    expect(parseBounds("Working capital")).toEqual({});
  });
});

describe("upsertAnswers", () => {
  const existing: ContactLeadAnswer[] = [
    { id: "a", contactId: "1", targetKey: "funding_purpose", value: "Equipment", answeredAt: AT },
    { id: "b", contactId: "1", targetKey: "years_in_business", value: "7", answeredAt: AT },
  ];

  it("updates in place rather than appending a second row", () => {
    const next = upsertAnswers(existing, "1", { funding_purpose: "Acquisition" }, LATER);

    expect(next).toHaveLength(2);
    expect(answerValue("1", "funding_purpose", next)).toBe("Acquisition");
  });

  it("leaves questions this submission did not ask exactly as they were", () => {
    const next = upsertAnswers(existing, "1", { funding_purpose: "Acquisition" }, LATER);

    expect(answerValue("1", "years_in_business", next)).toBe("7");
  });

  it("keeps the newest answer when a submission arrives out of order", () => {
    // Reaches us second, but was answered first — four concurrent consumers make this real.
    const next = upsertAnswers(existing, "1", { funding_purpose: "Stale" }, EARLIER);

    expect(answerValue("1", "funding_purpose", next)).toBe("Equipment");
  });

  it("derives the numeric bounds a range filter needs", () => {
    const next = upsertAnswers(existing, "1", { self_reported_fico: "580-639" }, LATER);
    const row = next.find((a) => a.targetKey === "self_reported_fico");

    expect(row?.valueMin).toBe(580);
    expect(row?.valueMax).toBe(639);
  });

  it("does not leak one contact's answers onto another", () => {
    const next = upsertAnswers(existing, "2", { funding_purpose: "Real estate" }, LATER);

    expect(answerValue("1", "funding_purpose", next)).toBe("Equipment");
    expect(answerValue("2", "funding_purpose", next)).toBe("Real estate");
  });
});

describe("the seed", () => {
  const rows = seed as ContactLeadAnswer[];

  it("holds at most one answer per contact per question", () => {
    const keys = rows.map((a) => `${a.contactId}::${a.targetKey}`);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("carries bounds on everything numeric, and only categorical answers lack them", () => {
    const unbounded = rows.filter((a) => a.valueMin === undefined && a.valueMax === undefined);

    expect(new Set(unbounded.map((a) => a.targetKey))).toEqual(
      new Set(["funding_purpose", "what_is_the_purpose_of_the_loan?"]),
    );
  });
});
