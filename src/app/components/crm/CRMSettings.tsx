import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { EmailTemplatesTab } from "../email-workflows/settings/EmailTemplatesTab";
import { SmsTemplatesTab } from "../email-workflows/settings/SmsTemplatesTab";
import { VoicemailScriptsTab } from "../email-workflows/settings/VoicemailScriptsTab";
import { VoicemailSettingsTab } from "../email-workflows/settings/VoicemailSettingsTab";
import { SenderIdentitiesTab } from "../email-workflows/settings/SenderIdentitiesTab";
import { LeadSyncingSettings } from "./LeadSyncingSettings";
import {
  CalendarSection,
  CallingSection,
  NotificationSection,
  WorkflowPolicySection,
} from "./CrmSettingsSections";

const TAB_TRIGGER =
  "rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 h-full text-sm";

// ─── General ────────────────────────────────────────────────────────────────

function GeneralTab() {
  const [form, setForm] = useState({
    crmName: "LoanBud CRM",
    timezone: "America/New_York",
    trackingDomain: "track.loanbud.com",
    deduplication: true,
    optOutManagement: true,
    autoAssignLeads: false,
  });

  return (
    <div className="p-6 max-w-xl space-y-8">
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">CRM Identity</h2>
          <p className="text-xs text-muted-foreground">Display name and organization defaults.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="crmName">CRM Name</Label>
          <Input
            id="crmName"
            value={form.crmName}
            onChange={(e) => setForm((f) => ({ ...f, crmName: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timezone">Default Timezone</Label>
          <Input
            id="timezone"
            value={form.timezone}
            onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
            placeholder="e.g. America/New_York"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="trackingDomain">Email Tracking Domain</Label>
          <Input
            id="trackingDomain"
            value={form.trackingDomain}
            onChange={(e) => setForm((f) => ({ ...f, trackingDomain: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">Used for open and click tracking in outbound emails.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Contact Management</h2>
          <p className="text-xs text-muted-foreground">Control how contacts are created and managed.</p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3.5">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Duplicate Detection</p>
            <p className="text-xs text-muted-foreground">Prevent duplicates by matching on email or phone.</p>
          </div>
          <Switch
            checked={form.deduplication}
            onCheckedChange={(v) => setForm((f) => ({ ...f, deduplication: v }))}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3.5">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Opt-Out Management</p>
            <p className="text-xs text-muted-foreground">Suppress opted-out contacts from campaigns automatically.</p>
          </div>
          <Switch
            checked={form.optOutManagement}
            onCheckedChange={(v) => setForm((f) => ({ ...f, optOutManagement: v }))}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3.5">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Auto-Assign New Leads</p>
            <p className="text-xs text-muted-foreground">Route incoming leads to available loan officers.</p>
          </div>
          <Switch
            checked={form.autoAssignLeads}
            onCheckedChange={(v) => setForm((f) => ({ ...f, autoAssignLeads: v }))}
          />
        </div>
      </div>

      <Button size="sm" onClick={() => toast.success("General settings saved.")}>
        Save Settings
      </Button>
    </div>
  );
}

// ─── Lifecycle Stages ────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { label: "New Lead",        description: "Initial contact, unqualified",        color: "bg-slate-100  text-slate-700  border-slate-200"  },
  { label: "Prequalification", description: "Assessing borrower eligibility",      color: "bg-blue-100   text-blue-700   border-blue-200"   },
  { label: "Application",     description: "Borrower completing initial form",     color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { label: "Underwriting",    description: "Submitted for underwriting review",    color: "bg-violet-100 text-violet-700 border-violet-200" },
  { label: "Docs Requested",  description: "Awaiting prepaid documentation",       color: "bg-orange-100 text-orange-700 border-orange-200" },
  { label: "Funded",          description: "Loan successfully closed and funded",  color: "bg-green-100  text-green-700  border-green-200"  },
];

const EXIT_STAGES = [
  { label: "On Hold",   color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { label: "Withdrawn", color: "bg-red-50    text-red-700    border-red-200"    },
  { label: "Declined",  color: "bg-gray-100  text-gray-500   border-gray-200"   },
];

function LifecycleStagesTab() {
  return (
    <div className="p-6 space-y-8 overflow-y-auto">
      {/* Pipeline */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Borrower Pipeline</h2>
          <p className="text-xs text-muted-foreground">The stages a borrower progresses through from initial lead to funded loan.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-start">
          {PIPELINE_STAGES.map((stage, i) => (
            <div key={stage.label} className="flex items-center gap-2">
              <div className={`flex flex-col gap-1 px-4 py-3 rounded-lg border ${stage.color} min-w-[130px]`}>
                <span className="text-sm font-semibold">{stage.label}</span>
                <span className="text-[11px] opacity-70">{stage.description}</span>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Exit stages */}
      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Exit Stages</h3>
          <p className="text-xs text-muted-foreground">Borrowers may exit the pipeline at any stage via these terminal statuses.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {EXIT_STAGES.map((s) => (
            <div key={s.label} className={`px-4 py-3 rounded-lg border ${s.color}`}>
              <span className="text-sm font-semibold">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stage-to-segment mapping */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Stage → Segment Mapping</h3>
            <p className="text-xs text-muted-foreground">Auto-enroll contacts into segments as they advance through the pipeline.</p>
          </div>
          <Badge variant="secondary" className="text-[10px]">Coming soon</Badge>
        </div>
        <div className="rounded-lg border border-border divide-y divide-border text-sm">
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage.label} className="flex items-center justify-between px-4 py-3">
              <span className="font-medium">{stage.label}</span>
              <span className="text-xs text-muted-foreground italic">No segment assigned</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Configuration (nested workflow settings) ────────────────────────────────

const INNER_TAB =
  "rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 h-full text-sm";

function ConfigurationTab() {
  return (
    <Tabs defaultValue="email-templates" className="flex flex-col flex-1 min-h-0">
      <TabsList className="shrink-0 justify-start rounded-none border-b border-border bg-transparent px-6 h-10 gap-0">
        <TabsTrigger value="email-templates"   className={INNER_TAB}>Email Templates</TabsTrigger>
        <TabsTrigger value="sms-templates"     className={INNER_TAB}>SMS Templates</TabsTrigger>
        <TabsTrigger value="voicemail-scripts" className={INNER_TAB}>Voicemail Templates</TabsTrigger>
        <TabsTrigger value="voicemail-settings" className={INNER_TAB}>Voicemail Settings</TabsTrigger>
        <TabsTrigger value="sender-identities" className={INNER_TAB}>Sender Identities</TabsTrigger>
      </TabsList>
      <TabsContent value="email-templates"    className="flex-1 min-h-0 mt-0 overflow-hidden"><EmailTemplatesTab /></TabsContent>
      <TabsContent value="sms-templates"      className="flex-1 min-h-0 mt-0 overflow-hidden"><SmsTemplatesTab /></TabsContent>
      <TabsContent value="voicemail-scripts"  className="flex-1 min-h-0 mt-0 overflow-hidden"><VoicemailScriptsTab /></TabsContent>
      <TabsContent value="voicemail-settings" className="flex-1 min-h-0 mt-0 overflow-y-auto"><VoicemailSettingsTab /></TabsContent>
      <TabsContent value="sender-identities"  className="flex-1 min-h-0 mt-0 overflow-y-auto"><SenderIdentitiesTab /></TabsContent>
    </Tabs>
  );
}

// ─── General (sub-tabs mirror frontend-hub: Profile · Calling · Calendar · Workflow Policy)

const INNER_TAB_GENERAL =
  "rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 h-full text-sm";

function GeneralSection() {
  return (
    <Tabs defaultValue="profile" className="flex flex-col flex-1 min-h-0">
      <TabsList className="shrink-0 justify-start rounded-none border-b border-border bg-transparent px-8 h-9 gap-0">
        <TabsTrigger value="profile"  className={INNER_TAB_GENERAL}>Profile</TabsTrigger>
        <TabsTrigger value="calling"  className={INNER_TAB_GENERAL}>Calling</TabsTrigger>
        <TabsTrigger value="calendar" className={INNER_TAB_GENERAL}>Calendar</TabsTrigger>
        <TabsTrigger value="policy"   className={INNER_TAB_GENERAL}>Workflow Policy</TabsTrigger>
      </TabsList>

      <TabsContent value="profile"  className="flex-1 min-h-0 mt-0 overflow-y-auto"><GeneralTab /></TabsContent>
      <TabsContent value="calling"  className="flex-1 min-h-0 mt-0 overflow-y-auto"><CallingSection /></TabsContent>
      <TabsContent value="calendar" className="flex-1 min-h-0 mt-0 overflow-y-auto"><CalendarSection /></TabsContent>
      <TabsContent value="policy"   className="flex-1 min-h-0 mt-0 overflow-y-auto"><WorkflowPolicySection /></TabsContent>
    </Tabs>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

export function CRMSettings() {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b border-border bg-card px-8 py-5 shrink-0">
        <h1 className="text-3xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your CRM configuration, lifecycle stages, and communication settings.
        </p>
      </div>

      <Tabs defaultValue="general" className="flex flex-col flex-1 min-h-0">
        <TabsList className="shrink-0 justify-start rounded-none border-b border-border bg-transparent px-8 h-10 gap-0">
          <TabsTrigger value="general"       className={TAB_TRIGGER}>General</TabsTrigger>
          <TabsTrigger value="lead-syncing"  className={TAB_TRIGGER}>Lead syncing</TabsTrigger>
          <TabsTrigger value="lifecycle"     className={TAB_TRIGGER}>Lifecycle Stages</TabsTrigger>
          <TabsTrigger value="configuration" className={TAB_TRIGGER}>Configuration</TabsTrigger>
          <TabsTrigger value="notification"  className={TAB_TRIGGER}>Notification</TabsTrigger>
        </TabsList>

        <TabsContent value="general"       className="flex-1 min-h-0 mt-0 overflow-hidden flex flex-col"><GeneralSection /></TabsContent>
        <TabsContent value="lead-syncing"  className="flex-1 min-h-0 mt-0 overflow-y-auto"><LeadSyncingSettings /></TabsContent>
        <TabsContent value="lifecycle"     className="flex-1 min-h-0 mt-0 overflow-y-auto"><LifecycleStagesTab /></TabsContent>
        <TabsContent value="configuration" className="flex-1 min-h-0 mt-0 overflow-hidden flex flex-col"><ConfigurationTab /></TabsContent>
        <TabsContent value="notification"  className="flex-1 min-h-0 mt-0 overflow-y-auto"><NotificationSection /></TabsContent>
      </Tabs>
    </div>
  );
}
