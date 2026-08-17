import { useState } from "react";
import { CalendarCheck, Phone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";

/**
 * Mirrors the CRM Settings sections in frontend-hub: Calling (phone pool),
 * Calendar (connected account), and Workflow Policy (per-channel guardrails).
 */

interface PooledNumber {
  id: string;
  number: string;
  label: string;
  isActive: boolean;
}

const SEED_NUMBERS: PooledNumber[] = [
  { id: "pn-1", number: "(555) 010-4400", label: "Sales — East", isActive: true },
  { id: "pn-2", number: "(555) 010-4401", label: "Sales — West", isActive: true },
  { id: "pn-3", number: "(555) 010-4402", label: "Docs / LDS", isActive: false },
];

export function CallingSection() {
  const [numbers, setNumbers] = useState<PooledNumber[]>(SEED_NUMBERS);
  const [newNumber, setNewNumber] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const add = () => {
    if (!newNumber.trim()) return;
    setNumbers((rows) => [
      ...rows,
      {
        id: `pn-${Date.now()}`,
        number: newNumber.trim(),
        label: newLabel.trim() || "Unlabelled",
        isActive: true,
      },
    ]);
    setNewNumber("");
    setNewLabel("");
    toast.success("Number added to the pool");
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Phone pool</h2>
        <p className="text-sm text-muted-foreground">
          Outbound calls and SMS rotate through these numbers.
        </p>
      </div>

      <div className="space-y-2">
        {numbers.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-3 rounded-lg border border-border px-4 py-3"
          >
            <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium">{entry.number}</div>
              <div className="text-xs text-muted-foreground">{entry.label}</div>
            </div>
            <Badge variant={entry.isActive ? "default" : "secondary"}>
              {entry.isActive ? "Active" : "Paused"}
            </Badge>
            <Switch
              checked={entry.isActive}
              onCheckedChange={(checked) =>
                setNumbers((rows) =>
                  rows.map((r) => (r.id === entry.id ? { ...r, isActive: checked } : r)),
                )
              }
            />
            <Button
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() =>
                setNumbers((rows) => rows.filter((r) => r.id !== entry.id))
              }
            >
              <Trash2 className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2 border-t border-border pt-4">
        <div className="grid gap-1.5 flex-1">
          <Label htmlFor="pool-number">Number</Label>
          <Input
            id="pool-number"
            value={newNumber}
            placeholder="(555) 010-4403"
            onChange={(e) => setNewNumber(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5 flex-1">
          <Label htmlFor="pool-label">Label</Label>
          <Input
            id="pool-label"
            value={newLabel}
            placeholder="Acquisitions"
            onChange={(e) => setNewLabel(e.target.value)}
          />
        </div>
        <Button onClick={add} className="h-9">
          <Plus className="w-4 h-4 mr-1.5" />
          Add
        </Button>
      </div>
    </div>
  );
}

export function CalendarSection() {
  const [connected, setConnected] = useState(true);

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Calendar</h2>
        <p className="text-sm text-muted-foreground">
          Meetings booked from the CRM are written to this calendar.
        </p>
      </div>

      <div className="flex items-center gap-4 rounded-lg border border-border px-4 py-4">
        <CalendarCheck className="w-5 h-5 text-muted-foreground" />
        <div className="flex-1">
          <div className="text-sm font-medium">Microsoft 365</div>
          <div className="text-xs text-muted-foreground">
            {connected ? "andy.officer@loanbud.com" : "Not connected"}
          </div>
        </div>
        {connected ? (
          <Button
            variant="outline"
            onClick={() => {
              setConnected(false);
              toast.success("Calendar disconnected");
            }}
          >
            Disconnect
          </Button>
        ) : (
          <Button
            onClick={() => {
              setConnected(true);
              toast.success("Calendar connected");
            }}
          >
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}

interface ChannelPolicy {
  channel: string;
  isEnabled: boolean;
  maxPerDay: number;
  quietHours: string;
}

const SEED_POLICIES: ChannelPolicy[] = [
  { channel: "Email", isEnabled: true, maxPerDay: 3, quietHours: "21:00 – 08:00" },
  { channel: "SMS", isEnabled: true, maxPerDay: 2, quietHours: "20:00 – 09:00" },
  { channel: "Call", isEnabled: true, maxPerDay: 2, quietHours: "19:00 – 09:00" },
];

export function WorkflowPolicySection() {
  const [policies, setPolicies] = useState<ChannelPolicy[]>(SEED_POLICIES);

  const update = (channel: string, patch: Partial<ChannelPolicy>) =>
    setPolicies((rows) =>
      rows.map((p) => (p.channel === channel ? { ...p, ...patch } : p)),
    );

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Workflow policy</h2>
        <p className="text-sm text-muted-foreground">
          Guardrails applied to every workflow, per channel.
        </p>
      </div>

      <div className="space-y-3">
        {policies.map((policy) => (
          <div
            key={policy.channel}
            className="rounded-lg border border-border px-4 py-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{policy.channel}</div>
              <Switch
                checked={policy.isEnabled}
                onCheckedChange={(checked) =>
                  update(policy.channel, { isEnabled: checked })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor={`max-${policy.channel}`}>Max per contact / day</Label>
                <Input
                  id={`max-${policy.channel}`}
                  type="number"
                  min={0}
                  value={policy.maxPerDay}
                  disabled={!policy.isEnabled}
                  onChange={(e) =>
                    update(policy.channel, { maxPerDay: Number(e.target.value) })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`quiet-${policy.channel}`}>Quiet hours</Label>
                <Input
                  id={`quiet-${policy.channel}`}
                  value={policy.quietHours}
                  disabled={!policy.isEnabled}
                  onChange={(e) =>
                    update(policy.channel, { quietHours: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotificationSection() {
  const [prefs, setPrefs] = useState({
    newLead: true,
    taskDue: true,
    workflowFailure: true,
    weeklyDigest: false,
  });

  const rows: { key: keyof typeof prefs; label: string; hint: string }[] = [
    { key: "newLead", label: "New lead assigned", hint: "When a lead is routed to you" },
    { key: "taskDue", label: "Task due", hint: "Reminders for tasks due today" },
    {
      key: "workflowFailure",
      label: "Workflow failure",
      hint: "When a step fails to send",
    },
    { key: "weeklyDigest", label: "Weekly digest", hint: "Monday morning summary" },
  ];

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Which events reach you, and where.
        </p>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
          >
            <div>
              <div className="text-sm font-medium">{row.label}</div>
              <div className="text-xs text-muted-foreground">{row.hint}</div>
            </div>
            <Switch
              checked={prefs[row.key]}
              onCheckedChange={(checked) =>
                setPrefs((p) => ({ ...p, [row.key]: checked }))
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
