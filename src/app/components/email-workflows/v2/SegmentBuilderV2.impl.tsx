import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { Plus, Save, Pencil, X, Copy, Trash2, ChevronDown } from "lucide-react";
import type { Contact, ContactLeadAnswer, FilterRule, SavedSegment, Segment, Workflow } from "@/app/types";
import { answerValue } from "@/app/data/contactLeadAnswers";
import type { FilterFieldV2, FilterOperatorV2, FilterRuleV2, FilterGroupV2 } from "@/app/types";
import { SegmentPreviewPanel } from "../segment-builder/SegmentPreviewPanel";
import { SpecificContactPicker } from "../segment-builder/SpecificContactPicker";
import { FilterFieldPicker } from "../segment-builder/FilterFieldPicker";
import {
  buildFieldConfig,
  buildFieldPickerItems,
  fieldConfigFor,
  OPERATOR_LABELS,
  defaultValueForField,
  defaultOperatorForField,
} from "../segment-builder/fieldConfig";
import { useAppData } from "@/app/contexts/AppDataContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGroupV2(): FilterGroupV2 {
  return { id: `group-${Date.now()}-${Math.random()}`, filters: [], connectorAfter: "or" };
}

// Simplified filter evaluation for live preview and static snapshot
function evalFilterV2(f: FilterRuleV2, contact: Contact, _workflows: Workflow[], leadAnswers: ContactLeadAnswer[]): boolean {
  const field = f.field;
  const op = f.operator;

  // Text fields with string comparison operators
  const TEXT_FIELDS: FilterFieldV2[] = ["firstName", "lastName", "email", "phone", "brokerageName", "listingName"];
  if (TEXT_FIELDS.includes(field)) {
    const raw = (contact as unknown as Record<string, unknown>)[field];
    const val = String(raw ?? "").toLowerCase();
    const target = f.value.toLowerCase();
    switch (op) {
      case "=": return val === target;
      case "!=": return val !== target;
      case "contains": return val.includes(target);
      case "not_contains": return !val.includes(target);
      default: return true;
    }
  }

  if (field === "listingStatus") {
    const val = contact.listingStatus;
    return op === "=" ? val === f.value : val !== f.value;
  }
  if (field === "userType") {
    const val = contact.userType;
    return op === "=" ? val === f.value : val !== f.value;
  }
  if (field === "optedOut") {
    return op === "is true" ? contact.optedOut === true : contact.optedOut !== true;
  }
  if (field === "openReminders") {
    const num = contact.openReminders ?? 0;
    const target = Number(f.value);
    switch (op) {
      case "=": return num === target;
      case "!=": return num !== target;
      case ">": return num > target;
      case "<": return num < target;
      case ">=": return num >= target;
      case "<=": return num <= target;
      default: return true;
    }
  }
  if (field === "createAt") {
    const contactDate = contact.createAt ? new Date(contact.createAt).getTime() : 0;
    if (op === "within_last_n_days") {
      const days = Number(f.value) || 7;
      return contactDate >= Date.now() - days * 86400000;
    }
    const target = new Date(f.value).getTime();
    if (op === "before") return contactDate < target;
    if (op === "after") return contactDate > target;
    return true;
  }
  // Anything left is a lead answer: one row per contact per question, looked up by
  // the target key — which is also the filter id.
  const answer = answerValue(contact.id, field, leadAnswers);
  if (answer !== undefined) {
    const val = answer.trim().toLowerCase();
    const target = f.value.trim().toLowerCase();
    switch (op) {
      case "=": return val === target;
      case "!=": return val !== target;
      case "contains": return val.includes(target);
      case "not_contains": return !val.includes(target);
      case ">": return Number(answer) > Number(f.value);
      case "<": return Number(answer) < Number(f.value);
      case ">=": return Number(answer) >= Number(f.value);
      case "<=": return Number(answer) <= Number(f.value);
      case "before": return new Date(answer).getTime() < new Date(f.value).getTime();
      case "after": return new Date(answer).getTime() > new Date(f.value).getTime();
      default: return true;
    }
  }
  // A contact with no answer fails a positive rule but satisfies a negative one.
  if (op === "!=" || op === "not_contains") return true;
  if (KNOWN_UNEVALUABLE.has(field)) return true;
  return false;
}

