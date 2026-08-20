import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Link2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { Switch } from "../ui/switch";
import { useAppData } from "@/app/contexts/AppDataContext";
import { activeFields } from "@/app/data/customFieldUsage";
import {
  accountLastSyncedAt,
  accountsByPlatform,
  conflictingExternalKeys,
  formMappingSummary,
  formsForAccount,
  leadStatsByForm,
  type LeadFormStats,
} from "@/app/data/leadFormUtils";
import type { LeadFormDefinition, PlatformAccount } from "@/app/types";
import { LeadSyncingFormPanel } from "./LeadSyncingFormPanel";
import { PlatformMark, SyncDot } from "./PlatformMark";

const TH =
  "px-4 py-2.5 text-left text-[11px] uppercase tracking-wide text-muted-foreground font-semibold";

function formatDate(value: Date | undefined): string {
  return value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "—";
}

/** "Aug 18, 2026 8:06 PM" — a sync time is only useful to the minute. */
function formatDateTime(value: Date | undefined): string {
  return value
    ? new Date(value).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "never";
}

function LeadCount({ stats }: { stats: LeadFormStats | undefined }) {
  if (!stats || stats.leads === 0) {
    return <span className="text-sm text-muted-foreground/70">No leads yet</span>;
  }
  return <span className="text-sm tabular-nums">{stats.leads}</span>;
}

/**
 * Ads → Lead syncing.
 *
 * Three levels, same as the platform's own screen: connected pages, one page's forms,
 * one form's field mappings. Two things here that the original does not have — a
 * warning when one question is routed to different fields on different forms, and a
 * warning when a mapping quietly changes the answer's type on the way in.
 *
 * One column is deliberately missing: "Marketing contacts". That is a billing tier
 * concept belonging to another vendor's pricing model, and copying it would put
 * someone else's business model in LoanBud's UI.
 */
