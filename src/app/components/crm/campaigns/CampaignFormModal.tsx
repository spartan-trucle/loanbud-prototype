import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { useAppData } from "@/app/contexts/AppDataContext";
import { toUtmKey } from "@/app/data/campaignUtils";
import type { Campaign, CampaignStatus } from "@/app/types";

const STATUSES: CampaignStatus[] = ["Draft", "Active", "Paused", "Completed"];

function toDateInput(value?: Date): string {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

interface CampaignFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing an existing campaign; omit to create a new one. */
  campaign?: Campaign;
}

export function CampaignFormModal({
  open,
  onOpenChange,
  campaign,
}: CampaignFormModalProps) {
  const { handleCreateCampaign, handleUpdateCampaign } = useAppData();
  const [name, setName] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmTouched, setUtmTouched] = useState(false);
  const [status, setStatus] = useState<CampaignStatus>("Draft");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(campaign?.name ?? "");
    setUtmCampaign(campaign?.utmCampaign ?? "");
    setUtmTouched(Boolean(campaign));
    setStatus(campaign?.status ?? "Draft");
    setStartDate(toDateInput(campaign?.startDate));
    setEndDate(toDateInput(campaign?.endDate));
    setDescription(campaign?.description ?? "");
  }, [open, campaign]);

  // Until the user edits the key by hand, it tracks the name — the common case.
  const effectiveUtm = utmTouched ? utmCampaign : toUtmKey(name);
  const canSubmit = name.trim().length > 0 && effectiveUtm.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    const payload = {
      name: name.trim(),
      utmCampaign: effectiveUtm,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      description: description.trim() || undefined,
    };

    if (campaign) {
      handleUpdateCampaign(campaign.id, payload);
      toast.success(`${payload.name} updated`);
    } else {
      handleCreateCampaign(payload);
      toast.success(`${payload.name} created`);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit campaign" : "New campaign"}</DialogTitle>
          <DialogDescription>
            Leads arriving with this <code>utm_campaign</code> value are attributed here
            automatically — no engineering work per campaign.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="campaign-name">Campaign name</Label>
            <Input
              id="campaign-name"
              value={name}
              placeholder="Summer SBA 2026"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="campaign-utm">utm_campaign</Label>
            <Input
              id="campaign-utm"
              value={effectiveUtm}
              className="font-mono text-sm"
              onChange={(e) => {
                setUtmTouched(true);
                setUtmCampaign(toUtmKey(e.target.value));
              }}
            />
            <p className="text-xs text-muted-foreground">
              Tracking link:{" "}
              <code>https://loanbud.com/?utm_campaign={effectiveUtm || "…"}</code>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* No spend field: cost reporting is out of scope, so an input that
                feeds nothing on screen would be a promise the CRM does not keep. */}
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as CampaignStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="campaign-start">Start date</Label>
              <Input
                id="campaign-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="campaign-end">End date</Label>
              <Input
                id="campaign-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="campaign-description">Description</Label>
            <Textarea
              id="campaign-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={submit}>
            {campaign ? "Save changes" : "Create campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
