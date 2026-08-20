import { describe, expect, it } from "vitest";
import type { ContactLeadAnswer } from "../types";
import {
  accountLastSyncedAt,
  conflictingExternalKeys,
  expectedCrmType,
  findContactByIdentity,
  hasTypeMismatch,
  resolveSubmissionIdentity,
  targetFieldType,
  formMappingSummary,
  submissionCount,
  inboundAnswers,
  inboundSectionTitle,
  leadFormByExternalRef,
  leadFormById,
  leadStatsByForm,
  mappingStatus,
  platformAccountStats,
  questionFromExternalKey,
} from "./leadFormUtils";
import platformAccountsJson from "./platformAccounts.json";
import customFieldDefinitionsJson from "./customFieldDefinitions.json";
import leadFormsJson from "./leadForms.json";
import type {
  Contact,
  CustomFieldDefinition,
  LeadFormDefinition,
  LeadFormFieldMapping,
  PlatformAccount,
} from "../types";

// Seed JSON carries dates as strings; the store revives them at read time.
const FORMS = leadFormsJson as unknown as LeadFormDefinition[];
const ACCOUNTS = platformAccountsJson as unknown as PlatformAccount[];
const SEEDED_FIELDS = customFieldDefinitionsJson as unknown as CustomFieldDefinition[];
const richCreative = FORMS.find((f) => f.id === "form-rich-creative-v2")!;
const moreVolume = FORMS.find((f) => f.id === "form-more-volume-v3")!;
const fastTrack = FORMS.find((f) => f.id === "form-fasttrack-2026")!;
const spartanTesting = FORMS.find((f) => f.id === "form-spartan-testing")!;
const reels = FORMS.find((f) => f.id === "form-reels-lead-gen")!;

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

describe("questionFromExternalKey", () => {
  it("turns a platform key back into the question the lead read", () => {
    expect(questionFromExternalKey("what_is_the_purpose_of_the_loan?")).toBe(
      "What is the purpose of the loan?",
    );
  });

  it("keeps the ® intact — it is part of the question, not decoration", () => {
    expect(questionFromExternalKey("what_is_your_fico®_credit_score?")).toBe(
      "What is your FICO® credit score?",
    );
  });

  it("uppercases FICO with or without the symbol", () => {
    expect(questionFromExternalKey("what_is_your_fico_score?")).toBe(
      "What is your FICO score?",
    );
  });

  it("leaves punctuation and amounts alone", () => {
    expect(
      questionFromExternalKey("how_much_funding_do_you_need?_(enter_any_amount)"),
    ).toBe("How much funding do you need? (enter any amount)");
  });
});

describe("the seeded forms", () => {
  it("words the same question identically on V2 and V3", () => {
    const v2 = richCreative.fieldMappings.map((m) => m.externalKey);
    const v3 = moreVolume.fieldMappings.map((m) => m.externalKey);

    expect(v2).toEqual(v3);
  });

  it("words the same field differently on FastTrack but maps it to the same key", () => {
    const byTarget = (form: LeadFormDefinition, key: string) =>
      form.fieldMappings.find((m) => m.targetKey === key)!;

    // Different question text...
    expect(byTarget(fastTrack, "funding_timeline").externalKey).not.toBe(
      byTarget(richCreative, "funding_timeline").externalKey,
    );
    // ...same CRM field, which is the whole point of the mapping.
    expect(byTarget(fastTrack, "funding_timeline").targetKey).toBe("funding_timeline");
  });

  it("leaves FastTrack's FICO question with no destination", () => {
    const fico = fastTrack.fieldMappings.find(
      (m) => m.externalKey === "what_is_your_fico_score?",
    )!;

    expect(fico.targetKey).toBe("");
  });

  it("asks one question the other forms do not", () => {
    const extra = fastTrack.fieldMappings.filter(
      (m) => !richCreative.fieldMappings.some((r) => r.targetKey === m.targetKey),
    );

    expect(extra.map((m) => m.targetKey)).toContain("years_in_business");
  });
});