export function LeadSyncingSettings() {
  const {
    platformAccounts,
    leadForms,
    contacts,
    contactLeadAnswers,
  } = useAppData();

  const [search, setSearch] = useState("");
  const [openAccountId, setOpenAccountId] = useState<string | null>(null);
  const [openFormId, setOpenFormId] = useState<string | null>(null);

  const term = search.trim().toLowerCase();

  /** Search reaches into the forms, so a page can be found by what it runs. */
  const matchingAccounts = useMemo(() => {
    if (!term) return platformAccounts;
    return platformAccounts.filter((account) => {
      if (account.displayName.toLowerCase().includes(term)) return true;
      if (account.externalRef.includes(term)) return true;
      return formsForAccount(account.id, leadForms).some((form) =>
        form.name.toLowerCase().includes(term),
      );
    });
  }, [platformAccounts, leadForms, term]);

  const groups = useMemo(
    () => accountsByPlatform(matchingAccounts),
    [matchingAccounts],
  );

  const account = platformAccounts.find((a) => a.id === openAccountId);
  const form = leadForms.find((f) => f.id === openFormId);
  const statsByForm = leadStatsByForm(contacts, contactLeadAnswers);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Input
            value={search}
            placeholder="Search"
            className="pr-9"
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </div>
        <Button
          variant="outline"
          onClick={() =>
            toast.info("Connecting an account opens the platform's own consent flow.")
          }
        >
          Connect
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Leads from lead generation ads sync into the CRM automatically. Attribution
        and field mappings come from the platform's own ids, so a form renamed in Ads
        Manager keeps arriving where it always did.
      </p>

      {groups.map((group) => (
        <PlatformGroup
          key={group.platform}
          platform={group.platform}
          label={group.label}
          accounts={group.accounts}
          onOpenAccount={setOpenAccountId}
        />
      ))}

      {groups.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Link2 className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {term ? "No pages or forms match that search" : "No accounts connected yet"}
          </p>
        </div>
      )}

      {/* Level 2 — the page */}
      <Sheet
        open={Boolean(account) && !form}
        onOpenChange={(next) => !next && setOpenAccountId(null)}
      >
        <SheetContent className="w-full sm:max-w-[560px] p-0 flex flex-col">
          {account && (
            <AccountDrawer
              account={account}
              statsByForm={statsByForm}
              onOpenForm={setOpenFormId}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Level 3 — one form's mappings */}
      <Sheet open={Boolean(form)} onOpenChange={(next) => !next && setOpenFormId(null)}>
        <SheetContent className="w-full sm:max-w-[680px] p-0 flex flex-col">
          {form && account && <LeadSyncingFormPanel form={form} account={account} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PlatformGroup({
  platform,
  label,
  accounts,
  onOpenAccount,
}: {
  platform: string;
  label: string;
  accounts: PlatformAccount[];
  onOpenAccount: (id: string) => void;
}) {
  const { leadForms, contactLeadAnswers, customFieldDefinitions, handleUpdatePlatformAccount } =
    useAppData();
  const [open, setOpen] = useState(true);

  const conflicts = conflictingExternalKeys(leadForms);
  const definitions = activeFields(customFieldDefinitions);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 mb-2"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
        <PlatformMark platform={platform} className="w-5 h-5 text-[#0081FB]" />
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">
          {accounts.length} page{accounts.length === 1 ? "" : "s"}
        </span>
      </button>

      {open && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className={TH}>Page</th>
                <th className={TH}>Forms</th>
                <th className={TH}>Connected by</th>
                <th className={TH}>Sync status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {accounts.map((account) => {
                const forms = formsForAccount(account.id, leadForms);
                const needsAttention = forms.filter(
                  (f) =>
                    formMappingSummary(f, conflicts, definitions).status !== "mapped",
                ).length;
                const lastSynced = accountLastSyncedAt(account, leadForms);
                const formIds = new Set(forms.map((f) => f.id));
                const leads = new Set(
                  contactLeadAnswers
                    .filter((a) => a.leadFormId && formIds.has(a.leadFormId))
                    .map((a) => a.contactId),
                ).size;

                return (
                  <tr key={account.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <PlatformMark
                          platform={account.platform}
                          className="w-5 h-5 mt-0.5 text-[#0081FB] shrink-0"
                        />
                        <div className="min-w-0">
                          <button
                            className="text-sm font-semibold text-blue-600 text-left"
                            onClick={() => onOpenAccount(account.id)}
                          >
                            {account.displayName} ({account.externalRef})
                          </button>
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                            <SyncDot active={account.isActive} />
                            {account.isActive
                              ? `Last synced ${formatDateTime(lastSynced)}`
                              : "Sync paused"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 align-top">
                      <button
                        className="text-sm text-blue-600"
                        onClick={() => onOpenAccount(account.id)}
                      >
                        {forms.length} form{forms.length === 1 ? "" : "s"}
                      </button>
                      {needsAttention > 0 && (
                        <p className="flex items-center gap-1 text-xs text-amber-700 mt-0.5">
                          <AlertTriangle className="w-3 h-3" />
                          {needsAttention} need attention
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {leads} lead{leads === 1 ? "" : "s"} synced
                      </p>
                    </td>

                    <td className="px-4 py-3 align-top">
                      <p className="text-sm">{account.connectedByName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(account.connectedAt)}
                      </p>
                    </td>

                    <td className="px-4 py-3 align-top">
                      <Switch
                        checked={account.isActive}
                        onCheckedChange={(v) =>
                          handleUpdatePlatformAccount(account.id, { isActive: v })
                        }
                        aria-label={`Sync ${account.displayName}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AccountDrawer({
  account,
  statsByForm,
  onOpenForm,
}: {
  account: PlatformAccount;
  statsByForm: Map<string, LeadFormStats>;
  onOpenForm: (formId: string) => void;
}) {
  const {
    leadForms,
    customFieldDefinitions,
    handleUpdatePlatformAccount,
    handleUpdateLeadForm,
  } = useAppData();

  const forms = formsForAccount(account.id, leadForms);
  const conflicts = conflictingExternalKeys(leadForms);
  const definitions = activeFields(customFieldDefinitions);
  const lastSynced = accountLastSyncedAt(account, leadForms);

  return (
    <>
      <SheetHeader className="px-6 pt-5 pb-4 space-y-0 border-b border-border">
        <div className="flex items-start gap-3">
          <PlatformMark
            platform={account.platform}
            className="w-8 h-8 text-[#0081FB] shrink-0"
          />
          <div className="min-w-0">
            <SheetTitle className="text-base">{account.displayName}</SheetTitle>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <SyncDot active={account.isActive} />
              {account.isActive
                ? `Last synced ${formatDateTime(lastSynced)}`
                : "Sync paused"}
            </p>
          </div>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        <div className="rounded-lg border border-border divide-y divide-border">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Sync this page</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Turning it off stops new submissions arriving. Nothing already synced
                is removed.
              </p>
            </div>
            <Switch
              checked={account.isActive}
              onCheckedChange={(v) =>
                handleUpdatePlatformAccount(account.id, { isActive: v })
              }
            />
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2">Connected users</h4>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className={TH}>Connected by</th>
                  <th className={TH}>
                    {account.platform === "meta" ? "Meta user" : "Platform user"}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-3">
                    <p className="text-sm">{account.connectedByName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(account.connectedAt)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm">{account.externalUserName}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2">Forms</h4>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className={TH}>Form name</th>
                  <th className={`${TH} text-right`}>Submissions</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {forms.map((form) => (
                  <FormRow
                    key={form.id}
                    form={form}
                    stats={statsByForm.get(form.id)}
                    status={formMappingSummary(form, conflicts, definitions).status}
                    onOpen={() => onOpenForm(form.id)}
                    onToggle={(v) => handleUpdateLeadForm(form.id, { isActive: v })}
                  />
                ))}
              </tbody>
            </table>

            {forms.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                This page has no lead forms
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function FormRow({
  form,
  stats,
  status,
  onOpen,
  onToggle,
}: {
  form: LeadFormDefinition;
  stats: LeadFormStats | undefined;
  status: ReturnType<typeof formMappingSummary>["status"];
  onOpen: () => void;
  onToggle: (value: boolean) => void;
}) {
  return (
    <tr>
      <td className="px-4 py-3">
        <button
          className={`text-sm text-left ${form.isActive ? "text-blue-600" : "text-muted-foreground"}`}
          onClick={onOpen}
        >
          {form.name}
        </button>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
          <SyncDot active={form.isActive} />
          Form created {formatDateTime(form.createdAtExternal)}
        </p>
        <p className="text-xs text-muted-foreground">
          Submissions last synced {formatDateTime(form.submissionsLastSyncedAt)}
        </p>
        {status !== "mapped" && (
          <p className="flex items-center gap-1 text-xs text-amber-700 mt-0.5">
            <AlertTriangle className="w-3 h-3" />
            {status === "conflict"
              ? "Conflicting mapping"
              : status === "type-mismatch"
                ? "Type mismatch"
                : "Unmapped questions"}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-right align-top">
        <LeadCount stats={stats} />
      </td>
      <td className="px-4 py-3 text-right align-top">
        <Switch
          checked={form.isActive}
          onCheckedChange={onToggle}
          aria-label={`Sync ${form.name}`}
        />
      </td>
    </tr>
  );
}
