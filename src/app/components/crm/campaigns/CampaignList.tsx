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
import { resolveCampaignId } from "@/app/data/campaignUtils";
import { trafficSourceLabel, trafficSourceTone } from "@/app/data/trafficSources";
import type { Campaign, CampaignStatus } from "@/app/types";
import { CampaignFormModal } from "./CampaignFormModal";

const STATUS_TONE: Record<CampaignStatus, string> = {
  Draft: "bg-muted text-muted-foreground border-border",
  Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Paused: "bg-amber-50 text-amber-700 border-amber-200",
  Completed: "bg-slate-50 text-slate-700 border-slate-200",
};

const TH_CLASS = "px-6 py-4 text-left text-sm text-muted-foreground";
const TH_STYLE = { fontFamily: "var(--font-sans)", fontWeight: 600 } as const;

export function CampaignList() {
  const { campaigns, contacts, handleDeleteCampaign } = useAppData();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | undefined>();

  // One pass over contacts gives every campaign its attributed count.
  const countsByCampaign = useMemo(() => {
    const counts = new Map<string, number>();
    for (const contact of contacts) {
      const id = resolveCampaignId(contact);
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [contacts]);

  const visible = useMemo(() => {
    if (!search.trim()) return campaigns;
    const term = search.toLowerCase();
    return campaigns.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.utmCampaign.toLowerCase().includes(term),
    );
  }, [campaigns, search]);

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
          Create a campaign, share its tracking link, and every lead that arrives
          through it is attributed automatically.
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
        <div>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className={TH_CLASS} style={TH_STYLE}>Campaign</th>
                    <th className={TH_CLASS} style={TH_STYLE}>Channel</th>
                    <th className={TH_CLASS} style={TH_STYLE}>utm_campaign</th>
                    <th className={TH_CLASS} style={TH_STYLE}>Status</th>
                    <th className={TH_CLASS} style={TH_STYLE}>Contacts</th>
                    <th className={TH_CLASS} style={TH_STYLE}>Dates</th>
                    <th className={TH_CLASS} style={TH_STYLE} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((campaign) => (
                    <tr
                      key={campaign.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/crm/campaigns/${campaign.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-blue-600">
                          {campaign.name}
                        </div>
                        {campaign.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 max-w-md">
                            {campaign.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full border text-xs whitespace-nowrap ${trafficSourceTone(campaign.channel)}`}
                        >
                          {trafficSourceLabel(campaign.channel)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-xs">{campaign.utmCampaign}</code>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full border text-xs ${STATUS_TONE[campaign.status]}`}
                        >
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm">
                          {countsByCampaign.get(campaign.id) ?? 0}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-muted-foreground">
                          {campaign.startDate
                            ? campaign.startDate.toLocaleDateString()
                            : "—"}
                          {campaign.endDate
                            ? ` – ${campaign.endDate.toLocaleDateString()}`
                            : ""}
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
                  ))}
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