/** Fields the preview genuinely cannot judge client-side, rather than empty ones. */
const KNOWN_UNEVALUABLE = new Set<string>([
  "hasActiveEnrollment",
  "enrolledInWorkflow",
  "lastContacted",
  "brokerageName",
]);

function evalGroupV2(group: FilterGroupV2, contact: Contact, workflows: Workflow[], leadAnswers: ContactLeadAnswer[]): boolean {
  if (group.filters.length === 0) return true;
  let result = evalFilterV2(group.filters[0], contact, workflows, leadAnswers);
  for (let i = 1; i < group.filters.length; i++) {
    const next = evalFilterV2(group.filters[i], contact, workflows, leadAnswers);
    result = group.filters[i - 1].logic === "and" ? result && next : result || next;
  }
  return result;
}

function matchGroupsV2(groups: FilterGroupV2[], contacts: Contact[], workflows: Workflow[], leadAnswers: ContactLeadAnswer[]): Contact[] {
  const nonEmpty = groups.filter((g) => g.filters.length > 0);
  if (nonEmpty.length === 0) return [];
  return contacts.filter((contact) => {
    let result = evalGroupV2(nonEmpty[0], contact, workflows, leadAnswers);
    for (let i = 1; i < nonEmpty.length; i++) {
      const next = evalGroupV2(nonEmpty[i], contact, workflows, leadAnswers);
      result = nonEmpty[i - 1].connectorAfter === "and" ? result && next : result || next;
    }
    return result;
  });
}

/**
 * Fields a saved segment cannot express, so a rule on one is dropped rather than
 * silently rewritten into a rule about something else.
 *
 * Custom fields are deliberately absent from this list: their key *is* the saved
 * field id, so they round-trip through the V1 shape untouched. Before that they were
 * coerced to "listingStatus", which is how a "FICO under 640" rule could come back
 * as a listing-status rule after a save.
 */
const V2_ONLY_FIELDS = new Set<string>([
  "hasActiveEnrollment",
  "enrolledInWorkflow",
  "lastContacted",
  "createAt",
  "openReminders",
  "optedOut",
  "brokerageName",
]);
const V1_OPERATORS = new Set<FilterOperatorV2>([
  "=",
  "!=",
  "contains",
  "not_contains",
  ">",
  "<",
  ">=",
  "<=",
  "before",
  "after",
]);

function isSavableRule(rule: FilterRuleV2): boolean {
  return !V2_ONLY_FIELDS.has(rule.field) && V1_OPERATORS.has(rule.operator);
}

// Convert V2 filter rules to V1-compatible for saving
function v2RuleToV1(rule: FilterRuleV2): FilterRule {
  return {
    field: rule.field,
    operator: V1_OPERATORS.has(rule.operator)
      ? (rule.operator as FilterRule["operator"])
      : "=",
    value: rule.value,
    logic: rule.logic,
  };
}

function v1RuleToV2(rule: FilterRule): FilterRuleV2 {
  return {
    field: rule.field as FilterFieldV2,
    operator: rule.operator as FilterOperatorV2,
    value: rule.value,
    logic: rule.logic,
  };
}

// ─── Group state hook ─────────────────────────────────────────────────────────

