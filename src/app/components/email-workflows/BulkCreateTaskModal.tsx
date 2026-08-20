import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  X,
  Users,
  ShieldCheck,
  Layers,
  UserCheck,
  Shuffle,
  AlertTriangle,
  CheckCircle2,
  PhoneOff,
  Search,
} from "lucide-react";
import { useAppData } from "@/app/contexts/AppDataContext";
import { INTERNAL_USER_NAMES } from "@/app/config/team";
import {
  computeBulkAssignments,
  contactsInSegment,
  isDoNotCall,
  lacksSmsConsent,
  type BulkAssignmentResult,
} from "@/app/lib/bulkTaskUtils";
import type { Contact } from "@/app/types";

interface BulkCreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onManageGroups: () => void;
}

const TASK_TYPES = ["Call", "Email", "SMS"] as const;
type TargetMode = "segment" | "contacts";
type PoolMode = "all" | "group" | "custom";

function defaultDue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * RFC-008 (story -04): admin bulk-create. Each task follows the contact's existing
 * assignee; LO-less contacts are round-robined over the chosen fallback pool
 * (all users / a named LO group / include list) and that user is assigned to both
 * the contact and the task. Preview shows match count, per-assignee split, and a
 * DNC/consent warn-and-choose exclude toggle.
 */
