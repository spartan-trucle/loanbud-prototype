import { useNavigate } from "react-router";
import { useAppData } from "@/app/contexts/AppDataContext";
import { resolveCampaign } from "@/app/data/campaignUtils";
import {
  resolveAttribution,
  trafficSourceLabel,
  trafficSourceTone,
} from "@/app/data/trafficSources";
import type { Contact } from "@/app/types";

const CAPTION = "text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5";

/**
 * Where the contact actually came from.
 *
 * Original Traffic Source answers the marketing question; Attribution Source is kept
 * as the system/ownership field it really is — recorded, de-emphasised, not editable.
 */
export function ContactAttributionBlock({ contact }: { contact: Contact }) {
  const navigate = useNavigate();
  const { campaigns } = useAppData();
  const { trafficSource, detail1, detail2 } = resolveAttribution(contact);
  const campaign = resolveCampaign(contact, campaigns);

  return (
    <div className="space-y-3">
      <div>
        <p className={CAPTION}>Original Traffic Source</p>
        {trafficSource ? (
          <span
            className={`inline-flex px-2 py-0.5 rounded-full border text-xs ${trafficSourceTone(trafficSource)}`}
          >
            {trafficSourceLabel(trafficSource)}
          </span>
        ) : (
          <span className="text-sm">Unknown</span>
        )}
      </div>

      {(detail1 || detail2) && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className={CAPTION}>Source Detail 1</p>
            <span className="text-sm">{detail1 ?? "—"}</span>
          </div>
          <div>
            <p className={CAPTION}>Source Detail 2</p>
            <span className="text-sm">{detail2 ?? "—"}</span>
          </div>
        </div>
      )}

      <div>
        <p className={CAPTION}>Campaign</p>
        {campaign ? (
          <button
            className="text-sm text-blue-600"
            onClick={() => navigate(`/crm/campaigns/${campaign.id}`)}
          >
            {campaign.name}
          </button>
        ) : (
          <span className="text-sm">—</span>
        )}
      </div>

      <div>
        <p className={CAPTION}>
          Attribution Source
          <span className="ml-1 normal-case tracking-normal">(system)</span>
        </p>
        <span className="text-xs text-muted-foreground">
          {contact.leadSource ?? "service-loanbud-hub"}
        </span>
      </div>
    </div>
  );
}