function useGroupStateV2(initial: FilterGroupV2[]) {
  const [groups, setGroups] = useState<FilterGroupV2[]>(initial);

  const addGroup = () => setGroups((prev) => [...prev, makeGroupV2()]);

  const toggleGroupConnector = (groupId: string) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, connectorAfter: g.connectorAfter === "and" ? "or" : "and" }
          : g,
      ),
    );

  const toggleFilterLogic = (groupId: string, filterIdx: number) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              filters: g.filters.map((f, i) =>
                i === filterIdx ? { ...f, logic: f.logic === "and" ? "or" : "and" } : f,
              ),
            }
          : g,
      ),
    );

  const removeGroup = (groupId: string) =>
    setGroups((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((g) => g.id !== groupId);
    });

  const duplicateGroup = (groupId: string) =>
    setGroups((prev) => {
      const idx = prev.findIndex((g) => g.id === groupId);
      if (idx === -1) return prev;
      const copy: FilterGroupV2 = {
        id: `group-${Date.now()}`,
        filters: prev[idx].filters.map((f) => ({ ...f })),
        connectorAfter: prev[idx].connectorAfter,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });

  const addFilter = (groupId: string) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              filters: [
                ...g.filters,
                {
                  field: "listingStatus" as FilterFieldV2,
                  operator: "=" as FilterOperatorV2,
                  value: "New",
                  logic: "and" as const,
                },
              ],
            }
          : g,
      ),
    );

  const updateFilter = (groupId: string, index: number, updates: Partial<FilterRuleV2>) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, filters: g.filters.map((f, i) => (i === index ? { ...f, ...updates } : f)) }
          : g,
      ),
    );

  const removeFilter = (groupId: string, index: number) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, filters: g.filters.filter((_, i) => i !== index) } : g,
      ),
    );

  const reset = () => setGroups([makeGroupV2()]);

  return {
    groups,
    addGroup,
    toggleGroupConnector,
    toggleFilterLogic,
    removeGroup,
    duplicateGroup,
    addFilter,
    updateFilter,
    removeFilter,
    reset,
  };
}

// ─── FilterGroupCardV2 ────────────────────────────────────────────────────────

const selectClass =
  "px-3 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none";

const connectorBadge = (label: string) => (
  <span className="px-2 py-0.5 bg-muted border border-border rounded-full text-xs font-semibold text-muted-foreground uppercase tracking-wide">
    {label}
  </span>
);

interface FilterGroupCardV2Props {
  group: FilterGroupV2;
  groupIdx: number;
  isOnly: boolean;
  isLast: boolean;
  workflows: Workflow[];
  onAddFilter: (groupId: string) => void;
  onRemoveFilter: (groupId: string, idx: number) => void;
  onUpdateFilter: (groupId: string, idx: number, updates: Partial<FilterRuleV2>) => void;
  onDuplicateGroup: (groupId: string) => void;
  onRemoveGroup: (groupId: string) => void;
}

