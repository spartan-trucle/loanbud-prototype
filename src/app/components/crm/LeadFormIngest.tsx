import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useAppData } from "@/app/contexts/AppDataContext";
import {
  trafficSourceFromUtm,
  trafficSourceLabel,
  trafficSourceTone,
} from "@/app/data/trafficSources";
import type { LeadIngestResult } from "@/app/types";

interface AnswerRow {
  key: string;
  value: string;
}

const STARTER_ANSWERS: AnswerRow[] = [
  { key: "funding_purpose", value: "Equipment" },
  { key: "budget_range", value: "$250k – $500k" },
  { key: "timeline", value: "2 – 4 weeks" },
  { key: "monthly_revenue", value: "$85,000" },
];

/**
 * Simulates a marketing form posting into the CRM's lead-ingest endpoint.
 *
 * The point of the screen is the right-hand panel: it shows that a brand-new form,
 * with questions nobody registered in advance, still lands as a fully attributed
 * contact — traffic source resolved from UTM, campaign found or created, unknown
 * answers captured as hidden fields awaiting an admin's approval.
 */
export function LeadFormIngest() {
  const navigate = useNavigate();
  const { handleIngestLeadForm, campaigns } = useAppData();

  const [formName, setFormName] = useState("SBA equipment questionnaire");
  const [firstName, setFirstName] = useState("Dana");
  const [lastName, setLastName] = useState("Whitfield");
  const [email, setEmail] = useState("dana.whitfield@example.com");
  const [phone, setPhone] = useState("(555) 480-2210");
  const [utmSource, setUtmSource] = useState("facebook");
  const [utmMedium, setUtmMedium] = useState("paid_social");
  const [utmCampaign, setUtmCampaign] = useState("summer_sba_2026");
  const [utmContent, setUtmContent] = useState("carousel_equipment_v2");
  const [answers, setAnswers] = useState<AnswerRow[]>(STARTER_ANSWERS);
  const [result, setResult] = useState<LeadIngestResult | null>(null);

  const previewSource = trafficSourceFromUtm(utmSource, utmMedium);
  const campaignExists = campaigns.some(
    (c) => c.utmCampaign.toLowerCase() === utmCampaign.trim().toLowerCase(),
  );

  const setAnswer = (index: number, patch: Partial<AnswerRow>) =>
    setAnswers((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  const canSubmit =
    firstName.trim() && lastName.trim() && email.trim().includes("@");

  const submit = () => {
    if (!canSubmit) return;
    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      formName: formName.trim() || "web_form",
      answers: Object.fromEntries(
        answers
          .filter((row) => row.key.trim() && row.value.trim())
          .map((row) => [row.key.trim(), row.value.trim()]),
      ),
      utmSource: utmSource.trim(),
      utmMedium: utmMedium.trim(),
      utmCampaign: utmCampaign.trim(),
      utmContent: utmContent.trim(),
    };
    setResult(handleIngestLeadForm(payload));
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
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-2">
          {/* ── The form ─────────────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-5">
            <div>
              <h3 className="text-sm font-semibold">Form submission</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                What the landing page sends
              </p>
            </div>

            <Field label="Form name" value={formName} onChange={setFormName} />

            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" value={firstName} onChange={setFirstName} />
              <Field label="Last name" value={lastName} onChange={setLastName} />
            </div>
            <Field label="Email" value={email} onChange={setEmail} />
            <Field label="Phone" value={phone} onChange={setPhone} />

            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <Label>Questionnaire answers</Label>
                <Button
                  variant="ghost"
                  className="h-8 text-sm"
                  onClick={() => setAnswers((rows) => [...rows, { key: "", value: "" }])}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {answers.map((row, index) => (
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
                        setAnswers((rows) => rows.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

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
                  className={`inline-flex px-2 py-0.5 rounded-full border ${trafficSourceTone(previewSource)}`}
                >
                  {trafficSourceLabel(previewSource)}
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

            <Button disabled={!canSubmit} onClick={submit} className="w-full">
              <Send className="w-4 h-4 mr-1.5" />
              Submit to CRM
            </Button>
          </div>

          {/* ── What the CRM did ─────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-sm font-semibold">What the CRM did</h3>

            {!result ? (
              <p className="text-sm text-muted-foreground mt-4">
                Submit the form to see how the contact is created and attributed.
              </p>
            ) : (
              <div className="mt-4 space-y-5">
                <Outcome label="Contact created">
                  <button
                    className="text-sm font-semibold text-blue-600"
                    onClick={() => navigate(`/crm/contacts/${result.contact.id}`)}
                  >
                    {result.contact.firstName} {result.contact.lastName}
                    <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
                  </button>
                </Outcome>

                <Outcome label="Original traffic source">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full border text-xs ${trafficSourceTone(result.trafficSource)}`}
                  >
                    {trafficSourceLabel(result.trafficSource)}
                  </span>
                </Outcome>

                <Outcome label="Campaign">
                  {result.campaignId ? (
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
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      No utm_campaign sent
                    </span>
                  )}
                </Outcome>

                <Outcome label="Questionnaire answers stored">
                  <div className="space-y-1">
                    {Object.entries(result.contact.customFields ?? {}).map(
                      ([key, value]) => (
                        <div key={key} className="text-sm">
                          <code className="text-xs text-muted-foreground">{key}</code>
                          <span className="mx-1.5 text-muted-foreground">→</span>
                          {value}
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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
