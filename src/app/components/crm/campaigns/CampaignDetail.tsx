import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Copy, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../ui/button";
import { useAppData } from "@/app/contexts/AppDataContext";
import { contactsInCampaign } from "@/app/data/campaignUtils";
import {
  resolveAttribution,
  trafficSourceLabel,
  trafficSourceTone,
} from "@/app/data/trafficSources";
import { CampaignFormModal } from "./CampaignFormModal";

const TH_CLASS = "px-6 py-3 text-left text-sm text-muted-foreground";
const TH_STYLE = { fontFamily: "var(--font-sans)", fontWeight: 600 } as const;

export function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { campaigns, contacts } = useAppData();
  const [editOpen, setEditOpen] = useState(false);

  const campaign = campaigns.find((c) => c.id === id);
  const members = useMemo(
    () => (campaign ? contactsInCampaign(campaign.id, contacts) : []),
    [campaign, contacts],
  );

  // A campaign can pull traffic from more than one source — that is exactly why
  // campaigns are their own object rather than a node under one channel.
  const bySource = useMemo(() => {
    const counts = new Map<string, number>();
    for (const contact of members) {
      const label = trafficSourceLabel(resolveAttribution(contact).trafficSource);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [members]);

  if (!campaign) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>Campaign not found</p>
        <Button variant="outline" onClick={() => navigate("/crm/campaigns")}>
          Back to campaigns
        </Button>
      </div>
    );
  }

  const trackingLink = `https://loanbud.com/?utm_campaign=${campaign.utmCampaign}`;

  const copyLink = () => {
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
          <Stat label="Contacts" value={String(members.length)} />
          <Stat label="Status" value={campaign.status} />
          <Stat
            label="Channel"
            value={trafficSourceLabel(campaign.channel)}
          />
          <Stat
            label="Running"
            value={
              (campaign.startDate?.toLocaleDateString() ?? "—") +
              (campaign.endDate ? ` – ${campaign.endDate.toLocaleDateString()}` : "")
            }
          />
        </div>

        <div className="mt-5 flex items-center gap-2">
          <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
            {trackingLink}
          </code>
          <Button variant="outline" className="h-9" onClick={copyLink}>
            <Copy className="w-4 h-4 mr-1.5" />
            Copy link
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="space-y-6">
          {bySource.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-3">Traffic sources</h3>
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

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-sm font-semibold">Attributed contacts</h3>
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
                    const { trafficSource } = resolveAttribution(contact);
                    return (
                      <tr
                        key={contact.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/crm/contacts/${contact.id}`)}
                      >
                        <td className="px-6 py-3 text-sm font-semibold text-blue-600">
                          {contact.firstName} {contact.lastName}
                        </td>
                        <td className="px-6 py-3 text-sm text-blue-600">
                          {contact.email}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full border text-xs whitespace-nowrap ${trafficSourceTone(trafficSource)}`}
                          >
                            {trafficSourceLabel(trafficSource)}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}
