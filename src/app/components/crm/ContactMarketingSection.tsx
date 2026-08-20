import { useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router";
import { useAppData } from "@/app/contexts/AppDataContext";
import { resolveCampaign } from "@/app/data/campaignUtils";
import { submissionCount } from "@/app/data/leadFormUtils";
import { leadSourceLabel, leadSourceTone } from "@/app/data/attribution";
import type { Contact } from "@/app/types";

const CAPTION = "text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5";

/**
 * How this contact came to us.
 *
 * Two fields, both of which the CRM already had. Six more were proposed during
 * design review and all six were dropped as already-covered or built for a case this
 * flow never produces — see `data/attribution.ts`.
 *
 * Both are written once and never rewritten. That is not a storage detail: they
 * answer a historical question, and if a later visit could move them then last
 * month's reporting would change every time somebody clicked an ad.
 *
 * There is deliberately no "latest source" row. That was HubSpot's shape, and it
 * answered "did they come back" badly — two visits through the *same* channel looked
 * identical to never returning. The submission log answers it properly, so the
 * repeat-visit note below counts events rather than comparing two columns.
 */
export function ContactMarketingSection({ contact }: { contact: Contact }) {
  const navigate = useNavigate();
  const { campaigns, inboundLeadEvents } = useAppData();
  const [open, setOpen] = useState(true);

  const campaign = resolveCampaign(contact, campaigns);
  const visits = submissionCount(contact.id, inboundLeadEvents);

  return (
    <div className="px-5 py-5 border-b border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full mb-3"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Marketing Properties
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="space-y-4">
          <div>
            <p className={CAPTION}>Lead source</p>
            {contact.leadSource ? (
              <span
                className={`inline-flex px-2 py-0.5 rounded-full border text-xs ${leadSourceTone(contact.leadSource)}`}
              >
                {leadSourceLabel(contact.leadSource)}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Not recorded</span>
            )}
          </div>

          <div>
            <p className={CAPTION}>Created by</p>
            <span className="text-sm">{contact.attributionSource ?? "—"}</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Also controls who is allowed to see this contact.
            </p>
          </div>

          <div>
            <p className={CAPTION}>Campaign</p>
            {campaign ? (
              <button
                className="text-sm text-blue-600 text-left"
                onClick={() => navigate(`/crm/campaigns/${campaign.id}`)}
              >
                {campaign.name}
              </button>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>

          {visits > 1 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-amber-800 mb-1">
                <RefreshCw className="w-3 h-3" />
                Came back
              </p>
              <p className="text-[11px] text-amber-900">
                {visits} submissions on record. The lead source above is the first one
                and stays as it is — every visit is kept in the inbound log.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
