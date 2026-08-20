import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { useAppData } from "@/app/contexts/AppDataContext";
import {
  campaignFunnel,
  compareByOutcome,
  totalsAcrossCampaigns,
  type CampaignFunnel,
} from "@/app/data/campaignMetrics";
import type { Campaign, CampaignStatus } from "@/app/types";
import { CampaignFormModal } from "./CampaignFormModal";

const STATUS_TONE: Record<CampaignStatus, string> = {
  Draft: "bg-muted text-muted-foreground border-border",
  Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Paused: "bg-amber-50 text-amber-700 border-amber-200",
  Completed: "bg-slate-50 text-slate-700 border-slate-200",
};

const TH_CLASS = "px-6 py-4 text-left text-sm text-muted-foreground";
const TH_NUM_CLASS = "px-6 py-4 text-right text-sm text-muted-foreground";
const TH_STYLE = { fontFamily: "var(--font-sans)", fontWeight: 600 } as const;

export function CampaignList() {
  const { campaigns, contacts, applications, handleDeleteCampaign } = useAppData();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | undefined>();

  const funnels = useMemo(() => {
    const map = new Map<string, CampaignFunnel>();
    for (const campaign of campaigns) {
      map.set(campaign.id, campaignFunnel(campaign, contacts, applications));
    }
    return map;
  }, [campaigns, contacts, applications]);

  // Most funded loans first: the row order says which campaign actually produced.
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matched = term
      ? campaigns.filter(
          (c) =>
            c.name.toLowerCase().includes(term) ||
            c.utmCampaign.toLowerCase().includes(term),
        )
      : campaigns;

    return [...matched].sort((a, b) =>
      compareByOutcome(funnels.get(a.id)!, funnels.get(b.id)!),
    );
  }, [campaigns, search, funnels]);

  const totals = useMemo(
    () => totalsAcrossCampaigns(visible.map((c) => funnels.get(c.id)!)),
    [visible, funnels],
  );

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const openEdit = (campaign: Campaign) => {
    setEditing(campaign);
    setFormOpen(true);
  };

  const remove = (campaign: Campaign) => {
    handleDeleteCampaign(campaign.id);
    toast.success(`${campaign.name} deleted — attributed contacts were kept`);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border bg-card px-8 py-6">
        <div className="flex items-center mb-1">
          <h2
            className="text-3xl mr-6"
            style={{ fontFamily: "var(--font-sans)", fontWeight: 600 }}
          >
            Campaigns
          </h2>
          <p className="text-muted-foreground mt-1">{visible.length} campaigns</p>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Ranked by funded loans, then applications in flight. Lead volume is shown,
          but it is not what the ranking is based on.
        </p>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-2 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              style={{ height: "38px" }}
            />
          </div>
          <Button onClick={openCreate} className="px-3 py-1.5 text-sm">
            <Plus className="w-4 h-4 mr-1.5" />
            New campaign
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="space-y-4">
          <TotalsBar totals={totals} />

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className={TH_CLASS} style={TH_STYLE}>Campaign</th>
                    <th className={TH_CLASS} style={TH_STYLE}>Status</th>
                    <th className={TH_NUM_CLASS} style={TH_STYLE}>Leads</th>
                    <th className={TH_NUM_CLASS} style={TH_STYLE}>Applications</th>
                    <th className={TH_NUM_CLASS} style={TH_STYLE}>Funded</th>
                    <th className={TH_CLASS} style={TH_STYLE} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((campaign) => {
                    const funnel = funnels.get(campaign.id)!;
                    return (
                      <tr
                        key={campaign.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/crm/campaigns/${campaign.id}`)}
                      >
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-blue-600">
                            {campaign.name}
                          </div>
                          <code className="text-xs text-muted-foreground">
                            {campaign.utmCampaign}
                          </code>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full border text-xs ${STATUS_TONE[campaign.status]}`}
                          >
                            {campaign.status}
                          </span>
                        </td>
                        {/* Deliberately not bold: volume is context, not the verdict. */}
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm tabular-nums text-muted-foreground">
                            {funnel.leads}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm tabular-nums">
                            {funnel.applications}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm tabular-nums font-semibold">
                            {funnel.funded}
                          </span>
                        </td>
                        <td
                          className="px-6 py-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => openEdit(campaign)}>
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onSelect={() => remove(campaign)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {visible.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <p>No campaigns yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <CampaignFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        campaign={editing}
      />
    </div>
  );
}

function TotalsBar({ totals }: { totals: CampaignFunnel }) {
  return (
    <div className="bg-card border border-border rounded-lg px-6 py-4">
      <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
        <Total
          label="Leads"
          value={totals.leads}
          muted
          hint="Volume only — not a performance measure"
        />
        <Total label="Applications" value={totals.applications} />
        <Total label="Funded loans" value={totals.funded} />
      </div>
    </div>
  );
}

function Total({
  label,
  value,
  hint,
  muted,
}: {
  label: string;
  value: number;
  hint?: string;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          muted
            ? "text-xl mt-0.5 text-muted-foreground tabular-nums"
            : "text-xl mt-0.5 tabular-nums"
        }
        style={muted ? undefined : { fontFamily: "var(--font-sans)", fontWeight: 600 }}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