function FilterGroupCardV2({
  group,
  groupIdx,
  isOnly,
  isLast,
  workflows,
  onAddFilter,
  onRemoveFilter,
  onUpdateFilter,
  onDuplicateGroup,
  onRemoveGroup,
}: FilterGroupCardV2Props) {
  // Field vocabulary is runtime data now: every custom field marked filterable
  // shows up here, which is what makes that switch true.
  const { customFieldDefinitions } = useAppData();
  const fieldConfig = useMemo(
    () => buildFieldConfig(customFieldDefinitions),
    [customFieldDefinitions],
  );
  const fieldPickerItems = useMemo(
    () => buildFieldPickerItems(customFieldDefinitions),
    [customFieldDefinitions],
  );

  return (
    <div>
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {/* Group header */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Group {groupIdx + 1}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onDuplicateGroup(group.id)}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
              title="Duplicate group"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onRemoveGroup(group.id)}
              disabled={isOnly}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Remove group"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 space-y-2">
          {group.filters.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No filters — add one below to match contacts.
            </p>
          ) : (
            group.filters.map((filter, filterIdx) => {
              const cfg = fieldConfigFor(filter.field, fieldConfig);
              return (
                <div key={filterIdx}>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Field selector */}
                    <FilterFieldPicker
                      value={filter.field}
                      fields={fieldPickerItems}
                      onChange={(newField) => {
                        onUpdateFilter(group.id, filterIdx, {
                          field: newField,
                          operator: defaultOperatorForField(newField, fieldConfig),
                          value: defaultValueForField(newField, fieldConfig),
                        });
                      }}
                    />

                    {/* Operator selector */}
                    <div className="relative">
                      <select
                        value={filter.operator}
                        onChange={(e) =>
                          onUpdateFilter(group.id, filterIdx, {
                            operator: e.target.value as FilterOperatorV2,
                          })
                        }
                        className={selectClass}
                      >
                        {cfg.operators.map((op) => (
                          <option key={op} value={op}>{OPERATOR_LABELS[op] ?? op}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                    </div>

                    {/* Value input — hidden for boolean fields */}
                    {cfg.type !== "boolean" && (
                      <div className="relative">
                        {cfg.type === "select" && cfg.options ? (
                          <>
                            <select
                              value={filter.value}
                              onChange={(e) =>
                                onUpdateFilter(group.id, filterIdx, { value: e.target.value })
                              }
                              className={selectClass}
                            >
                              {cfg.options.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                          </>
                        ) : cfg.type === "workflow" ? (
                          <>
                            <select
                              value={filter.value}
                              onChange={(e) =>
                                onUpdateFilter(group.id, filterIdx, { value: e.target.value })
                              }
                              className={selectClass}
                            >
                              <option value="">Select workflow…</option>
                              {workflows.map((wf) => (
                                <option key={wf.id} value={wf.id}>{wf.name}</option>
                              ))}
                            </select>
                            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                          </>
                        ) : cfg.type === "date" ? (
                          filter.operator === "within_last_n_days" ? (
                            <input
                              type="number"
                              min={1}
                              value={filter.value || "7"}
                              onChange={(e) =>
                                onUpdateFilter(group.id, filterIdx, { value: e.target.value })
                              }
                              placeholder="days"
                              className={`${selectClass} w-20`}
                            />
                          ) : (
                            <input
                              type="date"
                              value={filter.value}
                              onChange={(e) =>
                                onUpdateFilter(group.id, filterIdx, { value: e.target.value })
                              }
                              className={selectClass}
                            />
                          )
                        ) : cfg.type === "number" ? (
                          <input
                            type="number"
                            value={filter.value || "0"}
                            onChange={(e) =>
                              onUpdateFilter(group.id, filterIdx, { value: e.target.value })
                            }
                            placeholder="0"
                            className={`${selectClass} w-24`}
                          />
                        ) : (
                          <input
                            type="text"
                            value={filter.value}
                            onChange={(e) =>
                              onUpdateFilter(group.id, filterIdx, { value: e.target.value })
                            }
                            placeholder="value…"
                            className={`${selectClass} w-36`}
                          />
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => onRemoveFilter(group.id, filterIdx)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors ml-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Static AND connector between filters */}
                  {filterIdx < group.filters.length - 1 && (
                    <div className="flex items-center gap-2 my-1.5 pl-1">
                      {connectorBadge("and")}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Add filter row */}
          <div className="flex items-center gap-3 pt-1">
            {group.filters.length > 0 && connectorBadge("and")}
            <button
              onClick={() => onAddFilter(group.id)}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Add filter
            </button>
          </div>
        </div>
      </div>

      {/* Static OR connector between groups */}
      {!isLast && (
        <div className="flex items-center gap-3 my-2 pl-2">
          {connectorBadge("or")}
        </div>
      )}
    </div>
  );
}

// ─── SegmentBuilderV2 props ───────────────────────────────────────────────────

type SegmentType = "dynamic" | "static";

interface SegmentBuilderV2Props {
  contacts?: Contact[];
  savedSegments?: SavedSegment[];
  onSaveSegment?: (segment: SavedSegment) => void;
  onDeleteSegment?: (id: string) => void;
  onBack?: () => void;
  initialName?: string;
  initialDescription?: string;
  initialSegment?: SavedSegment;
  embeddedMode?: boolean;
}

type PinnedContact = { contactId: string; mode: "include" | "exclude" };

function filtersToGroupV2(filters: FilterRule[] | undefined): FilterGroupV2[] {
  if (!filters?.length) return [makeGroupV2()];
  return [
    {
      id: "group-init",
      filters: filters.map(v1RuleToV2),
      connectorAfter: "or",
    },
  ];
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SegmentBuilderV2({
  contacts: contactsProp,
  onSaveSegment: onSaveSegmentProp,
  onBack,
  initialName,
  initialDescription,
  initialSegment,
  embeddedMode = false,
}: SegmentBuilderV2Props) {
  const { workflows, contacts: contextContacts, contactLeadAnswers, handleCreateSegment, handleUpdateSegment } = useAppData();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = !initialSegment
    ? (location.state as { name?: string; description?: string } | null)
    : null;
  const contacts = contactsProp ?? contextContacts;
  const onSaveSegment = onSaveSegmentProp ?? ((seg: SavedSegment) => {
    const base: Omit<Segment, "id" | "createdAt" | "lastUpdatedAt"> = {
      name: seg.name,
      description: seg.description,
      contactCount: 0,
      status: "Active",
      createdBy: "User",
      filters: seg.filters,
      excludeFilters: seg.excludeFilters,
      includedContactIds: seg.includedContactIds,
      excludedContactIds: seg.excludedContactIds,
    };
    if (initialSegment) {
      handleUpdateSegment(seg.id, base);
    } else {
      handleCreateSegment(base);
    }
  });

  const [segName, setSegName] = useState(initialName ?? locationState?.name ?? "New segment");
  const [segDescription, setSegDescription] = useState(initialDescription ?? locationState?.description ?? "");
  const [editingName, setEditingName] = useState(false);
  const [segmentType, setSegmentType] = useState<SegmentType>("dynamic");
  const [activeTab, setActiveTab] = useState<"include" | "exclude">("include");
  const [specificContacts, setSpecificContacts] = useState<PinnedContact[]>(() => {
    const inc = (initialSegment?.includedContactIds ?? []).map((id) => ({
      contactId: id,
      mode: "include" as const,
    }));
    const exc = (initialSegment?.excludedContactIds ?? []).map((id) => ({
      contactId: id,
      mode: "exclude" as const,
    }));
    return [...inc, ...exc];
  });

  const include = useGroupStateV2(filtersToGroupV2(initialSegment?.filters));
  const exclude = useGroupStateV2(filtersToGroupV2(initialSegment?.excludeFilters));
  const activeGroups = activeTab === "include" ? include : exclude;

  const matchingContacts = useMemo(() => {
    const includeNonEmpty = include.groups.filter((g) => g.filters.length > 0);
    let base =
      includeNonEmpty.length === 0
        ? contacts
        : matchGroupsV2(include.groups, contacts, workflows, contactLeadAnswers);

    const excludeNonEmpty = exclude.groups.filter((g) => g.filters.length > 0);
    if (excludeNonEmpty.length > 0) {
      const excludeSet = new Set(
        matchGroupsV2(exclude.groups, contacts, workflows, contactLeadAnswers).map((c) => c.id),
      );
      base = base.filter((c) => !excludeSet.has(c.id));
    }

    const pinnedIncludeIds = new Set(
      specificContacts.filter((p) => p.mode === "include").map((p) => p.contactId),
    );
    const pinnedExcludeIds = new Set(
      specificContacts.filter((p) => p.mode === "exclude").map((p) => p.contactId),
    );

    const baseIds = new Set(base.map((c) => c.id));
    for (const id of pinnedIncludeIds) {
      if (!baseIds.has(id)) {
        const c = contacts.find((x) => x.id === id);
        if (c) base = [...base, c];
      }
    }
    base = base.filter((c) => !pinnedExcludeIds.has(c.id));
    return base;
  }, [
    contacts,
    include.groups,
    exclude.groups,
    specificContacts,
    workflows,
    contactLeadAnswers,
  ]);

  const hasNoFilters =
    include.groups.every((g) => g.filters.length === 0) && specificContacts.length === 0;

  const pinnedIncludeIds = specificContacts
    .filter((p) => p.mode === "include")
    .map((p) => p.contactId);

  function buildPayload(name: string, description: string, id: string): SavedSegment {
    // Convert V2 filter rules back to V1-compatible for storage
    const v1Filters: FilterRule[] = include.groups.flatMap((g) =>
      g.filters.filter(isSavableRule).map(v2RuleToV1),
    );
    const v1ExcludeFilters: FilterRule[] = exclude.groups.flatMap((g) =>
      g.filters.filter(isSavableRule).map(v2RuleToV1),
    );
    return {
      id,
      name,
      description,
      filters: v1Filters,
      createdAt: initialSegment?.createdAt ?? new Date(),
      excludeFilters: v1ExcludeFilters,
      includedContactIds: specificContacts
        .filter((p) => p.mode === "include")
        .map((p) => p.contactId),
      excludedContactIds: specificContacts
        .filter((p) => p.mode === "exclude")
        .map((p) => p.contactId),
    };
  }

  const handleSave = () => {
    if (!segName.trim()) return;
    const id = initialSegment?.id ?? `segment-${Date.now()}`;
    const payload = buildPayload(segName.trim(), segDescription.trim(), id);

    // V2: if static, attach snapshot
    if (segmentType === "static") {
      (payload as SavedSegment & { snapshotContactIds?: string[] }).snapshotContactIds =
        matchingContacts.map((c) => c.id);
    }

    onSaveSegment(payload);
    if (!embeddedMode) {
      const detailPath = location.pathname.startsWith("/crm/")
        ? `/crm/segments/${id}`
        : `/email-workflows/user-segments/${id}`;
      navigate(detailPath);
    } else if (!initialSegment) {
      include.reset();
      exclude.reset();
      setSpecificContacts([]);
      setSegName("New segment");
      setSegDescription("");
    }
  };

  const handleEmbeddedSave = () => {
    if (!initialSegment) return;
    const payload = buildPayload(
      initialSegment.name,
      initialSegment.description,
      initialSegment.id,
    );
    if (segmentType === "static") {
      (payload as SavedSegment & { snapshotContactIds?: string[] }).snapshotContactIds =
        matchingContacts.map((c) => c.id);
    }
    onSaveSegment(payload);
  };

  const handleAddPinned = (contactId: string, mode: "include" | "exclude") =>
    setSpecificContacts((prev) => [...prev, { contactId, mode }]);

  const handleTogglePinnedMode = (contactId: string) =>
    setSpecificContacts((prev) =>
      prev.map((p) =>
        p.contactId === contactId
          ? { ...p, mode: p.mode === "include" ? "exclude" : "include" }
          : p,
      ),
    );

  const handleRemovePinned = (contactId: string) =>
    setSpecificContacts((prev) => prev.filter((p) => p.contactId !== contactId));

  return (
    <div className="flex flex-col h-full mx-auto w-full">
      {/* Header — hidden in embedded mode */}
      {!embeddedMode && (
        <div className="px-8 py-4 border-b border-border bg-card flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-2 bg-muted border border-border rounded-lg hover:bg-muted/80 transition-all text-sm flex-shrink-0"
              >
                ← Back
              </button>
            )}
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 group">
                {editingName ? (
                  <input
                    type="text"
                    value={segName}
                    onChange={(e) => setSegName(e.target.value)}
                    onBlur={() => {
                      if (!segName.trim()) setSegName("New segment");
                      setEditingName(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") {
                        if (!segName.trim()) setSegName("New segment");
                        setEditingName(false);
                      }
                    }}
                    autoFocus
                    className="text-base font-semibold bg-transparent border-b border-border outline-none focus:outline-none text-foreground min-w-0 flex-1"
                  />
                ) : (
                  <>
                    <span className="text-base font-semibold text-foreground truncate">
                      {segName}
                    </span>
                    {/* V2 badge */}
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 leading-none flex-shrink-0">
                      V2
                    </span>
                    <button
                      onClick={() => setEditingName(true)}
                      className="text-muted-foreground/40 hover:text-muted-foreground transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
              <input
                type="text"
                value={segDescription}
                onChange={(e) => setSegDescription(e.target.value)}
                placeholder="Add a description (optional)"
                className="text-xs bg-transparent border-none outline-none focus:outline-none placeholder:text-muted-foreground/40 text-muted-foreground w-full"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={handleSave}
              disabled={!segName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              Save segment
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: builder */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="border border-border rounded-lg bg-card">
            {/* Include / Exclude tab bar */}
            <div className="flex border-b border-border">
              <button
                type="button"
                onClick={() => setActiveTab("include")}
                className={`flex-1 px-4 py-2.5 text-sm font-semibold transition-colors ${
                  activeTab === "include"
                    ? "text-foreground border-b-2 border-primary -mb-px"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Include
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("exclude")}
                className={`flex-1 px-4 py-2.5 text-sm font-semibold transition-colors ${
                  activeTab === "exclude"
                    ? "text-destructive border-b-2 border-destructive -mb-px"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Exclude
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                {activeTab === "include"
                  ? "Contacts matching these filters will be added to the segment."
                  : "Contacts matching these filters will be removed from the segment, even if they match the include rules."}
              </p>

              {/* Filter groups */}
              {activeGroups.groups.map((group, groupIdx) => (
                <FilterGroupCardV2
                  key={group.id}
                  group={group}
                  groupIdx={groupIdx}
                  isOnly={activeGroups.groups.length === 1}
                  isLast={groupIdx === activeGroups.groups.length - 1}
                  workflows={workflows}
                  onAddFilter={activeGroups.addFilter}
                  onRemoveFilter={activeGroups.removeFilter}
                  onUpdateFilter={activeGroups.updateFilter}
                  onDuplicateGroup={activeGroups.duplicateGroup}
                  onRemoveGroup={activeGroups.removeGroup}
                />
              ))}

              <button
                onClick={activeGroups.addGroup}
                className="flex items-center gap-1.5 text-sm border border-dashed border-border rounded-md px-3 py-1.5 hover:bg-muted transition-colors text-muted-foreground"
              >
                <Plus className="w-3.5 h-3.5" />
                Add filter group
              </button>

              {/* Pinned contacts */}
              <div className="flex items-center gap-3 pt-1">
                <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground whitespace-nowrap">
                  {activeTab === "include" ? "Always include" : "Always exclude"}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <SpecificContactPicker
                contacts={contacts}
                pinned={specificContacts}
                filterMode={activeTab}
                onAdd={handleAddPinned}
                onToggleMode={handleTogglePinnedMode}
                onRemove={handleRemovePinned}
              />
            </div>
          </div>

          {/* Embedded mode: save button + type toggle */}
          {embeddedMode && (
            <div className="px-6 pt-2 pb-5 flex items-center gap-3">
              <button
                onClick={handleEmbeddedSave}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all text-sm"
              >
                <Save className="w-4 h-4" />
                Save changes
              </button>
            </div>
          )}
        </div>

        {/* Right: preview panel */}
        <SegmentPreviewPanel
          matchingContacts={matchingContacts}
          totalContacts={contacts.length}
          hasNoFilters={hasNoFilters}
          pinnedIncludeIds={pinnedIncludeIds}
          segmentType={segmentType}
          onSegmentTypeChange={setSegmentType}
        />
      </div>
    </div>
  );
}
