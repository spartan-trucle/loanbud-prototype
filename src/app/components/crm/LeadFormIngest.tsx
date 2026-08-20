import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Info, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useAppData } from "@/app/contexts/AppDataContext";
import {
  META_LEAD_FORMS,
  META_PLATFORMS,
  findCampaignByExternalId,
  metaFormById,
  metaLeadAttribution,
  type MetaAttribution,
} from "@/app/data/metaLeadAds";
import {
  resolveSubmissionIdentity,
  type ResolvedIdentity,
} from "@/app/data/leadFormUtils";
import {
  leadSourceFromUtm,
  leadSourceLabel,
  leadSourceTone,
} from "@/app/data/attribution";
import type { LeadIngestResult, MetaLeadPayload, MetaPlatform } from "@/app/types";
import { answersForContact } from "@/app/data/contactLeadAnswers";

interface AnswerRow {
  key: string;
  value: string;
}

/** Which ingest adapter the screen is demonstrating. */
type IngestMode = "web" | "meta";

const MODES: { id: IngestMode; label: string; hint: string }[] = [
  { id: "web", label: "Web form (UTM)", hint: "Landing page on a domain we control" },
  { id: "meta", label: "Meta Lead Ads", hint: "Instant Form inside Facebook / Instagram" },
];

const STARTER_ANSWERS: AnswerRow[] = [
  { key: "funding_purpose", value: "Equipment" },
  { key: "requested_amount", value: "$250k – $500k" },
  { key: "funding_timeline", value: "2 – 4 weeks" },
  { key: "monthly_revenue", value: "$85,000" },
];

/** Meta's Instant Forms ask fewer, blunter questions than a landing page does. */
const META_STARTER_ANSWERS: AnswerRow[] = [
  { key: "self_reported_fico", value: "600 – 639" },
  { key: "requested_amount", value: "Under $100k" },
  { key: "funding_timeline", value: "4 weeks+" },
  { key: "business_age_months", value: "9" },
];

const DEFAULT_FORM = META_LEAD_FORMS[0];

/**
 * Simulates a marketing form posting into the CRM's lead-ingest endpoint.
 *
 * Two adapters, because the two biggest lead sources do not work the same way:
 *
 *  – A web form loads a URL we control, so it can carry `utm_*`.
 *  – A Meta Instant Form opens inside Facebook or Instagram. The lead never leaves
 *    the app, no URL of ours is ever loaded, and there is no UTM to read — Meta
 *    posts its own ids instead. Showing only the UTM flow would misrepresent where
 *    most of LoanBud's leads actually come from.
 *
 * The point of the screen is the right-hand panel either way: a brand-new form, with
 * questions nobody registered in advance, still lands as a fully attributed contact.
 */
