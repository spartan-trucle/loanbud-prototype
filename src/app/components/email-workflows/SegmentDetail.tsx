import { useParams, useNavigate } from "react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Users,
  Workflow,
  Calendar,
  User as UserIcon,
  Clock,
  Edit,
} from "lucide-react";
import { useAppData } from "@/app/contexts/AppDataContext";
import type { FilterRule, SegmentV2 } from "@/app/types";
import { InlineToggle } from "@/app/components/email-workflows/segment-builder/InlineToggle";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/app/components/ui/dialog";

const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

const FIELD_LABEL: Record<string, string> = {
  listingStatus: "Listing Status",
  userType: "User Type",
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  phone: "Phone",
  listingName: "Listing Name",
  self_reported_fico: "FICO Score",
  funding_purpose: "Funding Purpose",
  requested_amount: "Requested Amount",
  funding_timeline: "Funding Timeline",
};

const OP_LABEL: Record<FilterRule["operator"], string> = {
  "=": "is",
  "!=": "is not",
  contains: "contains",
  not_contains: "not contains",
  ">": "greater than",
  "<": "less than",
  ">=": "at least",
  "<=": "at most",
  before: "before",
  after: "after",
};

function FilterRuleChip({
  rule,
  variant = "include",
}: {
  rule: FilterRule;
  variant?: "include" | "exclude";
}) {
  const opLabel = OP_LABEL[rule.operator] ?? rule.operator;
  const chipCls =
    variant === "include"
      ? "bg-green-50 border-green-200 text-green-900 dark:bg-green-950/40 dark:border-green-800 dark:text-green-200"
      : "bg-red-50 border-red-200 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200";
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs border ${chipCls}`}>
      <span className="opacity-70">{FIELD_LABEL[rule.field]}</span>
      <span className="font-medium">{opLabel}</span>
      <span className="font-semibold">{rule.value}</span>
    </span>
  );
}

function LogicBadge({ label }: { label: string }) {
  return (
    <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
      {label}
    </span>
  );
}

export function SegmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { segments, contacts, workflows, handleUpdateSegment } = useAppData();

  const segment = segments.find((s) => s.id === id);

  const [detailTab, setDetailTab] = useState<"contacts" | "settings">("contacts");
  const [pendingStatus, setPendingStatus] = useState<"Active" | "Inactive" | null>(null);
  const [pendingSegmentType, setPendingSegmentType] = useState<"dynamic" | "static" | null>(null);
  const [editingGeneral, setEditingGeneral] = useState(false);
  const [editName, setEditName] = useState(segment?.name ?? "");
  const [editDesc, setEditDesc] = useState(segment?.description ?? "");

  const disabledIds = new Set(segment?.excludedContactIds ?? []);


  if (!segment) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Segment not found.</p>
          <button
            onClick={() => navigate("/email-workflows/user-segments")}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
          >
            Back to Segments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-8 sticky top-0 z-10">
        <div className="py-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/email-workflows/user-segments")}
            className="p-1.5 rounded hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>

          <div className="flex items-center justify-between flex-1 gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-xl font-semibold text-foreground">{segment.name}</h2>
              <p className="text-xs text-muted-foreground">
                {segment.description || "No description"}
              </p>
            </div>
            <span
              className={`px-3 py-0.5 rounded-full text-xs shrink-0 ${
                segment.status === "Active"
                  ? "bg-green-100 text-green-700 border border-green-200"
                  : "bg-gray-100 text-gray-700 border border-gray-200"
              }`}
            >
              {segment.status}
            </span>
          </div>

          <div className="ml-auto">
            <button
              onClick={() => navigate("/email-workflows/flows/new", { state: { segmentId: segment.id } })}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all"
            >
              <Workflow className="w-4 h-4" />
              Create Workflow
            </button>
          </div>
        </div>
        <div className="-mx-8 border-t border-border" />

        {/* Rules summary */}
        {(segment.filters.length > 0 ||
          (segment.excludeFilters?.length ?? 0) > 0 ||
          (segment.includedContactIds?.length ?? 0) > 0 ||
          (segment.excludedContactIds?.length ?? 0) > 0) && (
          <div className="mt-3 space-y-2">
            {/* Include filters */}
            {segment.filters.length > 0 && (
              <div className="flex items-start gap-3 flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground w-14 flex-shrink-0 pt-1">
                  Include
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {segment.filters.map((rule, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      <FilterRuleChip rule={rule} variant="include" />
                      {i < segment.filters.length - 1 && (
                        <LogicBadge label={rule.logic} />
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Pinned contacts */}
            {(segment.includedContactIds?.length ?? 0) > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground w-14 flex-shrink-0">
                  Pinned
                </span>
                <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
                  +{segment.includedContactIds!.length} always in
                </span>
              </div>
            )}
          </div>
        )}

        {/* Stats row */}
        {(() => {
          const activeWorkflows = workflows.filter((w) => w.segmentId === segment.id && w.status === "active").length;
          const totalWorkflows = workflows.filter((w) => w.segmentId === segment.id).length;
          const stats = [
            { icon: <Users className="w-4.5 h-4.5 text-blue-600" />, label: "Contacts", value: segment.contactCount.toLocaleString() },
            { icon: <UserIcon className="w-4.5 h-4.5 text-muted-foreground" />, label: "Created By", value: segment.createdBy },
            { icon: <Calendar className="w-4.5 h-4.5 text-violet-600" />, label: "Created", value: formatDateTime(segment.createdAt) },
            { icon: <Clock className="w-4.5 h-4.5 text-amber-500" />, label: "Last Updated", value: formatDateTime(segment.lastUpdatedAt) },
            { icon: <Workflow className="w-4.5 h-4.5 text-emerald-600" />, label: "Workflows", value: `${totalWorkflows} total · ${activeWorkflows} active` },
          ];
          return (
            <div className="mt-3 pb-5 flex items-stretch gap-3">
              {stats.map((s) => (
                <div key={s.label} className="flex items-center gap-2 px-3 py-3 rounded-lg bg-white border border-gray-200 min-w-0 flex-1">
                  {s.icon}
                  <div className="min-w-0">
                    <div className="text-[10px] text-muted-foreground leading-none mb-0.5">{s.label}</div>
                    <div className="text-xs font-medium text-foreground truncate">{s.value}</div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Tab bar */}
      <div className="border-b border-border bg-card px-8 flex gap-1">
        {(["contacts", "settings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setDetailTab(tab)}
            className={`relative px-4 py-3 text-sm transition-colors capitalize ${
              detailTab === tab
                ? "font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
            {detailTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Configuration tab */}
      {detailTab === "settings" && (
        <div className="flex-1 overflow-auto px-8 py-6">
          <div className="max-w-2xl mx-auto space-y-6">

            {/* General */}
            <div className="bg-card border border-border rounded-xl px-6 py-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  General
                </p>
                {!editingGeneral ? (
                  <button
                    onClick={() => { setEditName(segment.name); setEditDesc(segment.description ?? ""); setEditingGeneral(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingGeneral(false)}
                      className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={!editName.trim()}
                      onClick={() => {
                        handleUpdateSegment(segment.id, { name: editName.trim(), description: editDesc.trim() });
                        setEditingGeneral(false);
                      }}
                      className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
              {!editingGeneral ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Name</p>
                    <p className="text-sm text-foreground">{segment.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                    <p className="text-sm text-muted-foreground">{segment.description || "No description"}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Segment name"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                    <input
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Add a description…"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="bg-card border border-border rounded-xl px-6 py-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Status
              </p>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className={`text-sm font-semibold ${segment.status === "Active" ? "text-green-700" : "text-muted-foreground"}`}>
                    {segment.status}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {segment.status === "Active"
                      ? "This segment is live and contacts will be enrolled in workflows."
                      : "This segment is paused and will not enroll contacts in workflows."}
                  </p>
                </div>
                <InlineToggle
                  checked={segment.status === "Active"}
                  onChange={(v) => {
                    const newStatus = v ? "Active" : "Inactive";
                    const affected = workflows.filter((wf) => wf.segmentId === segment.id);
                    if (affected.length > 0) {
                      setPendingStatus(newStatus);
                    } else {
                      handleUpdateSegment(segment.id, { status: newStatus });
                    }
                  }}
                />
              </div>
              <Dialog
                open={pendingStatus !== null}
                onOpenChange={(open) => { if (!open) setPendingStatus(null); }}
              >
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {pendingStatus === "Inactive" ? "Deactivate Segment?" : "Reactivate Segment?"}
                    </DialogTitle>
                    <DialogDescription asChild>
                      <div className="space-y-3 pt-1">
                        <p className="text-sm text-muted-foreground">
                          {pendingStatus === "Inactive"
                            ? "No new contacts will be enrolled in the following workflows. Existing enrollments are not affected."
                            : "New contacts will resume being enrolled in the following workflows."}
                        </p>
                        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-2">
                          {workflows
                            .filter((wf) => wf.segmentId === segment.id)
                            .map((wf) => (
                              <div key={wf.id} className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium text-foreground">{wf.name}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs border ${
                                  wf.status === "active"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : wf.status === "paused"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-gray-50 text-gray-600 border-gray-200"
                                }`}>
                                  {wf.status}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <button
                      onClick={() => setPendingStatus(null)}
                      className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (pendingStatus) {
                          handleUpdateSegment(segment.id, { status: pendingStatus });
                        }
                        setPendingStatus(null);
                      }}
                      className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                        pendingStatus === "Inactive"
                          ? "bg-destructive text-destructive-foreground hover:opacity-90"
                          : "bg-primary text-primary-foreground hover:opacity-90"
                      }`}
                    >
                      {pendingStatus === "Inactive" ? "Deactivate" : "Reactivate"}
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Segment Type */}
            {(() => {
              const segmentV2 = segment as SegmentV2;
              const currentType = segmentV2.segmentType ?? "dynamic";
              return (
                <div className="bg-card border border-border rounded-xl px-6 py-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                    Segment Type
                  </p>
                  <div className="flex gap-3">
                    {(["dynamic", "static"] as const).map((type) => {
                      const isSelected = currentType === type;
                      return (
                        <button
                          key={type}
                          onClick={() => {
                            if (!isSelected) setPendingSegmentType(type);
                          }}
                          className={`flex-1 flex flex-col gap-1 px-4 py-3 rounded-lg border text-left transition-colors ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <span className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>
                            {type === "dynamic" ? "Dynamic" : "Snapshot"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {type === "dynamic"
                              ? "Contacts are re-evaluated on every enrollment run."
                              : "Contact list is locked at the time the segment is saved."}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <Dialog open={!!pendingSegmentType} onOpenChange={(open) => { if (!open) setPendingSegmentType(null); }}>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Change to {pendingSegmentType === "dynamic" ? "Dynamic" : "Snapshot"}?</DialogTitle>
                        <DialogDescription asChild>
                          <div className="space-y-4 pt-1">
                            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                              {pendingSegmentType === "dynamic" ? (
                                <>
                                  <p className="text-sm font-semibold text-foreground mb-1">Dynamic</p>
                                  <p className="text-sm text-muted-foreground">
                                    Contacts are re-evaluated against the segment's filter rules on every enrollment run. New contacts who match the rules are automatically included; contacts who no longer match are excluded.
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="text-sm font-semibold text-foreground mb-1">Snapshot</p>
                                  <p className="text-sm text-muted-foreground">
                                    The contact list is locked at the time the segment is saved. No new contacts are added automatically — the list stays fixed regardless of future filter rule changes.
                                  </p>
                                </>
                              )}
                            </div>
                            {pendingSegmentType === "static" && (() => {
                              const enrolledWorkflows = workflows.filter(w => w.segmentId === segment.id);
                              const contactCount = contacts.length;
                              return (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
                                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Current Segment State</p>
                                  <div className="flex gap-4">
                                    <div>
                                      <p className="text-lg font-bold text-foreground">{contactCount}</p>
                                      <p className="text-xs text-muted-foreground">contacts will be locked in</p>
                                    </div>
                                    <div className="w-px bg-amber-200" />
                                    <div>
                                      <p className="text-lg font-bold text-foreground">{enrolledWorkflows.length}</p>
                                      <p className="text-xs text-muted-foreground">workflow{enrolledWorkflows.length !== 1 ? "s" : ""} using this segment</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                            <p className="text-sm text-muted-foreground">
                              This will affect how contacts are evaluated for all workflows using this segment. This action can be undone by switching back.
                            </p>
                          </div>
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <button
                          onClick={() => setPendingSegmentType(null)}
                          className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            if (pendingSegmentType) {
                              handleUpdateSegment(segment.id, { segmentType: pendingSegmentType } as Partial<SegmentV2>);
                            }
                            setPendingSegmentType(null);
                          }}
                          className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-colors"
                        >
                          Confirm Change
                        </button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              );
            })()}

            {/* Rules */}
            <div className="bg-card border border-border rounded-xl px-6 py-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Segment Rules
                </p>
                <button
                  onClick={() =>
                    navigate("/email-workflows/user-segments/builder", {
                      state: { segmentId: segment.id },
                    })
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  <Edit className="w-4.5 h-4.5" />
                  Edit Rules
                </button>
              </div>

              {segment.filters.length === 0 &&
              !segment.excludeFilters?.length &&
              !segment.includedContactIds?.length &&
              !segment.excludedContactIds?.length ? (
                <p className="text-sm text-muted-foreground">No rules defined.</p>
              ) : (
                <div className="space-y-3">
                  {segment.filters.length > 0 && (
                    <div className="flex items-start gap-3 flex-wrap">
                      <span className="text-xs font-semibold text-muted-foreground w-14 flex-shrink-0 pt-1">Include</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {segment.filters.map((rule, i) => (
                          <span key={i} className="flex items-center gap-1.5">
                            <FilterRuleChip rule={rule} variant="include" />
                            {i < segment.filters.length - 1 && <LogicBadge label={rule.logic} />}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(segment.includedContactIds?.length ?? 0) > 0 && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs font-semibold text-muted-foreground w-14 flex-shrink-0">Pinned</span>
                      <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border bg-blue-50 text-blue-600 border-blue-200">
                        +{segment.includedContactIds!.length} always in
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Contacts tab */}
      {detailTab === "contacts" && (
      <div className="flex-1 overflow-auto px-8 py-6">
        <div>
        <div className="bg-card border border-border rounded-lg w-fit min-w-full">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border sticky top-0">
              <tr>
                {["Name", "Email", "User Type", "Listing Status", "Listing Name"].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-6 py-4 text-left text-sm text-muted-foreground"
                      style={{ fontFamily: "var(--font-sans)", fontWeight: 600 }}
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contacts.map((contact) => {
                const isDisabled = disabledIds.has(contact.id);
                return (
                  <tr
                    key={contact.id}
                    className={`transition-colors ${isDisabled ? "opacity-50 bg-muted/20" : "hover:bg-muted/20 cursor-pointer"}`}
                    onClick={() => !isDisabled && navigate(`/crm/contacts/${contact.id}`)}
                  >
                    <td className="px-6 py-4 font-medium">
                      {contact.firstName} {contact.lastName}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {contact.email}
                    </td>
                    <td className="px-6 py-4 text-sm">{contact.userType}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 text-xs rounded-full bg-muted border border-border">
                        {contact.listingStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {contact.listingName}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {contacts.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No contacts in this view</p>
            </div>
          )}
        </div>
        </div>
      </div>
      )}
    </div>
  );
}
