import { AlertTriangle, ArrowRight, Ban, Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { SheetHeader, SheetTitle } from "../ui/sheet";
import { Switch } from "../ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useAppData } from "@/app/contexts/AppDataContext";
import { activeFields } from "@/app/data/customFieldUsage";
import {
  CORE_TARGETS,
  conflictingExternalKeys,
  coreTargetLabel,
  expectedCrmType,
  formMappingSummary,
  leadStatsByForm,
  mappingStatus,
  questionFromExternalKey,
  targetFieldType,
  typeMismatchReason,
  type MappingStatus,
} from "@/app/data/leadFormUtils";
import type {
  LeadFormDefinition,
  LeadFormFieldMapping,
  PlatformAccount,
} from "@/app/types";
import { PlatformMark, SyncDot } from "./PlatformMark";

/** Sentinel targets: Radix rejects an empty option value. */
const UNMAPPED = "__unmapped__";
const IGNORED = "__ignored__";

const STATUS_DOT: Record<MappingStatus, string> = {
  mapped: "bg-emerald-500",
  unmapped: "bg-muted-foreground/40",
  "type-mismatch": "bg-amber-500",
  conflict: "bg-red-500",
  ignored: "bg-muted-foreground/40",
};

const STATUS_TEXT: Record<MappingStatus, string> = {
  mapped: "text-emerald-700",
  unmapped: "text-muted-foreground",
  "type-mismatch": "text-amber-700",
  conflict: "text-red-700",
  ignored: "text-muted-foreground",
};

const STATUS_LABEL: Record<MappingStatus, string> = {
  mapped: "OK",
  unmapped: "Not mapped",
  "type-mismatch": "Type mismatch",
  conflict: "Conflict",
  ignored: "Ignored",
};

/** The rail between the two halves of a row, tinted by what happens in transit. */
const RAIL_TONE: Record<MappingStatus, string> = {
  mapped: "text-emerald-500",
  unmapped: "text-muted-foreground/30",
  "type-mismatch": "text-amber-500",
  conflict: "text-red-500",
  ignored: "text-muted-foreground/30",
};

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

/**
 * One form's field mappings, drawn as what they are: a transfer.
 *
 * Each row reads left to right — the question Meta sends, the rail it travels along,
 * the CRM field it lands in — with both types spelled out at either end. The rail is
 * the point. When the two types disagree the answer still arrives and still looks
 * fine, so the only place anyone can find out is here, at the moment of crossing.
 */
export function LeadSyncingFormPanel({
  form,
  account,
}: {
  form: LeadFormDefinition;
  account: PlatformAccount;
}) {
  const { leadForms, contacts, contactLeadAnswers, customFieldDefinitions, handleUpdateLeadForm } =
    useAppData();

  const definitions = activeFields(customFieldDefinitions);
  const conflicts = conflictingExternalKeys(leadForms);
  const summary = formMappingSummary(form, conflicts, definitions);
  const stats = leadStatsByForm(contacts, contactLeadAnswers).get(form.id);

  const rows = [...form.fieldMappings].sort((a, b) => a.order - b.order);

  const writeMappings = (mappings: LeadFormFieldMapping[]) =>
    handleUpdateLeadForm(form.id, {
      fieldMappings: mappings.map((m, index) => ({ ...m, order: index + 1 })),
    });

  const updateRow = (index: number, patch: Partial<LeadFormFieldMapping>) =>
    writeMappings(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const removeRow = (index: number) => writeMappings(rows.filter((_, i) => i !== index));

  const addRow = () =>
    writeMappings([
      ...rows,
      { externalKey: "", targetKey: "", targetKind: "custom", order: rows.length + 1 },
    ]);

  /** One control sets both halves of the destination — kind and key travel together. */
  const setTarget = (index: number, value: string) => {
    if (value === UNMAPPED) {
      updateRow(index, { targetKey: "", targetKind: "custom", isIgnored: false });
      return;
    }
    if (value === IGNORED) {
      updateRow(index, { targetKey: "", targetKind: "custom", isIgnored: true });
      return;
    }
    updateRow(index, {
      targetKey: value,
      targetKind: CORE_TARGETS.some((t) => t.key === value) ? "core" : "custom",
      isIgnored: false,
    });
  };

  const targetValue = (mapping: LeadFormFieldMapping) =>
    mapping.isIgnored ? IGNORED : mapping.targetKey || UNMAPPED;

  return (
    <>
      <SheetHeader className="px-6 pt-5 pb-4 space-y-0 border-b border-border">
        <div className="flex items-start gap-3">
          <PlatformMark
            platform={form.platform}
            className="w-8 h-8 text-[#0081FB] shrink-0"
          />
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-base">{form.name}</SheetTitle>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <SyncDot active={form.isActive} />
              Form created {formatDateTime(form.createdAtExternal)}
            </p>
            <p className="text-xs text-muted-foreground">
              {stats && stats.leads > 0
                ? `${stats.leads} submission${stats.leads === 1 ? "" : "s"} synced · last synced ${formatDateTime(form.submissionsLastSyncedAt)}`
                : `No submissions yet · last checked ${formatDateTime(form.submissionsLastSyncedAt)}`}
            </p>
          </div>
          <label className="flex items-center gap-2 shrink-0 pt-0.5">
            <span className="text-xs text-muted-foreground">Sync</span>
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => handleUpdateLeadForm(form.id, { isActive: v })}
            />
          </label>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {summary["type-mismatch"] > 0 && (
          <Callout tone="amber">
            <p className="text-sm font-medium">
              {summary["type-mismatch"]} answer
              {summary["type-mismatch"] === 1 ? "" : "s"} change shape on the way in
            </p>
            <p className="text-xs mt-1">
              They sync without error and lose what made them useful: a multiple choice
              stops being a closed set of options, a number stops being comparable.
              Meta reports both as a healthy mapping.
            </p>
          </Callout>
        )}

        {summary.conflict > 0 && (
          <Callout tone="red">
            <p className="text-sm font-medium">
              {summary.conflict} question{summary.conflict === 1 ? "" : "s"} land
              somewhere else on another form
            </p>
            <p className="text-xs mt-1">
              The same question key points at two different CRM fields depending on
              which form it arrives through, so its answers are splitting across two
              columns. Pick one destination and use it on every form.
            </p>
          </Callout>
        )}

        <div>
          <div className="flex items-baseline justify-between mb-2 gap-4">
            <h4 className="text-sm font-semibold">Field mappings</h4>
            <p className="text-xs text-muted-foreground shrink-0">
              {account.platform === "meta" ? "Meta" : account.platform} sends
              <ArrowRight className="w-3 h-3 inline mx-1 -mt-0.5" />
              the CRM stores
            </p>
          </div>

          <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
            {rows.map((mapping, index) => {
              const status = mappingStatus(mapping, conflicts, definitions);
              const mismatch = typeMismatchReason(mapping, definitions);
              const rival = conflicts.get(mapping.externalKey);
              const targetType = targetFieldType(mapping, definitions);

              return (
                <div
                  key={`${mapping.externalKey}-${index}`}
                  className="group px-4 py-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* What the form asked */}
                    <div className="min-w-0 flex-1">
                      {mapping.externalKey ? (
                        <>
                          <p className="text-sm leading-snug">
                            {questionFromExternalKey(mapping.externalKey)}
                          </p>
                          <code className="block text-xs text-muted-foreground break-all mt-0.5">
                            {mapping.externalKey}
                            {mapping.externalType && ` (${mapping.externalType})`}
                          </code>
                        </>
                      ) : (
                        <Input
                          value={mapping.externalKey}
                          placeholder="question_key_from_the_platform"
                          className="font-mono text-xs h-8"
                          onChange={(e) =>
                            updateRow(index, { externalKey: e.target.value })
                          }
                        />
                      )}
                    </div>

                    {/* The rail — the row's one moment of colour */}
                    <div
                      className={`flex flex-col items-center pt-1 shrink-0 self-stretch ${RAIL_TONE[status]}`}
                      aria-hidden="true"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span className="mt-1 w-px flex-1 bg-current opacity-30" />
                    </div>

                    {/* Where it lands */}
                    <div className="min-w-0 flex-1">
                      <Select
                        value={targetValue(mapping)}
                        onValueChange={(v) => setTarget(index, v)}
                      >
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNMAPPED}>Not mapped</SelectItem>
                          <SelectItem value={IGNORED}>Ignore this question</SelectItem>
                          <SelectGroup>
                            <SelectLabel>Contact fields</SelectLabel>
                            {CORE_TARGETS.map((target) => (
                              <SelectItem key={target.key} value={target.key}>
                                {target.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel>Custom fields</SelectLabel>
                            {definitions.map((definition) => (
                              <SelectItem key={definition.key} value={definition.key}>
                                {definition.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>

                      {mapping.targetKey && !mapping.isIgnored && (
                        <code
                          className={`block text-xs mt-1 break-all ${
                            mismatch ? "text-amber-700" : "text-muted-foreground"
                          }`}
                        >
                          {mapping.targetKind === "core"
                            ? `contact.${mapping.targetKey}`
                            : mapping.targetKey}
                          {targetType && ` (${targetType})`}
                        </code>
                      )}
                    </div>

                    {/* Status */}
                    <div className="w-[130px] shrink-0">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs ${STATUS_TEXT[status]}`}
                      >
                        {status === "ignored" ? (
                          <Ban className="w-3 h-3" />
                        ) : (
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[status]}`}
                          />
                        )}
                        {STATUS_LABEL[status]}
                      </span>

                      {mismatch && (
                        <p className="text-xs text-amber-700 mt-1 leading-snug">
                          Arrives as {expectedCrmType(mapping.externalType)}, stored as{" "}
                          {targetType}
                        </p>
                      )}
                      {status === "conflict" && rival && (
                        <p className="text-xs text-red-700 mt-1 leading-snug">
                          Also mapped to{" "}
                          {rival
                            .filter((key) => key !== mapping.targetKey)
                            .map((key) => coreTargetLabel(key))
                            .join(", ")}{" "}
                          elsewhere
                        </p>
                      )}
                      {status === "unmapped" && (
                        <p className="text-xs text-muted-foreground mt-1 leading-snug">
                          Stored, but nothing reads it
                        </p>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      className="h-8 w-8 p-0 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                      onClick={() => removeRow(index)}
                      title={`Remove the mapping for ${mapping.externalKey || "this question"}`}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {rows.length === 0 && (
              <div className="px-4 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Nothing this form collects reaches the CRM yet.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add a mapping to route its first question.
                </p>
              </div>
            )}

            <div className="px-4 py-2.5">
              <Button variant="ghost" className="h-8 text-sm" onClick={addRow}>
                <Plus className="w-4 h-4 mr-1" />
                Add mapping
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Callout({
  tone,
  children,
}: {
  tone: "amber" | "red";
  children: React.ReactNode;
}) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
  };

  return (
    <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 ${tones[tone]}`}>
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