export function LeadFormIngest() {
  const navigate = useNavigate();
  const {
    handleIngestLeadForm,
    handleIngestMetaLead,
    campaigns,
    contactLeadAnswers,
  } = useAppData();

  const [mode, setMode] = useState<IngestMode>("web");
  const [result, setResult] = useState<LeadIngestResult | null>(null);
  // Frozen at submit time: the panel must explain the lead that was ingested, not
  // whatever the form has been edited to say since.
  const [submitted, setSubmitted] = useState<MetaAttribution | null>(null);
  const [submittedIdentity, setSubmittedIdentity] =
    useState<ResolvedIdentity | null>(null);

  // Shared contact fields
  const [firstName, setFirstName] = useState("Dana");
  const [lastName, setLastName] = useState("Whitfield");
  const [email, setEmail] = useState("dana.whitfield@example.com");
  const [phone, setPhone] = useState("(555) 480-2210");

  // Web form mode
  const [formName, setFormName] = useState("SBA equipment questionnaire");
  const [utmSource, setUtmSource] = useState("facebook");
  const [utmMedium, setUtmMedium] = useState("paid_social");
  const [utmCampaign, setUtmCampaign] = useState("summer_sba_2026");
  const [utmContent, setUtmContent] = useState("carousel_equipment_v2");
  const [answers, setAnswers] = useState<AnswerRow[]>(STARTER_ANSWERS);

  // Meta Lead Ads mode — ids, no UTM anywhere
  const [metaFormId, setMetaFormId] = useState(DEFAULT_FORM.id);
  const [metaFormName, setMetaFormName] = useState(DEFAULT_FORM.name);
  const [metaCampaignId, setMetaCampaignId] = useState(
    DEFAULT_FORM.defaultCampaignId ?? "",
  );
  const [metaCampaignName, setMetaCampaignName] = useState(
    DEFAULT_FORM.defaultCampaignName ?? "",
  );
  const [metaAdsetId, setMetaAdsetId] = useState(DEFAULT_FORM.defaultAdsetId ?? "");
  const [metaAdsetName, setMetaAdsetName] = useState(
    DEFAULT_FORM.defaultAdsetName ?? "",
  );
  const [metaAdId, setMetaAdId] = useState(DEFAULT_FORM.defaultAdId ?? "");
  const [metaAdName, setMetaAdName] = useState(DEFAULT_FORM.defaultAdName ?? "");
  const [metaPlatform, setMetaPlatform] = useState<MetaPlatform>("facebook");
  const [isOrganic, setIsOrganic] = useState(false);
  const [metaAnswers, setMetaAnswers] = useState<AnswerRow[]>(META_STARTER_ANSWERS);

  const isMeta = mode === "meta";
  const activeAnswers = isMeta ? metaAnswers : answers;
  const setActiveAnswers = isMeta ? setMetaAnswers : setAnswers;

  const metaPayload: MetaLeadPayload = {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim(),
    phone: phone.trim(),
    formId: metaFormId,
    formName: metaFormName,
    campaignId: metaCampaignId.trim(),
    campaignName: metaCampaignName.trim(),
    adsetId: metaAdsetId.trim(),
    adsetName: metaAdsetName.trim(),
    adId: metaAdId.trim(),
    adName: metaAdName.trim(),
    platform: metaPlatform,
    isOrganic,
    answers: toAnswerMap(metaAnswers),
  };

  const metaAttribution = metaLeadAttribution(metaPayload);
  const metaCampaignMatch = findCampaignByExternalId(
    campaigns,
    "meta",
    metaCampaignId.trim(),
  );

  const previewSource = isMeta
    ? metaAttribution.leadSource
    : leadSourceFromUtm(utmSource, utmMedium);

  const campaignExists = campaigns.some(
    (c) => c.utmCampaign.toLowerCase() === utmCampaign.trim().toLowerCase(),
  );

  const selectForm = (id: string) => {
    const form = metaFormById(id);
    if (!form) return;
    setMetaFormId(form.id);
    setMetaFormName(form.name);
    setMetaCampaignId(form.defaultCampaignId ?? "");
    setMetaCampaignName(form.defaultCampaignName ?? "");
    setMetaAdsetId(form.defaultAdsetId ?? "");
    setMetaAdsetName(form.defaultAdsetName ?? "");
    setMetaAdId(form.defaultAdId ?? "");
    setMetaAdName(form.defaultAdName ?? "");
  };

  const switchMode = (next: IngestMode) => {
    setMode(next);
    // The panels describe different mechanics — never leave one showing under the other.
    setResult(null);
    setSubmitted(null);
    setSubmittedIdentity(null);
  };

  const setAnswer = (index: number, patch: Partial<AnswerRow>) =>
    setActiveAnswers((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  // A lead ad can arrive with no email at all; the web form still requires one.
  const canSubmit = Boolean(
    firstName.trim() &&
      lastName.trim() &&
      (isMeta ? email.trim() || phone.trim() : email.trim().includes("@")),
  );

  const submit = () => {
    if (!canSubmit) return;

    if (isMeta) {
      setSubmitted(metaAttribution);
      setSubmittedIdentity(
        resolveSubmissionIdentity({ email: metaPayload.email, phone: metaPayload.phone }),
      );
      setResult(handleIngestMetaLead(metaPayload));
      return;
    }

    setSubmitted(null);
    setSubmittedIdentity({
      kind: "email",
      value: email.trim(),
      reason: "Matched on the email address.",
    });
    setResult(
      handleIngestLeadForm({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        formName: formName.trim() || "web_form",
        answers: toAnswerMap(answers),
        utmSource: utmSource.trim(),
        utmMedium: utmMedium.trim(),
        utmCampaign: utmCampaign.trim(),
        utmContent: utmContent.trim(),
      }),
    );
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border bg-card px-8 py-6">
        <h2
          className="text-3xl"
          style={{ fontFamily: "var(--font-sans)", fontWeight: 600 }}
        >
          Lead form ingest
        </h2>
        <p className="text-muted-foreground mt-1">
          A marketing form posting into the CRM. No engineering change is needed when a
          new form goes live with new questions.
        </p>

        <div className="mt-4 inline-flex rounded-lg border border-border bg-muted/40 p-1">
          {MODES.map((option) => (
            <button
              key={option.id}
              onClick={() => switchMode(option.id)}
              className={`px-4 py-2 rounded-md text-sm text-left transition-colors ${
                mode === option.id
                  ? "bg-card border border-border shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={mode === option.id ? "font-semibold" : undefined}>
                {option.label}
              </span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                {option.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-2">
          {/* ── The submission ───────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-5">
            <div>
              <h3 className="text-sm font-semibold">
                {isMeta ? "Lead Ads webhook payload" : "Form submission"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isMeta
                  ? "What Meta posts when someone submits an Instant Form"
                  : "What the landing page sends"}
              </p>
            </div>

            {isMeta ? (
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  form_id — Instant Form
                </Label>
                <Select value={metaFormId} onValueChange={selectForm}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {META_LEAD_FORMS.map((form) => (
                      <SelectItem key={form.id} value={form.id}>
                        {form.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <code className="text-xs text-muted-foreground">{metaFormId}</code>
              </div>
            ) : (
              <Field label="Form name" value={formName} onChange={setFormName} />
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" value={firstName} onChange={setFirstName} />
              <Field label="Last name" value={lastName} onChange={setLastName} />
            </div>
            <Field label="Email" value={email} onChange={setEmail} />
            <Field label="Phone" value={phone} onChange={setPhone} />

            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <Label>{isMeta ? "Instant Form answers" : "Questionnaire answers"}</Label>
                <Button
                  variant="ghost"
                  className="h-8 text-sm"
                  onClick={() =>
                    setActiveAnswers((rows) => [...rows, { key: "", value: "" }])
                  }
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {activeAnswers.map((row, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={row.key}
                      placeholder="field_key"
                      className="font-mono text-xs"
                      onChange={(e) => setAnswer(index, { key: e.target.value })}
                    />
                    <Input
                      value={row.value}
                      placeholder="answer"
                      onChange={(e) => setAnswer(index, { value: e.target.value })}
                    />
                    <Button
                      variant="ghost"
                      className="h-9 w-9 p-0 shrink-0"
                      onClick={() =>
                        setActiveAnswers((rows) => rows.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {isMeta ? (
              <div className="pt-2 border-t border-border space-y-3">
                <div>
                  <Label>Meta attribution ids</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    No <code>utm_*</code> field exists on this payload — there is no URL
                    to put one on.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="campaign_id" value={metaCampaignId} onChange={setMetaCampaignId} mono />
                  <Field label="campaign_name" value={metaCampaignName} onChange={setMetaCampaignName} />
                  <Field label="adset_id" value={metaAdsetId} onChange={setMetaAdsetId} mono />
                  <Field label="adset_name" value={metaAdsetName} onChange={setMetaAdsetName} />
                  <Field label="ad_id" value={metaAdId} onChange={setMetaAdId} mono />
                  <Field label="ad_name" value={metaAdName} onChange={setMetaAdName} />
                </div>

                <div className="grid grid-cols-2 gap-3 items-end">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">platform</Label>
                    <Select
                      value={metaPlatform}
                      onValueChange={(v) => setMetaPlatform(v as MetaPlatform)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {META_PLATFORMS.map((platform) => (
                          <SelectItem key={platform.id} value={platform.id}>
                            {platform.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-center gap-2 h-9 cursor-pointer">
                    <Checkbox
                      checked={isOrganic}
                      onCheckedChange={(checked) => setIsOrganic(checked === true)}
                    />
                    <span className="text-sm">
                      is_organic
                      <span className="block text-xs text-muted-foreground">
                        Opened from an unpaid post
                      </span>
                    </span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Resolves to</span>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full border ${leadSourceTone(previewSource)}`}
                  >
                    {leadSourceLabel(previewSource)}
                  </span>
                  <span>·</span>
                  <span>
                    {metaCampaignId.trim()
                      ? metaCampaignMatch
                        ? `matches ${metaCampaignMatch.name} by campaign_id`
                        : "campaign will be created from this id"
                      : "no campaign_id sent"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-border space-y-3">
                <Label>UTM parameters</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="utm_source" value={utmSource} onChange={setUtmSource} mono />
                  <Field label="utm_medium" value={utmMedium} onChange={setUtmMedium} mono />
                  <Field
                    label="utm_campaign"
                    value={utmCampaign}
                    onChange={setUtmCampaign}
                    mono
                  />
                  <Field
                    label="utm_content"
                    value={utmContent}
                    onChange={setUtmContent}
                    mono
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Resolves to</span>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full border ${leadSourceTone(previewSource)}`}
                  >
                    {leadSourceLabel(previewSource)}
                  </span>
                  <span>·</span>
                  <span>
                    {utmCampaign.trim()
                      ? campaignExists
                        ? "campaign already exists"
                        : "campaign will be created"
                      : "no campaign"}
                  </span>
                </div>
              </div>
            )}

            <Button disabled={!canSubmit} onClick={submit} className="w-full">
              <Send className="w-4 h-4 mr-1.5" />
              {isMeta ? "Deliver webhook to CRM" : "Submit to CRM"}
            </Button>
          </div>

          {/* ── What the CRM did ─────────────────────────────────────── */}
          <div className="space-y-3">
            {isMeta && (
              <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
                <Info className="w-4 h-4 text-sky-700 mt-0.5 shrink-0" />
                <p className="text-xs text-sky-900">
                  Meta Lead Ads sends ids, not UTMs — this is why each platform needs
                  its own adapter.
                </p>
              </div>
            )}

            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-sm font-semibold">What the CRM did</h3>

              {!result ? (
                <p className="text-sm text-muted-foreground mt-4">
                  {isMeta
                    ? "Deliver the webhook to see how the contact is created and attributed."
                    : "Submit the form to see how the contact is created and attributed."}
                </p>
              ) : (
                <div className="mt-4 space-y-5">
                  {result.skipped || !result.contact ? (
                    <Outcome label="No contact created">
                      <p className="text-sm text-amber-800">
                        Kept as a raw event with status &ldquo;skipped&rdquo;.
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {submittedIdentity?.reason}
                      </p>
                    </Outcome>
                  ) : (
                    <Outcome
                      label={
                        result.isReturningContact
                          ? "Existing contact updated"
                          : "Contact created"
                      }
                    >
                      <button
                        className="text-sm font-semibold text-blue-600"
                        onClick={() => navigate(`/crm/contacts/${result.contact!.id}`)}
                      >
                        {result.contact.firstName} {result.contact.lastName}
                        <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
                      </button>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {result.isReturningContact
                          ? "This identity already existed, so the original traffic source was left alone and the latest one was updated instead."
                          : submittedIdentity?.reason}
                      </p>
                    </Outcome>
                  )}

                  {result.contact && (
                  <>
                  <Outcome
                    label={
                      result.isReturningContact
                        ? "Latest traffic source"
                        : "Original traffic source"
                    }
                  >
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full border text-xs ${leadSourceTone(result.leadSource)}`}
                    >
                      {leadSourceLabel(result.leadSource)}
                    </span>
                    {submitted && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {submitted.leadSourceReason}
                      </p>
                    )}
                  </Outcome>

                  {submitted && (
                    <>
                      <Outcome label="Created by">
                        <div className="text-sm">
                          {result.contact?.attributionSource ?? "—"}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Written once, at create. There is no update path for it, so
                          it cannot drift.
                        </p>
                      </Outcome>

                      <Outcome label="Lead source stored">
                        <div className="text-sm">
                          {leadSourceLabel(result.contact?.leadSource)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {result.leadSourceKept
                            ? `This submission resolved to "${leadSourceLabel(result.leadSource)}", but the contact already had an origin — first touch wins, so nothing was overwritten.`
                            : "First touch. A later submission through another channel will not change it."}
                        </p>
                      </Outcome>
                    </>
                  )}

                  <Outcome label="Campaign">
                    {result.campaignId ? (
                      <>
                        <button
                          className="text-sm text-blue-600"
                          onClick={() => navigate(`/crm/campaigns/${result.campaignId}`)}
                        >
                          {campaigns.find((c) => c.id === result.campaignId)?.name ??
                            result.campaignId}
                          {result.campaignCreated && (
                            <span className="ml-2 text-xs text-emerald-700">
                              created automatically
                            </span>
                          )}
                        </button>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {result.campaignMatchedBy === "meta_campaign_id" ? (
                            <>
                              Matched on <code>campaign_id</code>{" "}
                              <code>{result.campaignMatchValue}</code> against the
                              campaign's external refs — never on the campaign name,
                              which changes whenever someone renames it in Ads Manager.
                            </>
                          ) : (
                            <>
                              Matched on <code>utm_campaign</code>{" "}
                              <code>{result.campaignMatchValue}</code>.
                            </>
                          )}
                        </p>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {isMeta ? "No campaign_id sent" : "No utm_campaign sent"}
                      </span>
                    )}
                  </Outcome>

                  <Outcome label="Questionnaire answers stored">
                    <div className="space-y-1">
                      {answersForContact(result.contact.id, contactLeadAnswers).map(
                        (answer) => (
                          <div key={answer.targetKey} className="text-sm">
                            <code className="text-xs text-muted-foreground">
                              {answer.targetKey}
                            </code>
                            <span className="mx-1.5 text-muted-foreground">→</span>
                            {answer.value}
                            {answer.valueMin !== undefined && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                [{answer.valueMin}
                                {answer.valueMax !== undefined && answer.valueMax !== answer.valueMin
                                  ? `–${answer.valueMax}`
                                  : ""}
                                ]
                              </span>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </Outcome>

                  <Outcome label="New fields discovered">
                    {result.discoveredKeys.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          {result.discoveredKeys.map((key) => (
                            <code
                              key={key}
                              className="px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800 text-xs"
                            >
                              {key}
                            </code>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Stored and hidden by default. Turn them on in CRM Settings →
                          Custom fields to show them on the contact tab.
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Every key was already defined
                      </span>
                    )}
                  </Outcome>
                  </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Rows with a blank key or value are dropped — an empty answer is not an answer. */
function toAnswerMap(rows: AnswerRow[]): Record<string, string> {
  return Object.fromEntries(
    rows
      .filter((row) => row.key.trim() && row.value.trim())
      .map((row) => [row.key.trim(), row.value.trim()]),
  );
}

function Field({
  label,
  value,
  onChange,
  mono,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={mono ? "font-mono text-xs" : undefined}
      />
    </div>
  );
}

function Outcome({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}