export function BulkCreateTaskModal({ isOpen, onClose, onManageGroups }: BulkCreateTaskModalProps) {
  const { contacts, segments, loGroups, applications, handleBulkCreateTasks } =
    useAppData();

  const [targetMode, setTargetMode] = useState<TargetMode>("segment");
  const [segmentId, setSegmentId] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [taskType, setTaskType] = useState<(typeof TASK_TYPES)[number]>("Call");
  const [dueDate, setDueDate] = useState(defaultDue);
  const [objective, setObjective] = useState("");
  const [poolMode, setPoolMode] = useState<PoolMode>("all");
  const [poolGroupId, setPoolGroupId] = useState("");
  const [customPool, setCustomPool] = useState<string[]>([]);
  const [excludeCompliance, setExcludeCompliance] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<(BulkAssignmentResult & { skipped: number; source: string }) | null>(null);

  const activeSegments = segments.filter((s) => s.status === "Active");

  // ── Resolve targets ──────────────────────────────────────────────────────────
  const targetContacts: Contact[] = useMemo(() => {
    if (targetMode === "segment") {
      const seg = segments.find((s) => s.id === segmentId);
      return seg ? contactsInSegment(seg, contacts, applications) : [];
    }
    const idSet = new Set(selectedContactIds);
    return contacts.filter((c) => idSet.has(c.id));
  }, [targetMode, segmentId, selectedContactIds, segments, contacts, applications]);

  const flagsForChannel = (c: Contact): boolean => {
    if (taskType === "Call") return isDoNotCall(c);
    if (taskType === "SMS") return lacksSmsConsent(c);
    return c.emailOptOut?.optedOut === true || c.optedOut === true;
  };
  const complianceLabel =
    taskType === "Call" ? "Do Not Call" : taskType === "SMS" ? "no SMS consent" : "email opted out";

  const flaggedContacts = targetContacts.filter(flagsForChannel);
  const effectiveTargets = excludeCompliance
    ? targetContacts.filter((c) => !flagsForChannel(c))
    : targetContacts;

  // ── Fallback pool ──────────────────────────────────────────────────────────
  const fallbackPool: string[] = useMemo(() => {
    if (poolMode === "all") return INTERNAL_USER_NAMES;
    if (poolMode === "group") {
      const g = loGroups.find((x) => x.id === poolGroupId);
      // Intersect group members with the active internal-user pool at run time.
      return g ? g.memberNames.filter((n) => INTERNAL_USER_NAMES.includes(n)) : [];
    }
    return customPool;
  }, [poolMode, poolGroupId, customPool, loGroups]);

  const preview = useMemo(
    () => computeBulkAssignments(effectiveTargets, fallbackPool),
    [effectiveTargets, fallbackPool],
  );

  const perAssigneeRows = Object.entries(preview.perAssignee).sort((a, b) => b[1] - a[1]);
  const maxCount = perAssigneeRows.reduce((m, [, n]) => Math.max(m, n), 0);

  if (!isOpen) return null;

  const sourceLabel =
    targetMode === "segment"
      ? `Bulk · ${segments.find((s) => s.id === segmentId)?.name ?? "segment"}`
      : "Bulk · selected contacts";

  const resetAndClose = () => {
    setTargetMode("segment");
    setSegmentId("");
    setSelectedContactIds([]);
    setContactSearch("");
    setTaskType("Call");
    setDueDate(defaultDue());
    setObjective("");
    setPoolMode("all");
    setPoolGroupId("");
    setCustomPool([]);
    setExcludeCompliance(true);
    setError("");
    setResult(null);
    onClose();
  };

  const submit = () => {
    if (effectiveTargets.length === 0) { setError("No matching contacts to create tasks for."); return; }
    if (!dueDate) { setError("Please set a due date."); return; }
    if (!objective.trim()) { setError("Objective is required."); return; }
    if (preview.roundRobinCount > 0 && fallbackPool.length === 0) {
      setError("There are unassigned contacts but the round-robin pool is empty.");
      return;
    }
    const res = handleBulkCreateTasks({
      contactIds: effectiveTargets.map((c) => c.id),
      taskType,
      dueDate: new Date(dueDate),
      objective: objective.trim(),
      vmScript: undefined,
      fallbackPool,
      source: sourceLabel,
    });
    const skipped = excludeCompliance ? flaggedContacts.length : 0;
    setResult({ ...res, skipped, source: sourceLabel });
    toast.success(`Created ${res.assignments.length} tasks · ${res.roundRobinCount} round-robin assigned`);
  };

  const toggleContact = (id: string) =>
    setSelectedContactIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleCustomPoolUser = (name: string) =>
    setCustomPool((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));

  const filteredContacts = contacts.filter((c) => {
    if (!contactSearch) return true;
    const q = contactSearch.toLowerCase();
    return `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.listingName.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl mx-4 shadow-xl max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-7 pt-6 pb-4 border-b border-border shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="text-xl font-semibold">Bulk Create Tasks</h3>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-primary/70 uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10">
                RFC-008 · Proposed
              </span>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Admin / super-admin only. Each task follows the contact's assignee; LO-less contacts round-robin over the fallback pool.
            </p>
          </div>
          <button onClick={resetAndClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {result ? (
          /* ── Result summary ──────────────────────────────────────────── */
          <div className="px-7 py-8 overflow-y-auto">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <h4 className="text-lg font-semibold mb-1">Tasks created</h4>
              <p className="text-sm text-muted-foreground mb-6">{result.source}</p>
              <div className="grid grid-cols-3 gap-3 w-full max-w-md mb-6">
                <SummaryStat label="Created" value={result.assignments.length} />
                <SummaryStat label="Existing LO" value={result.existingLoCount} />
                <SummaryStat label="Round-robin" value={result.roundRobinCount} accent />
              </div>
              {result.skipped > 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6">
                  {result.skipped} contact{result.skipped === 1 ? "" : "s"} skipped ({complianceLabel})
                </p>
              )}
              <button onClick={resetAndClose} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-[1fr_320px] flex-1 min-h-0">
            {/* ── Config column ─────────────────────────────────────────── */}
            <div className="px-7 py-5 space-y-5 overflow-y-auto">
              {/* Target */}
              <div>
                <label className="block text-sm font-medium mb-2">Target</label>
                <div className="flex gap-2 mb-3">
                  {(["segment", "contacts"] as TargetMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setTargetMode(m)}
                      className={`flex-1 py-2 text-sm rounded-lg border-2 capitalize transition-colors ${
                        targetMode === m ? "border-primary bg-primary/5 text-primary font-medium" : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {m === "segment" ? "Segment" : "Pick contacts"}
                    </button>
                  ))}
                </div>
                {targetMode === "segment" ? (
                  <select
                    value={segmentId}
                    onChange={(e) => setSegmentId(e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select a segment…</option>
                    {activeSegments.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="relative border-b border-border">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        placeholder="Search contacts…"
                        className="w-full pl-8 pr-3 py-2 text-sm bg-background focus:outline-none"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {filteredContacts.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/40 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={selectedContactIds.includes(c.id)}
                            onChange={() => toggleContact(c.id)}
                            className="rounded border-border"
                          />
                          <span className="truncate flex-1">{c.firstName} {c.lastName}</span>
                          {!c.loanOfficer && <span className="text-[10px] text-amber-600">no LO</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Task type */}
              <div>
                <label className="block text-sm font-medium mb-2">Task type</label>
                <div className="flex gap-2">
                  {TASK_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTaskType(t)}
                      className={`flex-1 py-2 text-sm rounded-lg border-2 transition-colors ${
                        taskType === t ? "border-primary bg-primary/5 text-primary font-medium" : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due + objective */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Due date <span className="text-destructive">*</span></label>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Objective <span className="text-destructive">*</span></label>
                <textarea
                  rows={2}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="e.g. Follow up on Q2 campaign interest"
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              {/* Round-robin fallback pool */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Round-robin fallback pool</label>
                  <button onClick={onManageGroups} className="text-xs text-primary hover:underline">Manage groups →</button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">Used only for contacts with no existing assignee.</p>
                <div className="flex gap-2 mb-2">
                  {([["all", "All users"], ["group", "LO group"], ["custom", "Include list"]] as [PoolMode, string][]).map(([m, label]) => (
                    <button
                      key={m}
                      onClick={() => setPoolMode(m)}
                      className={`flex-1 py-1.5 text-xs rounded-lg border-2 transition-colors ${
                        poolMode === m ? "border-primary bg-primary/5 text-primary font-medium" : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {poolMode === "group" && (
                  <select
                    value={poolGroupId}
                    onChange={(e) => setPoolGroupId(e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select a group…</option>
                    {loGroups.filter((g) => g.isActive).map((g) => (
                      <option key={g.id} value={g.id}>{g.name} ({g.memberNames.length})</option>
                    ))}
                  </select>
                )}
                {poolMode === "custom" && (
                  <div className="flex flex-wrap gap-1.5">
                    {INTERNAL_USER_NAMES.map((name) => {
                      const on = customPool.includes(name);
                      return (
                        <button
                          key={name}
                          onClick={() => toggleCustomPoolUser(name)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            on ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Preview column ────────────────────────────────────────── */}
            <div className="border-t md:border-t-0 md:border-l border-border bg-muted/30 px-5 py-5 space-y-4 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview</p>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <span className="text-2xl font-bold text-foreground tabular-nums">{effectiveTargets.length}</span>
                </div>
                <span className="text-xs text-muted-foreground">contacts matched{excludeCompliance && flaggedContacts.length > 0 ? ` (after excludes)` : ""}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-card px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                    <UserCheck className="w-3 h-3" /> Existing LO
                  </div>
                  <span className="text-lg font-semibold tabular-nums">{preview.existingLoCount}</span>
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                    <Shuffle className="w-3 h-3" /> Round-robin
                  </div>
                  <span className="text-lg font-semibold tabular-nums text-primary">{preview.roundRobinCount}</span>
                </div>
              </div>

              {/* Per-assignee split */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Projected per-assignee split</p>
                {perAssigneeRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 italic">Select a target to preview</p>
                ) : (
                  <div className="space-y-1.5">
                    {perAssigneeRows.map(([name, count]) => (
                      <div key={name} className="flex items-center gap-2">
                        <span className="text-xs text-foreground w-24 truncate shrink-0">{name}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary/60 rounded-full" style={{ width: `${maxCount > 0 ? (count / maxCount) * 100 : 0}%` }} />
                        </div>
                        <span className="text-xs font-semibold tabular-nums w-5 text-right shrink-0">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* DNC / consent warn-and-choose */}
              {flaggedContacts.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    {taskType === "Call" ? <PhoneOff className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-amber-800">
                        {flaggedContacts.length} contact{flaggedContacts.length === 1 ? "" : "s"} flagged: {complianceLabel}
                      </p>
                      <label className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-700 cursor-pointer select-none">
                        <input type="checkbox" checked={excludeCompliance} onChange={(e) => setExcludeCompliance(e.target.checked)} className="rounded border-amber-300" />
                        Exclude them ({excludeCompliance ? `skipping ${flaggedContacts.length}` : "including all"})
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          </div>
        )}

        {/* Footer */}
        {!result && (
          <div className="flex items-center justify-between gap-3 px-7 py-4 border-t border-border shrink-0">
            <span className="text-xs text-muted-foreground">
              {effectiveTargets.length} task{effectiveTargets.length === 1 ? "" : "s"} will be created
            </span>
            <div className="flex gap-3">
              <button onClick={resetAndClose} className="px-4 py-2.5 border-2 border-border text-foreground rounded-lg text-sm hover:bg-muted transition-colors">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={effectiveTargets.length === 0}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-opacity ${
                  effectiveTargets.length === 0 ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary text-primary-foreground hover:opacity-90"
                }`}
              >
                Create {effectiveTargets.length > 0 ? effectiveTargets.length : ""} tasks
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-3">
      <div className={`text-2xl font-bold tabular-nums ${accent ? "text-primary" : "text-foreground"}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}