describe("inboundAnswers", () => {
  const answered = contact({ id: "answered" });

  /** Answers are rows now — one per contact per question. */
  const rowsFor = (contactId: string, answers: Record<string, string>): ContactLeadAnswer[] =>
    Object.entries(answers).map(([targetKey, value]) => ({
      id: `${contactId}-${targetKey}`,
      contactId,
      targetKey,
      value,
      answeredAt: "2026-01-01T00:00:00.000Z",
    }));

  const answeredRows = rowsFor("answered", {
    funding_purpose: "Equipment",
    self_reported_fico: "600 – 639",
    requested_amount: "Under $100k",
  });

  it("leaves out core mappings — name and email are already on the record", () => {
    const keys = inboundAnswers(answered, richCreative, answeredRows).map((r) => r.externalKey);

    expect(keys).not.toContain("first_name");
    expect(keys).not.toContain("email");
  });

  it("returns every question the form asked, in form order", () => {
    const rows = inboundAnswers(answered, richCreative, answeredRows);

    expect(rows.map((r) => r.customFieldKey)).toEqual([
      "funding_purpose",
      "funding_timeline",
      "self_reported_fico",
      "requested_amount",
    ]);
  });

  it("keeps unanswered questions with a null answer rather than dropping them", () => {
    const timeline = inboundAnswers(answered, richCreative, answeredRows).find(
      (r) => r.customFieldKey === "funding_timeline",
    );

    expect(timeline?.answer).toBeNull();
    expect(timeline?.question).toBe("What is your timeline for accessing the funds?");
  });

  it("treats a blank string as unanswered", () => {
    const blank = contact({ id: "blank" });
    const blankRows = rowsFor("blank", { funding_purpose: "   " });

    expect(inboundAnswers(blank, richCreative, blankRows)[0].answer).toBeNull();
  });

  it("labels each row with the form's own wording", () => {
    const fast = inboundAnswers(answered, fastTrack, answeredRows).find(
      (r) => r.customFieldKey === "funding_timeline",
    );

    expect(fast?.question).toBe("How quickly do you need access to the funds?");
  });
});

describe("inboundSectionTitle", () => {
  it("names the platform the form belongs to", () => {
    expect(inboundSectionTitle(richCreative)).toBe("Inbound Details — Meta");
  });
});

describe("form lookup", () => {
  it("finds a form by id and by the platform's own ref", () => {
    expect(leadFormById(FORMS, "form-fasttrack-2026")?.name).toBe("2026 FastTrack Form");
    expect(leadFormByExternalRef(FORMS, "meta", richCreative.externalRef)?.id).toBe(
      richCreative.id,
    );
  });

  it("returns nothing for an unknown id, a missing id, or the wrong platform", () => {
    expect(leadFormById(FORMS, undefined)).toBeUndefined();
    expect(leadFormById(FORMS, "nope")).toBeUndefined();
    expect(
      leadFormByExternalRef(FORMS, "google", richCreative.externalRef),
    ).toBeUndefined();
  });
});

describe("submissionCount", () => {
  it("counts every submission, including repeats through the same channel", () => {
    const events = [
      { contactId: "c1" },
      { contactId: "c1" },
      { contactId: "c2" },
    ];
    // The old original-vs-latest comparison reported zero here: two visits through
    // one channel looked identical to never having come back.
    expect(submissionCount("c1", events)).toBe(2);
    expect(submissionCount("c2", events)).toBe(1);
    expect(submissionCount("nobody", events)).toBe(0);
  });
});

