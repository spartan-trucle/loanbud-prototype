import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, ChevronRight, Copy, Pencil } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "../../ui/button";
import { useAppData } from "@/app/contexts/AppDataContext";
import { contactsInCampaign, webCampaignKey } from "@/app/data/campaignUtils";
import { activeFields } from "@/app/data/customFieldUsage";
import {
  formatCurrency,
  formatPercent,
  funnelFromMembers,
  leadQualityBreakdown,
  leadsByWeek,
  mostRecentLeadAt,
  platformSplit,
  type CampaignFunnel,
  type LeadWeek,
} from "@/app/data/campaignMetrics";
import {
  leadSourceLabel,
  leadSourceTone,
} from "@/app/data/attribution";
import type { Contact } from "@/app/types";
import { CampaignFormModal } from "./CampaignFormModal";

const TH_CLASS = "px-6 py-3 text-left text-sm text-muted-foreground";
const TH_STYLE = { fontFamily: "var(--font-sans)", fontWeight: 600 } as const;
const CARD_CLASS = "bg-card border border-border rounded-lg";
const HEADING_CLASS = "text-sm font-semibold";

export function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { campaigns, contacts, applications, customFieldDefinitions, contactLeadAnswers } =
    useAppData();
  const [editOpen, setEditOpen] = useState(false);

  const campaign = campaigns.find((c) => c.id === id);
  const members = useMemo(
    () => (campaign ? contactsInCampaign(campaign.id, contacts) : []),
    [campaign, contacts],
  );

  const funnel = useMemo(
    () =>
      campaign ? funnelFromMembers(campaign.id, members, applications) : undefined,
    [campaign, members, applications],
  );

  const quality = useMemo(
    // Archived fields drop out of the breakdown along with everywhere else.
    () => leadQualityBreakdown(members, activeFields(customFieldDefinitions), contactLeadAnswers),
    [members, customFieldDefinitions, contactLeadAnswers],
  );

  const platforms = useMemo(
    () => (campaign ? platformSplit(campaign) : []),
    [campaign],
  );

  // A campaign can pull traffic from more than one source — that is exactly why
  // campaigns are their own object rather than a node under one channel.
  const bySource = useMemo(() => {
    const counts = new Map<string, number>();
    for (const contact of members) {
      const label = leadSourceLabel(contact.leadSource);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [members]);

  if (!campaign || !funnel) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>Campaign not found</p>
        <Button variant="outline" onClick={() => navigate("/crm/campaigns")}>
          Back to campaigns
        </Button>
      </div>
    );
  }

  const webKey = webCampaignKey(campaign);
  const trackingLink = webKey
    ? `https://apply.loanbud.com/?utm_campaign=${webKey}`
    : undefined;

  const copyLink = () => {
    if (!trackingLink) return;
    navigator.clipboard
      .writeText(trackingLink)
      .then(() => toast.success("Tracking link copied"))
      .catch(() => toast.error("Could not copy the link"));
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border bg-card px-8 py-6">
        <button
          onClick={() => navigate("/crm/campaigns")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Campaigns
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h2
              className="text-3xl"
              style={{ fontFamily: "var(--font-sans)", fontWeight: 600 }}
            >
              {campaign.name}
            </h2>
            {campaign.description && (
              <p className="text-muted-foreground mt-1">{campaign.description}</p>
            )}
          </div>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="w-4 h-4 mr-1.5" />
            Edit
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-6 mt-5">
          <Stat label="Status" value={campaign.status} />
          <Stat label="Funded loans" value={String(funnel.funded)} />
          <Stat
            label="Funded amount"
            value={formatCurrency(funnel.fundedAmount)}
          />
          <Stat
            label="Running"
            value={
              (campaign.startDate?.toLocaleDateString() ?? "—") +
              (campaign.endDate ? ` – ${campaign.endDate.toLocaleDateString()}` : "")
            }
          />
        </div>

        {trackingLink && (
          <div className="mt-5 flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
              {trackingLink}
            </code>
            <Button variant="outline" className="h-9" onClick={copyLink}>
              <Copy className="w-4 h-4 mr-1.5" />
              Copy link
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="space-y-6">
          <FunnelCard funnel={funnel} />

          <LeadVolumeCard members={members} />

          <LeadQualityCard quality={quality} memberCount={members.length} />

          {platforms.length > 0 && <PlatformCard platforms={platforms} />}

          {bySource.length > 0 && (
            <div className={`${CARD_CLASS} p-5`}>
              <h3 className={`${HEADING_CLASS} mb-3`}>Traffic sources</h3>
              <div className="flex flex-wrap gap-2">
                {bySource.map(([label, count]) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-muted/40 text-sm"
                  >
                    {label}
                    <span className="text-muted-foreground">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className={`${CARD_CLASS} overflow-hidden`}>
            <div className="px-6 py-4 border-b border-border">
              <h3 className={HEADING_CLASS}>Attributed contacts</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className={TH_CLASS} style={TH_STYLE}>Name</th>
                    <th className={TH_CLASS} style={TH_STYLE}>Email</th>
                    <th className={TH_CLASS} style={TH_STYLE}>Traffic source</th>
                    <th className={TH_CLASS} style={TH_STYLE}>Assignee</th>
                    <th className={TH_CLASS} style={TH_STYLE}>Created at</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((contact) => {
                    const trafficSource = contact.leadSource;
                    return (
                      <tr
                        key={contact.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/crm/contacts/${contact.id}`)}
                      >
                        <td className="px-6 py-3 text-sm font-semibold text-primary">
                          {contact.firstName} {contact.lastName}
                        </td>
                        <td className="px-6 py-3 text-sm text-primary">
                          {contact.email}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full border text-xs whitespace-nowrap ${leadSourceTone(trafficSource)}`}
                          >
                            {leadSourceLabel(trafficSource)}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm">
                          {contact.loanOfficer ?? (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-sm">
                          {contact.createAt?.toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {members.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <p>No contacts attributed to this campaign yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <CampaignFormModal
        open={editOpen}
        onOpenChange={setEditOpen}
        campaign={campaign}
      />
    </div>
  );
}

/** Leads → Applications → Funded, with the drop-off between each step. */
function FunnelCard({ funnel }: { funnel: CampaignFunnel }) {
  return (
    <div className={`${CARD_CLASS} p-5`}>
      <h3 className={`${HEADING_CLASS} mb-1`}>Conversion funnel</h3>
      <p className="text-xs text-muted-foreground mb-4">
        How far this campaign's leads actually got.
      </p>

      <div className="flex flex-wrap items-stretch gap-y-4">
        <FunnelStep label="Leads" value={funnel.leads} of={funnel.leads} />
        <StepArrow rate={funnel.leadToApplication} />
        <FunnelStep
          label="Applications"
          value={funnel.applications}
          of={funnel.leads}
        />
        <StepArrow rate={funnel.applicationToFunded} />
        <FunnelStep label="Funded" value={funnel.funded} of={funnel.leads} emphasis />
      </div>
    </div>
  );
}

/**
 * One step, drawn to scale against the lead count.
 *
 * The bar carries the reading the three numbers do not: 120 → 14 → 3 is a cliff, and
 * printed as digits it looks like a list. Widths are all measured against Leads, not
 * against the previous step, so the bars shrink the way the funnel actually does.
 */
function FunnelStep({
  label,
  value,
  of,
  emphasis,
}: {
  label: string;
  value: number;
  of: number;
  emphasis?: boolean;
}) {
  const share = of > 0 ? value / of : 0;

  return (
    <div className="min-w-[132px] flex-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`text-2xl mt-0.5 tabular-nums ${emphasis ? "text-primary" : ""}`}
        style={{ fontFamily: "var(--font-sans)", fontWeight: 600 }}
      >
        {value}
      </div>
      <div className="mt-2 mr-4 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${emphasis ? "bg-primary" : "bg-primary/40"}`}
          style={{ width: `${Math.round(share * 100)}%` }}
        />
      </div>
    </div>
  );
}

function StepArrow({ rate }: { rate?: number }) {
  return (
    <div className="flex flex-col items-center justify-start px-3 pt-5 shrink-0">
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
      <div className="text-xs text-muted-foreground mt-1 tabular-nums">
        {rate === undefined ? "" : formatPercent(rate)}
      </div>
    </div>
  );
}

const VOLUME_WEEKS = 12;

/**
 * Leads per week — the only thing on this page that is not a running total.
 *
 * Everything else answers "how did this campaign do overall", which a campaign
 * switched off two months ago still answers well. This answers "is it producing
 * now", and an empty run of weeks is the whole point, so the zero weeks are drawn
 * rather than skipped.
 */
function LeadVolumeCard({ members }: { members: Contact[] }) {
  // Fixed for the life of the view: a series that moves as the clock ticks would
  // redraw mid-session for no reason.
  const now = useMemo(() => new Date(), []);
  const weeks = useMemo(() => leadsByWeek(members, now, VOLUME_WEEKS), [members, now]);
  const inWindow = weeks.reduce((sum, week) => sum + week.count, 0);
  const newest = useMemo(() => mostRecentLeadAt(members), [members]);

  return (
    <div className={`${CARD_CLASS} p-5`}>
      <h3 className={`${HEADING_CLASS} mb-1`}>Leads per week</h3>
      <p className="text-xs text-muted-foreground mb-4">
        The last {VOLUME_WEEKS} weeks. Every other number on this page is a running
        total, so a campaign that stopped last month still reads as a success there.
      </p>

      {inWindow === 0 ? (
        <p className="text-sm text-muted-foreground">
          No leads in the last {VOLUME_WEEKS} weeks
          {newest
            ? ` — the most recent arrived ${newest.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}.`
            : " — this campaign has never produced one."}
        </p>
      ) : (
        <LeadVolumeChart weeks={weeks} total={inWindow} />
      )}
    </div>
  );
}

/**
 * Recharts, matching the workflow analytics screens — this is the one card on the page
 * that is a chart rather than a bar drawn to scale, and it should read as the same
 * product. The lead-quality bars and the funnel stay CSS: six ResponsiveContainers in
 * a three-column grid buys nothing, and a scale bar under a number is not a chart.
 */
function LeadVolumeChart({ weeks, total }: { weeks: LeadWeek[]; total: number }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={weeks} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            // Every third week: twelve labels collide inside a card.
            interval={2}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            cursor={{ fill: "rgba(15, 23, 42, 0.04)" }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
            labelFormatter={(label: string) => `Week of ${label}`}
            formatter={(value: number) => [value, "Leads"]}
          />
          {/* --primary from theme.css; Recharts takes a value, not a CSS variable. */}
          <Bar dataKey="count" fill="#0d5e52" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs text-muted-foreground mt-2">
        {total} lead{total === 1 ? "" : "s"} in the window.
      </p>
    </>
  );
}

/** What the leads actually said about themselves — volume's counterweight. */
function LeadQualityCard({
  quality,
  memberCount,
}: {
  quality: ReturnType<typeof leadQualityBreakdown>;
  memberCount: number;
}) {
  return (
    <div className={`${CARD_CLASS} p-5`}>
      <h3 className={`${HEADING_CLASS} mb-1`}>Lead quality</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Questionnaire answers from the {memberCount} contact
        {memberCount === 1 ? "" : "s"} attributed here. A campaign can win on volume
        and still send leads nobody can fund.
      </p>

      {quality.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          None of these leads answered a visible questionnaire field.
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {quality.map((field) => (
            <div key={field.key}>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm font-semibold">{field.label}</span>
                <span className="text-xs text-muted-foreground">
                  {field.answered} answered
                  {field.unanswered > 0 && ` · ${field.unanswered} blank`}
                </span>
              </div>
              <div className="space-y-1.5">
                {field.buckets.map((bucket) => (
                  <div key={bucket.value} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 text-xs text-muted-foreground truncate">
                      {bucket.value}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60"
                        style={{ width: `${Math.round(bucket.share * 100)}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs tabular-nums">
                      {bucket.count} · {formatPercent(bucket.share)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** One row per ad platform, listing the platform-side campaigns that roll up here. */
function PlatformCard({
  platforms,
}: {
  platforms: ReturnType<typeof platformSplit>;
}) {
  return (
    <div className={`${CARD_CLASS} p-5`}>
      <h3 className={`${HEADING_CLASS} mb-1`}>Platform breakdown</h3>
      <p className="text-xs text-muted-foreground mb-4">
        The platform-side campaigns rolled up into this one. Names are shown as they
        currently read in the ad account — the join key is the external id, so a
        rename over there does not detach anything here.
      </p>

      <div className="space-y-4">
        {platforms.map((platform) => (
          <div key={platform.platform}>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-sm font-semibold">{platform.label}</span>
              <span className="text-xs text-muted-foreground">
                {platform.refs.length} campaign
                {platform.refs.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="rounded-md border border-border divide-y divide-border">
              {platform.refs.map((ref) => (
                <div
                  key={ref.externalId}
                  className="flex items-center justify-between gap-4 px-3 py-2"
                >
                  <span className="text-sm truncate">{ref.externalName}</span>
                  <code className="text-xs text-muted-foreground shrink-0">
                    {ref.externalId}
                  </code>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}