describe("conflictingExternalKeys", () => {
  function form(
    id: string,
    mappings: Partial<LeadFormFieldMapping>[],
  ): LeadFormDefinition {
    return {
      id,
      platform: "meta",
      platformAccountId: "acc-1",
      externalRef: id,
      name: id,
      isActive: true,
      fieldMappings: mappings.map((m, index) => ({
        externalKey: "",
        targetKey: "",
        targetKind: "custom",
        order: index + 1,
        ...m,
      })),
    };
  }

  it("does not flag several questions feeding one field — that is the design", () => {
    const conflicts = conflictingExternalKeys([
      form("a", [{ externalKey: "what_is_your_fico®_credit_score?", targetKey: "self_reported_fico" }]),
      form("b", [{ externalKey: "what_is_your_fico_score?", targetKey: "self_reported_fico" }]),
    ]);

    expect(conflicts.size).toBe(0);
  });

  it("flags one question pointed at two different fields", () => {
    const conflicts = conflictingExternalKeys([
      form("a", [{ externalKey: "full_name", targetKey: "firstname", targetKind: "core" }]),
      form("b", [{ externalKey: "full_name", targetKey: "lastname", targetKind: "core" }]),
    ]);

    expect(conflicts.get("full_name")).toEqual(["firstname", "lastname"]);
  });

  it("ignores rows with no destination — they cannot disagree with anything", () => {
    const conflicts = conflictingExternalKeys([
      form("a", [{ externalKey: "q", targetKey: "funding_purpose" }]),
      form("b", [{ externalKey: "q", targetKey: "" }]),
      form("c", [{ externalKey: "q", targetKey: "", isIgnored: true }]),
    ]);

    expect(conflicts.size).toBe(0);
  });

  it("finds the conflict the seed deliberately carries", () => {
    const conflicts = conflictingExternalKeys(FORMS);

    // FastTrack collapses full_name into the first name; the test form sends the
    // same key to the last name. Same question, two columns.
    expect(conflicts.get("full_name")).toEqual(["firstname", "lastname"]);
    expect(
      fastTrack.fieldMappings.find((m) => m.externalKey === "full_name")?.targetKey,
    ).toBe("firstname");
    expect(
      spartanTesting.fieldMappings.find((m) => m.externalKey === "full_name")?.targetKey,
    ).toBe("lastname");
  });

  it("leaves every other seeded question agreed", () => {
    expect([...conflictingExternalKeys(FORMS).keys()]).toEqual(["full_name"]);
  });
});

describe("mappingStatus", () => {
  const conflicts = conflictingExternalKeys(FORMS);
  const row = (overrides: Partial<LeadFormFieldMapping>): LeadFormFieldMapping => ({
    externalKey: "q",
    targetKey: "funding_purpose",
    targetKind: "custom",
    order: 1,
    ...overrides,
  });

  it("reports each of the four states", () => {
    expect(mappingStatus(row({}), conflicts)).toBe("mapped");
    expect(mappingStatus(row({ targetKey: "" }), conflicts)).toBe("unmapped");
    expect(mappingStatus(row({ isIgnored: true }), conflicts)).toBe("ignored");
    expect(
      mappingStatus(row({ externalKey: "full_name", targetKey: "firstname" }), conflicts),
    ).toBe("conflict");
  });

  it("calls an ignored row ignored even when it also has no target", () => {
    expect(mappingStatus(row({ targetKey: "", isIgnored: true }), conflicts)).toBe(
      "ignored",
    );
  });
});

describe("formMappingSummary", () => {
  const conflicts = conflictingExternalKeys(FORMS);

  it("is clean for a fully mapped form", () => {
    expect(formMappingSummary(richCreative, conflicts).status).toBe("mapped");
  });

  it("reports the unmapped question on FastTrack", () => {
    const summary = formMappingSummary(fastTrack, conflicts);

    expect(summary.unmapped).toBe(1);
    expect(summary.conflict).toBe(1); // full_name
    expect(summary.status).toBe("conflict"); // the worse of the two wins
  });

  it("counts a form with no mappings at all as unmapped, not as clean", () => {
    const summary = formMappingSummary(reels, conflicts);

    expect(summary.total).toBe(0);
    expect(summary.status).toBe("unmapped");
  });

  it("counts the deliberately ignored row separately", () => {
    expect(formMappingSummary(spartanTesting, conflicts).ignored).toBe(1);
  });
});

describe("counting from the answer rows", () => {
  /** The form is per ANSWER, not per contact — somebody can answer two of them. */
  const answeredVia = (
    contactId: string,
    leadFormId: string,
    answeredAt: string,
  ): ContactLeadAnswer => ({
    id: `${contactId}-${leadFormId}`,
    contactId,
    targetKey: "funding_purpose",
    value: "Equipment",
    leadFormId,
    answeredAt,
  });

  const contacts = [
    contact({ id: "1" }),
    contact({ id: "2" }),
    contact({ id: "3" }),
    contact({ id: "4" }),
  ];
  const answers = [
    answeredVia("1", "form-a", "2026-03-01T00:00:00.000Z"),
    answeredVia("2", "form-a", "2026-05-20T00:00:00.000Z"),
    answeredVia("3", "form-b", "2026-04-02T00:00:00.000Z"),
  ];

  it("counts one lead per contact per form, even when they answered it twice", () => {
    const twice = [...answers, answeredVia("1", "form-a", "2026-08-01T00:00:00.000Z")];

    expect(leadStatsByForm(contacts, twice).get("form-a")?.leads).toBe(2);
  });

  it("counts leads per form and keeps the newest arrival date", () => {
    const stats = leadStatsByForm(contacts, answers);

    expect(stats.get("form-a")?.leads).toBe(2);
    expect(stats.get("form-a")?.lastLeadAt).toEqual(new Date("2026-05-20"));
    expect(stats.get("form-b")?.leads).toBe(1);
  });

  it("has no entry at all for a form nothing came through", () => {
    // The screen renders "No leads yet" from this absence — never a fabricated 0.
    expect(leadStatsByForm(contacts, answers).get("form-c")).toBeUndefined();
  });

  it("rolls forms up to their account", () => {
    const seeded = [contact({ id: "1" }), contact({ id: "2" })];
    const seededAnswers = [
      answeredVia("1", "form-rich-creative-v2", "2026-06-01T00:00:00.000Z"),
      answeredVia("2", "form-fasttrack-2026", "2026-07-15T00:00:00.000Z"),
    ];
    const stats = platformAccountStats(ACCOUNTS[0], FORMS, seeded, seededAnswers);

    expect(stats.forms).toBe(5);
    expect(stats.leads).toBe(2);
    expect(stats.lastLeadAt).toEqual(new Date("2026-07-15"));
  });

  it("reports an account with no leads as empty rather than stale", () => {
    const stats = platformAccountStats(ACCOUNTS[0], FORMS, [], []);

    expect(stats.leads).toBe(0);
    expect(stats.lastLeadAt).toBeUndefined();
  });
});


// ── Type mismatch: the check the platform's own screen does not make ─────────

describe("type mismatch", () => {
  const definitions: CustomFieldDefinition[] = [
    {
      id: "cfd-purpose",
      key: "funding_purpose",
      label: "Funding purpose",
      type: "select",
      section: "Questionnaire",
      isVisible: true,
      isFilterable: true,
      isAutoDiscovered: false,
      createdAt: new Date("2026-06-01"),
    },
    {
      id: "cfd-years",
      key: "years_in_business",
      label: "Years in business",
      type: "number",
      section: "Questionnaire",
      isVisible: true,
      isFilterable: true,
      isAutoDiscovered: false,
      createdAt: new Date("2026-06-01"),
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

  const mapping = (
    overrides: Partial<LeadFormFieldMapping>,
  ): LeadFormFieldMapping => ({
    externalKey: "q",
    externalType: "Multiple choice",
    targetKey: "funding_purpose",
    targetKind: "custom",
    order: 1,
    ...overrides,
  });

  it("maps each platform input type to the CRM type it belongs in", () => {
    expect(expectedCrmType("Multiple choice")).toBe("select");
    expect(expectedCrmType("Number")).toBe("number");
    expect(expectedCrmType("Short answer")).toBe("text");
    expect(expectedCrmType("Email")).toBe("text");
    expect(expectedCrmType(undefined)).toBeUndefined();
  });

  it("reads the type of a core target as well as a custom one", () => {
    expect(
      targetFieldType(mapping({ targetKey: "email", targetKind: "core" }), definitions),
    ).toBe("text");
    expect(targetFieldType(mapping({}), definitions)).toBe("select");
  });

  it("is quiet when the shapes agree", () => {
    expect(hasTypeMismatch(mapping({}), definitions)).toBe(false);
    expect(
      hasTypeMismatch(
        mapping({ externalType: "Short answer", targetKey: "email", targetKind: "core" }),
        definitions,
      ),
    ).toBe(false);
  });

  it("flags a multiple choice landing in free text", () => {
    // The option set is gone, and nothing errors — the exact case the platform
    // reports as a healthy mapping.
    expect(
      hasTypeMismatch(mapping({ targetKey: "industry" }), definitions),
    ).toBe(true);
  });

  it("flags a number landing in a picker", () => {
    expect(
      hasTypeMismatch(
        mapping({ externalType: "Number", targetKey: "funding_purpose" }),
        definitions,
      ),
    ).toBe(true);
  });

  it("says nothing about a row with no destination", () => {
    expect(hasTypeMismatch(mapping({ targetKey: "" }), definitions)).toBe(false);
    expect(hasTypeMismatch(mapping({ isIgnored: true }), definitions)).toBe(false);
  });

  it("says nothing when the platform did not send a type", () => {
    expect(
      hasTypeMismatch(mapping({ externalType: undefined, targetKey: "industry" }), definitions),
    ).toBe(false);
  });

  it("ranks a cross-form conflict above a type mismatch", () => {
    const conflicts = new Map([["q", ["a", "b"]]]);

    expect(
      mappingStatus(mapping({ targetKey: "industry" }), conflicts, definitions),
    ).toBe("conflict");
  });

  it("reports the mismatch the seed deliberately carries", () => {
    // The V2/V3 forms ask for a typed amount; requested_amount is a band picker.
    const conflicts = conflictingExternalKeys(FORMS);
    const amount = richCreative.fieldMappings.find(
      (m) => m.targetKey === "requested_amount",
    )!;

    expect(amount.externalType).toBe("Number");
    expect(
      mappingStatus(amount, conflicts, [
        {
          id: "cfd-amount",
          key: "requested_amount",
          label: "Requested amount",
          type: "select",
          section: "Questionnaire",
          isVisible: true,
          isFilterable: true,
          isAutoDiscovered: false,
          createdAt: new Date("2026-06-01"),
        },
      ]),
    ).toBe("type-mismatch");
  });

  it("still shows all three of OK, Not mapped and Type mismatch on one form", () => {
    // Against the real definitions, not a stub: this is the seeded demo state.
    const conflicts = new Map<string, string[]>();
    const statuses = fastTrack.fieldMappings.map((m) =>
      mappingStatus(m, conflicts, SEEDED_FIELDS),
    );

    expect(statuses).toContain("mapped");
    expect(statuses).toContain("unmapped");
    expect(statuses).toContain("type-mismatch");
  });
});

// ── Who a submission belongs to ──────────────────────────────────────────────

describe("resolveSubmissionIdentity", () => {
  it("uses the email whenever there is one", () => {
    expect(resolveSubmissionIdentity({ email: "a@b.com", phone: "555" }).kind).toBe("email");
  });

  it("skips a phone-only submission — there is no fallback and no switch", () => {
    // contacts.email is NOT NULL and unique, so a phone-only contact cannot exist.
    const resolved = resolveSubmissionIdentity({ phone: "(555) 480-2210" });

    expect(resolved.kind).toBe("none");
    expect(resolved.reason).toContain("phone number was sent");
  });

  it("skips a submission carrying neither", () => {
    expect(resolveSubmissionIdentity({}).kind).toBe("none");
    expect(resolveSubmissionIdentity({ email: "  " }).kind).toBe("none");
  });
});

describe("findContactByIdentity", () => {
  const people = [
    contact({ id: "1", email: "Dana@Example.com", phone: "(555) 480-2210" }),
    contact({ id: "2", email: "other@example.com", phone: "555-111-2222" }),
  ];

  it("matches an email regardless of case", () => {
    const identity = resolveSubmissionIdentity({ email: "dana@example.com" });

    expect(findContactByIdentity(identity, people)?.id).toBe("1");
  });

  it("never matches on a phone number", () => {
    const identity = resolveSubmissionIdentity({ phone: "5554802210" });

    expect(findContactByIdentity(identity, people)).toBeUndefined();
  });

  it("matches nobody for a skipped submission", () => {
    const identity = resolveSubmissionIdentity({});

    expect(findContactByIdentity(identity, people)).toBeUndefined();
  });
});

describe("accountLastSyncedAt", () => {
  it("takes the newest sync across the account's forms", () => {
    // Derived, not stored: the account does not sync, its forms do.
    const latest = accountLastSyncedAt(ACCOUNTS[0], FORMS);
    const expected = FORMS.map((f) =>
      new Date(f.submissionsLastSyncedAt!).getTime(),
    ).sort((a, b) => b - a)[0];

    expect(latest?.getTime()).toBe(expected);
  });

  it("is undefined for an account whose forms never synced", () => {
    const never = FORMS.map((f) => ({ ...f, submissionsLastSyncedAt: undefined }));

    expect(accountLastSyncedAt(ACCOUNTS[0], never)).toBeUndefined();
  });
});
