import { useState, useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import {
  ArrowLeft,
  ChevronRight,
  Check,
  AlertCircle,
  X,
  Search,
  Users,
  Clock,
  Mail,
  MessageSquare,
  Phone,
  GripVertical,
  Pencil,
  Trash2,
  Copy,
  GitBranch,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/app/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { useAppData } from "@/app/contexts/AppDataContext";
import type { WorkflowStep } from "@/app/types";
import type { FilterFieldV2, FilterOperatorV2 } from "@/app/types";
import { computeDayOffsets, nextFractionalOrder } from "@/app/lib/workflowUtils";
import {
  StepTypeIcon,
  StepConfigLeft,
  StepConfigRight,
  SectionLabel,
  FieldLabel,
  STEP_DEFAULTS,
  TYPE_OPTIONS,
  TYPE_ICON_STYLE,
  TYPE_ICON_BG,
  TYPE_BADGE_STYLE,
  type ActionType,
  type StepDraft,
} from "../StepConfigForm";
import { StepSummary } from "@/app/components/email-workflows/StepSummary";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/app/components/ui/dialog";
import { FilterFieldPicker } from "../segment-builder/FilterFieldPicker";
import {
  FIELD_CONFIG,
  FIELD_PICKER_ITEMS,
  OPERATOR_LABELS,
  defaultValueForField,
  defaultOperatorForField,
} from "../segment-builder/fieldConfig";

// ─── Step templates ───────────────────────────────────────────────────────────


// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStepId() {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function defaultStep(
  dayOffset: number,
  type: ActionType = "email",
): WorkflowStep {
  return {
    id: makeStepId(),
    name: STEP_DEFAULTS[type] ?? "Step",
    order: 1,
    dayOffset,
    actionType: type,
    note: "",
  };
}

function defaultDelayStep(): WorkflowStep {
  return {
    id: makeStepId(),
    name: "Wait",
    order: 1,
    dayOffset: 0,
    actionType: "delay",
    delayDays: 1,
  };
}

function defaultConditionalStep(): WorkflowStep {
  return {
    id: makeStepId(),
    name: "IF/ELSE Block",
    order: 1,
    dayOffset: 0,
    actionType: "conditional",
    conditionField: "userType",
    conditionOperator: "=",
    conditionValue: "Broker",
  };
}

function parseDelayInput(input: string): { days: number; hours: number; minutes: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const dayMatch = trimmed.match(/(\d+)\s*d/i);
  const hourMatch = trimmed.match(/(\d+)\s*h/i);
  const minMatch = trimmed.match(/(\d+)\s*m/i);
  if (!dayMatch && !hourMatch && !minMatch) return null;
  return {
    days: dayMatch ? parseInt(dayMatch[1]) : 0,
    hours: hourMatch ? Math.min(23, parseInt(hourMatch[1])) : 0,
    minutes: minMatch ? Math.min(59, parseInt(minMatch[1])) : 0,
  };
}

function stepToDelayString(step: WorkflowStep): string {
  const parts: string[] = [];
  if ((step.delayDays ?? 1) > 0) parts.push(`${step.delayDays ?? 1}d`);
  if ((step.delayHours ?? 0) > 0) parts.push(`${step.delayHours}h`);
  if ((step.delayMinutes ?? 0) > 0) parts.push(`${step.delayMinutes}m`);
  return parts.length ? parts.join(" ") : "1d";
}

// ─── BranchStepConfigModal ────────────────────────────────────────────────────

function BranchStepConfigModal({
  step,
  onSave,
  onClose,
}: {
  step: WorkflowStep;
  onSave: (updated: WorkflowStep) => void;
  onClose: () => void;
}) {
  const isDelay = step.actionType === "delay";
  const [draft, setDraft] = useState<StepDraft>({
    name: step.name,
    actionType: step.actionType as ActionType,
    templateId: step.templateId,
    templateName: step.templateName,
    senderIdentity: step.senderIdentity,
    subject: step.subject,
    body: step.body,
    smsTemplateId: step.smsTemplateId,
    smsTemplateName: step.smsTemplateName,
    message: step.message,
    note: step.note,
    reminderDaysBefore: step.reminderDaysBefore,
  });
  const [delayInput, setDelayInput] = useState(() => stepToDelayString(step));
  const [delayError, setDelayError] = useState<string | null>(null);

  function handleDelayChange(value: string) {
    setDelayInput(value);
    const parsed = parseDelayInput(value);
    setDelayError(parsed ? null : 'Invalid format — use e.g. "2d 4h 30m"');
  }

  function handleSave() {
    if (isDelay) {
      const parsed = parseDelayInput(delayInput);
      if (!parsed) return;
      onSave({ ...step, delayDays: Math.max(0, parsed.days), delayHours: parsed.hours, delayMinutes: parsed.minutes });
    } else {
      onSave({ ...step, ...draft });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              isDelay ? "border-border text-muted-foreground" : TYPE_ICON_STYLE[step.actionType as ActionType]
            }`}>
              {isDelay ? <Clock className="h-3.5 w-3.5" /> : <StepTypeIcon type={step.actionType as ActionType} size="sm" />}
            </span>
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder={STEP_DEFAULTS[step.actionType as ActionType | "delay"]}
              className="flex-1 min-w-0 font-semibold text-foreground bg-transparent border-0 border-b border-transparent focus:border-border focus:outline-none placeholder:text-muted-foreground/50 transition-colors"
            />
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isDelay ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">Duration</label>
                <div className="flex gap-1.5 flex-wrap">
                  {["1d", "3d", "7d", "14d", "1d 12h"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleDelayChange(preset)}
                      className={`text-[11px] font-mono font-semibold px-2.5 py-1 rounded-md border transition-colors ${
                        delayInput === preset
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    value={delayInput}
                    onChange={(e) => handleDelayChange(e.target.value)}
                    placeholder="e.g. 2d 4h 30m"
                    className={`w-full text-sm font-mono text-foreground bg-background border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
                      delayError ? "border-destructive focus:ring-destructive/30" : "border-border"
                    }`}
                  />
                  {delayError ? (
                    <span className="flex items-center gap-1 text-[11px] text-destructive">
                      <AlertCircle className="h-3 w-3 flex-shrink-0" />{delayError}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      Combine <span className="font-mono">d</span> days · <span className="font-mono">h</span> hours · <span className="font-mono">m</span> minutes
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid divide-x divide-border" style={{ gridTemplateColumns: "2fr 3fr" }}>
              <div className="pr-6 min-w-0">
                <StepConfigLeft draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
              </div>
              <div className="pl-6 min-w-0">
                <StepConfigRight draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={isDelay && !!delayError}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── BranchEditor ────────────────────────────────────────────────────────────

interface BranchEditorProps {
  branchType: "IF" | "ELSE";
  conditionSummary: string;
  steps: WorkflowStep[];
  onChange: (steps: WorkflowStep[]) => void;
  onDirty: () => void;
}

const BRANCH_ADD_TYPES = [
  { type: "email" as const, label: "Email" },
  { type: "sms" as const, label: "SMS" },
  { type: "call-reminder" as const, label: "Call" },
  { type: "delay" as const, label: "Delay" },
] as const;

function BranchStepIcon({ type }: { type: string }) {
  if (type === "delay") return <Clock className="h-3.5 w-3.5 text-amber-500" />;
  if (type === "sms") return <MessageSquare className="h-3.5 w-3.5 text-violet-500" />;
  if (type === "call-reminder") return <Phone className="h-3.5 w-3.5 text-amber-600" />;
  return <Mail className="h-3.5 w-3.5 text-blue-500" />;
}

function stepTypeDot(type: string): string {
  if (type === "email") return "border-blue-400";
  if (type === "sms") return "border-violet-400";
  if (type === "call-reminder" || type === "delay") return "border-amber-400";
  return "border-border";
}

function stepSubtitle(s: WorkflowStep): string | undefined {
  if (s.actionType === "email") return s.subject || s.templateName;
  if (s.actionType === "sms") return s.smsTemplateName || s.message;
  if (s.actionType === "call-reminder" || s.actionType === "voicemail-reminder") return s.note;
  return undefined;
}

function stepTypeShortLabel(type: string): string {
  if (type === "email") return "Email";
  if (type === "sms") return "SMS";
  if (type === "call-reminder") return "Call";
  if (type === "voicemail-reminder") return "Voicemail";
  return "Delay";
}

function BranchEditor({ branchType, conditionSummary, steps, onChange, onDirty }: BranchEditorProps) {
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const isIF = branchType === "IF";

  function addStep(type: "email" | "sms" | "call-reminder" | "delay") {
    const newStep = type === "delay" ? defaultDelayStep() : defaultStep(0, type);
    onChange([...steps, newStep]);
    onDirty();
  }

  function removeStep(id: string) {
    onChange(steps.filter((s) => s.id !== id));
    onDirty();
  }

  function saveStep(updated: WorkflowStep) {
    onChange(steps.map((s) => (s.id === updated.id ? updated : s)));
    setEditingStep(null);
    onDirty();
  }

  const headerBg = isIF ? "bg-emerald-600" : "bg-slate-500";
  const lineColor = isIF ? "bg-emerald-200" : "bg-border";
  const addDotBorder = isIF ? "border-emerald-300" : "border-slate-300";

  return (
    <>
      {editingStep && (
        <BranchStepConfigModal
          step={editingStep}
          onSave={saveStep}
          onClose={() => setEditingStep(null)}
        />
      )}

      {/* Branch header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 ${headerBg}`}>
          {branchType}
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-0.5">
            {isIF ? "Matches condition" : "Default path"}
          </p>
          <p className="text-sm font-semibold text-foreground leading-tight truncate">{conditionSummary}</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="pl-5 relative">
        {/* vertical line */}
        <div className={`absolute left-[5px] top-0 bottom-0 w-0.5 ${lineColor}`} />

        {steps.map((s) => (
          s.actionType === "delay" ? (
            <div key={s.id} className="flex items-center gap-3 mb-3 relative">
              <div className={`w-3 h-3 rounded-full border-2 bg-white flex-shrink-0 z-10 -ml-[5px] border-amber-300`} />
              <div className="flex items-center gap-2 bg-background border border-border/60 rounded-lg px-3 py-2 flex-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Wait</span>
                <span className="text-xs font-mono font-semibold text-foreground/80 bg-muted px-1.5 py-0.5 rounded">{stepToDelayString(s)}</span>
                <button
                  type="button"
                  onClick={() => removeStep(s.id)}
                  className="ml-auto text-muted-foreground/40 hover:text-destructive transition-colors flex-shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ) : (
            <div key={s.id} className="flex items-start gap-3 mb-3 relative">
              <div className={`w-3 h-3 rounded-full border-2 bg-white flex-shrink-0 z-10 mt-4 -ml-[5px] ${stepTypeDot(s.actionType)}`} />
              <div
                role="button"
                tabIndex={0}
                onClick={() => setEditingStep(s)}
                onKeyDown={(e) => e.key === "Enter" && setEditingStep(s)}
                className="group flex-1 rounded-xl border border-border bg-card p-3 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-3">
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${TYPE_ICON_BG[s.actionType as ActionType]}`}>
                    <StepTypeIcon type={s.actionType as ActionType} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground leading-tight">
                      {s.name || STEP_DEFAULTS[s.actionType as ActionType | "delay"]}
                    </p>
                    {stepSubtitle(s) && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">{stepSubtitle(s)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_BADGE_STYLE[s.actionType as ActionType]}`}>
                      {stepTypeShortLabel(s.actionType)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeStep(s.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        ))}

        {/* Add step row */}
        <div className="flex items-center gap-3 pt-0.5">
          <div className={`w-6 h-6 rounded-full border-2 border-dashed flex items-center justify-center flex-shrink-0 z-10 -ml-[5px] bg-background ${addDotBorder}`}>
            <Plus className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {BRANCH_ADD_TYPES.map(({ type, label: btnLabel }) => (
              <button
                key={type}
                type="button"
                onClick={() => addStep(type)}
                className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground bg-background hover:bg-muted border border-border/60 hover:border-border rounded-md px-2 py-1 transition-colors"
              >
                <BranchStepIcon type={type} />
                {btnLabel}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── StepRow (collapsed-only) ─────────────────────────────────────────────────

const STEP_DRAG_TYPE = "WORKFLOW_STEP_V2";

interface StepRowProps {
  step: WorkflowStep;
  index: number;
  totalSteps: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  showConnector: boolean;
}

function StepRow({
  step,
  index,
  totalSteps,
  isSelected,
  onSelect,
  onRemove,
  onDuplicate,
  onReorder,
  showConnector,
}: StepRowProps) {
  const [{ isDragging }, drag, dragPreview] = useDrag({
    type: STEP_DRAG_TYPE,
    item: { index },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });
  const [{ isOver }, drop] = useDrop<
    { index: number },
    void,
    { isOver: boolean }
  >({
    accept: STEP_DRAG_TYPE,
    collect: (monitor) => ({ isOver: monitor.isOver() }),
    hover(item) {
      if (item.index !== index) {
        onReorder(item.index, index);
        item.index = index;
      }
    },
  });

  const isConditional = step.actionType === "conditional";
  const isIncomplete =
    (step.actionType === "email" && !step.templateId) ||
    (step.actionType === "sms" && !step.smsTemplateId);

  const typeIconStyle = isConditional
    ? "border-amber-400 text-amber-600"
    : TYPE_ICON_STYLE[step.actionType as ActionType | "delay"];

  return (
    <div
      ref={(node) => { dragPreview(drop(node)); }}
      className={`flex gap-4 transition-opacity ${isDragging ? "opacity-40" : ""} ${isOver ? "ring-2 ring-primary/30 rounded-xl" : ""}`}
    >
      {/* Timeline column */}
      <div className="flex flex-col items-center flex-shrink-0 w-10">
        <div
          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center bg-white shadow-sm ${typeIconStyle}`}
        >
          {isConditional ? (
            <GitBranch className="h-4 w-4" />
          ) : (
            <StepTypeIcon type={step.actionType as ActionType} />
          )}
        </div>
        {showConnector && (
          <div className="w-0.5 bg-border/60 flex-1 min-h-6 mt-1 rounded-full" />
        )}
      </div>

      {/* Card column */}
      <div className="flex-1 pb-4">
        <div
          role="button"
          tabIndex={0}
          onClick={onSelect}
          onKeyDown={(e) => e.key === "Enter" && onSelect()}
          className={`rounded-xl border bg-card transition-all cursor-pointer overflow-hidden ${
            isSelected
              ? "border-primary ring-2 ring-primary/20 shadow-sm"
              : isConditional
              ? "border-amber-200 bg-amber-50/20 hover:border-amber-300 hover:shadow-sm"
              : "border-border hover:border-primary/30 hover:shadow-sm"
          }`}
        >
          {/* ── Top row: drag / badge / name / actions ── */}
          <div className="px-4 py-3 flex items-start gap-3">
            <div
              ref={(el) => { drag(el); }}
              onClick={(e) => e.stopPropagation()}
              className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors flex-shrink-0 -ml-1 mt-0.5"
            >
              <GripVertical className="h-4 w-4" />
            </div>
            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold flex-shrink-0 select-none whitespace-nowrap mt-0.5">
              Day {Math.floor(step.dayOffset)}
            </span>
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                {isConditional && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5 flex-shrink-0">
                    <GitBranch className="h-3 w-3" />
                    IF/ELSE
                  </span>
                )}
                <span className="font-semibold text-foreground text-sm truncate">
                  {step.name || (isConditional ? "IF/ELSE Block" : STEP_DEFAULTS[step.actionType as ActionType])}
                </span>
              </div>
              <StepSummary step={step} />
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5" onClick={(e) => e.stopPropagation()}>
              {isIncomplete && (
                <span title="Setup incomplete — missing template">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                </span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Step actions"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="flex items-center gap-2 text-sm">
                    <Copy className="h-3.5 w-3.5" />Duplicate step
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSelect(); }} className="flex items-center gap-2 text-sm">
                    <Pencil className="h-3.5 w-3.5" />Edit step
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRemove(); }} disabled={totalSteps <= 1} className="flex items-center gap-2 text-sm text-destructive focus:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ChevronRight className={`h-4 w-4 transition-colors ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
            </div>
          </div>

          {/* ── Condition layers (only for conditional steps) ── */}
          {isConditional && (
            <div className="px-3 pb-3 border-t border-amber-200/60 pt-2.5">
              {/* WHEN clause */}
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground/50 flex-shrink-0">When</span>
                <div className="flex items-center gap-1.5 text-xs flex-wrap">
                  {step.conditionField && FIELD_CONFIG[step.conditionField as FilterFieldV2] ? (
                    <>
                      <span className="font-semibold text-foreground">
                        {FIELD_CONFIG[step.conditionField as FilterFieldV2].label}
                      </span>
                      <span className="text-muted-foreground">
                        {OPERATOR_LABELS[step.conditionOperator as FilterOperatorV2] ?? step.conditionOperator ?? "equals"}
                      </span>
                      {step.conditionValue && (
                        <span className="font-mono text-primary/80 bg-primary/5 border border-primary/10 rounded px-1.5 py-0.5">
                          "{step.conditionValue}"
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground/50 italic text-[11px]">No condition set</span>
                  )}
                </div>
              </div>
              {/* IF / ELSE vertical folder-tree */}
              <div className="ml-1 border-l-2 border-border pl-3 space-y-1.5">
                {/* IF row */}
                <div className="relative">
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-3 h-px bg-border" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5 flex-shrink-0 leading-tight">IF</span>
                    {(step.ifBranch ?? []).length === 0 ? (
                      <span className="text-[11px] text-muted-foreground/50 italic">no actions</span>
                    ) : (
                      <div className="flex items-center gap-1 flex-wrap">
                        {step.ifBranch!.map((bs) => (
                          <span key={bs.id} className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground/70 bg-background border border-border rounded-full px-2 py-0.5">
                            <BranchStepIcon type={bs.actionType} />
                            {bs.name || STEP_DEFAULTS[bs.actionType as ActionType | "delay"]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* ELSE row */}
                <div className="relative">
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-3 h-px bg-border" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5 flex-shrink-0 leading-tight">ELSE</span>
                    {(step.elseBranch ?? []).length === 0 ? (
                      <span className="text-[11px] text-muted-foreground/50 italic">no actions</span>
                    ) : (
                      <div className="flex items-center gap-1 flex-wrap">
                        {step.elseBranch!.map((bs) => (
                          <span key={bs.id} className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground/70 bg-background border border-border rounded-full px-2 py-0.5">
                            <BranchStepIcon type={bs.actionType} />
                            {bs.name || STEP_DEFAULTS[bs.actionType as ActionType | "delay"]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DelayRow (collapsed-only) ────────────────────────────────────────────────

function DelayRow({
  step,
  isSelected,
  onSelect,
  onRemove,
}: {
  step: WorkflowStep;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const displayValue = stepToDelayString(step);

  return (
    <div className="flex gap-4 mb-4">
      <div className="flex flex-col items-center flex-shrink-0 w-10">
        <div className="w-0.5 bg-border h-2 rounded-full" />
        <div className="w-9 h-9 rounded-full border-2 border-dashed border-border bg-muted/40 flex items-center justify-center">
          <Clock className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="w-0.5 bg-border flex-1 min-h-2 mt-1 rounded-full" />
      </div>

      <div className="flex-1 pb-2">
        <div
          role="button"
          tabIndex={0}
          onClick={onSelect}
          onKeyDown={(e) => e.key === "Enter" && onSelect()}
          className={`rounded-xl border transition-all px-4 py-2.5 flex items-center gap-3 cursor-pointer ${
            isSelected
              ? "border-primary ring-2 ring-primary/20 shadow-sm bg-card"
              : "border-dashed border-border bg-muted/30 hover:border-primary/30 hover:shadow-sm"
          }`}
        >
          <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Wait
            </span>
            <span className="text-xs font-mono font-semibold text-foreground/80 bg-muted px-1.5 py-0.5 rounded">
              {displayValue}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Remove delay"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <ChevronRight className={`h-3.5 w-3.5 flex-shrink-0 transition-colors ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
        </div>
      </div>
    </div>
  );
}

// ─── StepConfigPanel ──────────────────────────────────────────────────────────

interface StepConfigPanelProps {
  step: WorkflowStep;
  totalSteps: number;
  onSave: (updated: WorkflowStep) => void;
  onCancel: () => void;
  onRemove: () => void;
  onDirty: () => void;
}

function StepConfigPanel({ step, totalSteps, onSave, onCancel, onRemove, onDirty }: StepConfigPanelProps) {
  const isConditional = step.actionType === "conditional";
  const isDelay = step.actionType === "delay";
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<StepDraft>({
    name: step.name,
    actionType: isConditional ? "email" : (step.actionType as ActionType),
    templateId: step.templateId,
    templateName: step.templateName,
    senderIdentity: step.senderIdentity,
    subject: step.subject,
    body: step.body,
    smsTemplateId: step.smsTemplateId,
    smsTemplateName: step.smsTemplateName,
    message: step.message,
    note: step.note,
    reminderDaysBefore: step.reminderDaysBefore,
  });

  const safeCondField = (step.conditionField && FIELD_CONFIG[step.conditionField as FilterFieldV2])
    ? (step.conditionField as FilterFieldV2)
    : "userType";
  const [condField, setCondField] = useState<FilterFieldV2>(safeCondField);
  const [condOperator, setCondOperator] = useState<FilterOperatorV2>(
    (step.conditionOperator as FilterOperatorV2) ?? defaultOperatorForField(safeCondField)
  );
  const [condValue, setCondValue] = useState(step.conditionValue ?? "");
  const [ifSteps, setIfSteps] = useState<WorkflowStep[]>(step.ifBranch ?? []);
  const [elseSteps, setElseSteps] = useState<WorkflowStep[]>(step.elseBranch ?? []);

  const [delayInput, setDelayInput] = useState(() => stepToDelayString(step));
  const [delayError, setDelayError] = useState<string | null>(null);

  function updateDraft(patch: Partial<StepDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
    onDirty();
  }

  function handleDelayChange(value: string) {
    setDelayInput(value);
    const parsed = parseDelayInput(value);
    setDelayError(parsed ? null : 'Invalid format — use e.g. "2d 4h 30m"');
    onDirty();
  }

  function handleFieldChange(newField: FilterFieldV2) {
    setCondField(newField);
    setCondOperator(defaultOperatorForField(newField));
    setCondValue(defaultValueForField(newField));
    onDirty();
  }

  function handleOperatorChange(newOp: FilterOperatorV2) {
    setCondOperator(newOp);
    if (FIELD_CONFIG[condField].type === "boolean") setCondValue("");
    onDirty();
  }

  function handleSave() {
    if (isDelay) {
      const parsed = parseDelayInput(delayInput);
      if (!parsed) return;
      onSave({ ...step, delayDays: Math.max(0, parsed.days), delayHours: parsed.hours, delayMinutes: parsed.minutes });
    } else if (isConditional) {
      onSave({ ...step, name: draft.name, conditionField: condField, conditionOperator: condOperator, conditionValue: condValue, ifBranch: ifSteps, elseBranch: elseSteps });
    } else {
      onSave({ ...step, ...draft });
    }
  }

  const typeIconStyle = isConditional
    ? "border-amber-400 text-amber-600"
    : isDelay
    ? "border-border text-muted-foreground"
    : TYPE_ICON_STYLE[step.actionType as ActionType];

  const fieldCfg = FIELD_CONFIG[condField];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2.5 flex-shrink-0">
        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${typeIconStyle}`}>
          {isConditional ? (
            <GitBranch className="h-3.5 w-3.5" />
          ) : isDelay ? (
            <Clock className="h-3.5 w-3.5" />
          ) : (
            <StepTypeIcon type={step.actionType as ActionType} size="sm" />
          )}
        </div>
        {isDelay ? (
          <span className="text-sm font-semibold text-foreground flex-1">Wait / Delay</span>
        ) : isConditional ? (
          <span className="text-sm font-semibold text-foreground flex-1">{draft.name || "IF/ELSE Block"}</span>
        ) : (
          <div className="flex items-center gap-1.5 group/name flex-1 min-w-0">
            <input
              ref={nameInputRef}
              value={draft.name}
              onChange={(e) => updateDraft({ name: e.target.value })}
              placeholder={STEP_DEFAULTS[draft.actionType]}
              className="flex-1 min-w-0 text-sm font-semibold text-foreground bg-transparent border-0 border-b border-transparent focus:border-border focus:outline-none placeholder:text-muted-foreground/50 transition-colors"
            />
            <button
              type="button"
              onClick={() => { nameInputRef.current?.focus(); nameInputRef.current?.select(); }}
              className="opacity-0 group-hover/name:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted flex-shrink-0"
              title="Edit name"
            >
              <Pencil className="h-3 w-3 text-muted-foreground/40" />
            </button>
          </div>
        )}
      </div>


      {/* Form body */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Delay ── */}
        {isDelay && (
          <div className="px-4 py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">Duration</label>
              {/* Quick presets */}
              <div className="flex gap-1.5 flex-wrap">
                {["1d", "3d", "7d", "14d", "1d 12h"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => { handleDelayChange(preset); onDirty(); }}
                    className={`text-[11px] font-mono font-semibold px-2.5 py-1 rounded-md border transition-colors ${
                      delayInput === preset
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              {/* Custom input */}
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  value={delayInput}
                  onChange={(e) => handleDelayChange(e.target.value)}
                  placeholder="e.g. 2d 4h 30m"
                  className={`w-full text-sm font-mono text-foreground bg-background border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
                    delayError ? "border-destructive focus:ring-destructive/30" : "border-border"
                  }`}
                />
                {delayError ? (
                  <span className="flex items-center gap-1 text-[11px] text-destructive">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />{delayError}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    Combine <span className="font-mono">d</span> days · <span className="font-mono">h</span> hours · <span className="font-mono">m</span> minutes
                  </span>
                )}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border/60 pt-3">
              The sequence pauses here before the next step runs.
            </p>
          </div>
        )}

        {/* ── Condition ── */}
        {isConditional && (
          <div className="px-4 py-4 space-y-4">
            {/* Condition clause */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">Check if</label>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-3 space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <FilterFieldPicker<FilterFieldV2>
                    value={condField}
                    fields={FIELD_PICKER_ITEMS}
                    onChange={handleFieldChange}
                  />
                  <select
                    value={condOperator}
                    onChange={(e) => handleOperatorChange(e.target.value as FilterOperatorV2)}
                    className="px-2 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer"
                  >
                    {fieldCfg.operators.map((op) => (
                      <option key={op} value={op}>{OPERATOR_LABELS[op] ?? op}</option>
                    ))}
                  </select>
                  {fieldCfg.type !== "boolean" && (
                    fieldCfg.type === "select" && fieldCfg.options ? (
                      <select value={condValue} onChange={(e) => { setCondValue(e.target.value); onDirty(); }} className="px-2 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer">
                        {fieldCfg.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : fieldCfg.type === "date" ? (
                      condOperator === "within_last_n_days" ? (
                        <div className="flex items-center gap-1.5">
                          <input type="number" min={1} value={condValue || "7"} onChange={(e) => { setCondValue(e.target.value); onDirty(); }} className="w-16 px-2 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-center" />
                          <span className="text-xs text-muted-foreground">days</span>
                        </div>
                      ) : (
                        <input type="date" value={condValue} onChange={(e) => { setCondValue(e.target.value); onDirty(); }} className="px-2 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                      )
                    ) : fieldCfg.type === "number" ? (
                      <input type="number" value={condValue} onChange={(e) => { setCondValue(e.target.value); onDirty(); }} placeholder="0" className="w-20 px-2 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    ) : (
                      <input type="text" value={condValue} onChange={(e) => { setCondValue(e.target.value); onDirty(); }} placeholder="Enter value…" className="flex-1 min-w-0 px-2 py-1.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    )
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{fieldCfg.description}</p>
              </div>
            </div>

            {/* IF branch */}
            <BranchEditor
              branchType="IF"
              conditionSummary={
                fieldCfg
                  ? `${fieldCfg.label} ${OPERATOR_LABELS[condOperator] ?? condOperator}${condValue ? ` ${condValue}` : ""}`
                  : "No condition set"
              }
              steps={ifSteps}
              onChange={setIfSteps}
              onDirty={onDirty}
            />

            <div className="border-t border-border/60" />

            {/* ELSE branch */}
            <BranchEditor
              branchType="ELSE"
              conditionSummary="Everyone else"
              steps={elseSteps}
              onChange={setElseSteps}
              onDirty={onDirty}
            />
          </div>
        )}

        {/* ── Email / SMS / Call ── */}
        {!isDelay && !isConditional && (
          <div className="px-4 py-5 space-y-5">
            <StepConfigLeft draft={draft} onChange={updateDraft} />
            <StepConfigRight draft={draft} onChange={updateDraft} />
          </div>
        )}
      </div>

      {/* Footer — remove / discard / save */}
      <div className="px-4 py-3 border-t border-border flex-shrink-0 flex items-center gap-2">
        <button
          type="button"
          onClick={onRemove}
          disabled={totalSteps <= 1}
          className="flex items-center gap-1.5 text-sm text-destructive hover:text-destructive/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors py-1.5 px-2 rounded-md hover:bg-destructive/5 flex-shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />Remove
        </button>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={onCancel}>Discard</Button>
        <Button size="sm" onClick={handleSave} disabled={isDelay && !!delayError}>Save</Button>
      </div>
    </div>
  );
}

// ─── WorkflowBuilderV2 ────────────────────────────────────────────────────────

export function WorkflowBuilderV2() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { workflows, segments, handleCreateWorkflow, handleUpdateWorkflow } =
    useAppData();

  const preselectedSegmentId = !id
    ? ((location.state as { segmentId?: string } | null)?.segmentId ?? "")
    : "";

  const [wizardStep, setWizardStep] = useState(id || preselectedSegmentId ? 1 : 0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [selectedSegmentId, setSelectedSegmentId] =
    useState(preselectedSegmentId);
  const [segmentSearch, setSegmentSearch] = useState("");
  const [segmentOpen, setSegmentOpen] = useState(false);
  const segmentRef = useRef<HTMLDivElement>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([defaultStep(0)]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(420);
  const [nameError, setNameError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [incompleteModalOpen, setIncompleteModalOpen] = useState(false);
  const [incompleteCount, setIncompleteCount] = useState(0);
  const hasSeeded = useRef(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (segmentRef.current && !segmentRef.current.contains(e.target as Node)) {
        setSegmentOpen(false);
        setSegmentSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (id && !hasSeeded.current) {
      const wf = workflows.find((w) => w.id === id);
      if (wf) {
        setName(wf.name);
        setDescription(wf.description ?? "");
        setSelectedSegmentId(wf.segmentId);
        const seeded = computeDayOffsets(
          [...wf.steps].sort((a, b) => a.order - b.order),
        ).map((s, i) => ({ ...s, order: i + 1 }));
        setSteps(seeded);
        setOpenIndex(null);
        hasSeeded.current = true;
      }
    }
  }, [id, workflows]);

  const filteredSegments = segments.filter((s) =>
    s.name.toLowerCase().includes(segmentSearch.trim().toLowerCase()),
  );
  const selectedSegment = segments.find((s) => s.id === selectedSegmentId);

  const emailCount = steps.filter((s) => s.actionType === "email").length;
  const smsCount = steps.filter((s) => s.actionType === "sms").length;
  const callCount = steps.filter((s) => s.actionType === "call-reminder").length;
  const actionStepCount = steps.filter((s) => s.actionType !== "delay").length;
  const maxDay =
    steps.length > 0 ? Math.max(...steps.map((s) => s.dayOffset)) : 0;

  const handleNextStep = () => {
    if (!name.trim()) {
      setNameError("Flow name is required.");
      return;
    }
    setNameError("");
    setWizardStep(1);
  };

  const recompute = (arr: WorkflowStep[]) =>
    computeDayOffsets(arr).map((s, i) => ({ ...s, order: i + 1 }));

  function tryOpen(index: number) {
    if (openIndex === index) {
      // Toggle off — confirm if dirty
      if (isDirty) {
        setPendingIndex(null);
        setConfirmDiscardOpen(true);
      } else {
        setOpenIndex(null);
      }
    } else if (openIndex !== null && isDirty) {
      setPendingIndex(index);
      setConfirmDiscardOpen(true);
    } else {
      setOpenIndex(index);
      setIsDirty(false);
    }
  }

  function confirmDiscard() {
    setConfirmDiscardOpen(false);
    setOpenIndex(pendingIndex);
    setIsDirty(false);
    setPendingIndex(null);
  }

  function cancelDiscard() {
    setConfirmDiscardOpen(false);
    setPendingIndex(null);
  }

  const handleAddStep = (type: ActionType) => {
    const newStep = defaultStep(0, type);
    const newSteps = recompute([...steps, newStep]);
    setSteps(newSteps);
    tryOpen(newSteps.length - 1);
  };

  const handleAddCondition = () => {
    const newStep = defaultConditionalStep();
    const newSteps = recompute([...steps, newStep]);
    setSteps(newSteps);
    tryOpen(newSteps.length - 1);
  };

  const handleAddDelayFromSidebar = () => {
    const newSteps = recompute([...steps, defaultDelayStep()]);
    setSteps(newSteps);
    tryOpen(newSteps.length - 1);
  };

  const handleInsertDelay = (afterIndex: number) => {
    const arr = [...steps];
    arr.splice(afterIndex + 1, 0, defaultDelayStep());
    setSteps(recompute(arr));
  };

  const handleStepSave = (index: number, updated: WorkflowStep) => {
    setSteps(recompute(steps.map((s, i) => (i === index ? updated : s))));
    setOpenIndex(null);
    setIsDirty(false);
  };

  const handleRemoveStep = (index: number) => {
    const filtered = steps.filter((_, i) => i !== index);
    setSteps(recompute(filtered));
    if (openIndex === index) { setOpenIndex(null); setIsDirty(false); }
  };

  const handleDuplicateStep = (index: number) => {
    const original = steps[index];
    const orders = steps.map((s) => s.order);
    const newOrder = nextFractionalOrder(original.order, orders);
    const copy: WorkflowStep = {
      ...original,
      id: makeStepId(),
      order: newOrder,
      name: `${original.name} (copy)`,
    };
    const arr = [...steps];
    arr.splice(index + 1, 0, copy);
    setSteps(recompute(arr));
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const ns = [...steps];
    const [moved] = ns.splice(fromIndex, 1);
    ns.splice(toIndex, 0, moved);
    setSteps(recompute(ns));
    if (openIndex === fromIndex) setOpenIndex(toIndex);
  };

  const handlePanelResizeStart = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelWidth;
    const onMove = (ev: MouseEvent) => {
      // Right-hand panel: dragging the left edge leftwards widens it.
      const next = Math.min(680, Math.max(320, startWidth - (ev.clientX - startX)));
      setPanelWidth(next);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const handleSave = () => {
    if (!name.trim()) {
      setSaveError("Flow name is required.");
      return;
    }
    const incompleteSteps = steps.filter(
      (s) =>
        (s.actionType === "email" && !s.templateId) ||
        (s.actionType === "sms" && !s.smsTemplateId),
    );
    if (incompleteSteps.length > 0) {
      setIncompleteCount(incompleteSteps.length);
      setIncompleteModalOpen(true);
      return;
    }
    const sortedSteps = recompute([...steps]);
    const segmentName = selectedSegment?.name ?? "";
    if (id) {
      handleUpdateWorkflow(id, {
        name,
        description,
        segmentId: selectedSegmentId,
        segmentName,
        steps: sortedSteps,
      });
    } else {
      handleCreateWorkflow({
        name,
        description,
        segmentId: selectedSegmentId,
        segmentName,
        status: "draft",
        createdBy: "Admin",
        steps: sortedSteps,
      });
    }
    navigate("/email-workflows/flows");
  };

  const canActivate = !!selectedSegmentId;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Page header ── */}
      <div className="border-b border-border bg-card px-8 py-3 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/email-workflows/flows")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <span className="text-border">|</span>
          <div>
            {wizardStep === 1 ? (
              <div>
                {editingName ? (
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (saveError) setSaveError("");
                    }}
                    onBlur={() => setEditingName(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape")
                        setEditingName(false);
                    }}
                    placeholder="Flow name…"
                    className="bg-transparent border-none outline-none text-lg font-semibold text-foreground placeholder:text-muted-foreground/50 focus:ring-0 w-72 leading-tight block"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingName(true)}
                    className="flex items-center gap-1.5 group"
                  >
                    <span className="text-lg font-semibold text-foreground leading-tight">
                      {name || "Flow name…"}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 leading-none">
                      V2
                    </span>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
                {saveError && (
                  <p className="flex items-center gap-1 text-[11px] text-destructive leading-none">
                    <AlertCircle className="h-3 w-3" /> {saveError}
                  </p>
                )}
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description…"
                  className="bg-transparent border-none outline-none text-xs text-muted-foreground placeholder:text-muted-foreground/40 focus:ring-0 mt-0.5 block w-72 overflow-hidden text-ellipsis whitespace-nowrap focus:whitespace-normal"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-foreground leading-tight">
                  {id ? "Edit Flow" : "Create New Flow"}
                </h1>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 leading-none">
                  V2
                </span>
              </div>
            )}
          </div>
        </div>
        {wizardStep === 1 && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-xs text-muted-foreground border-r border-border pr-4">
              <span>
                <span className="font-semibold text-foreground">{actionStepCount}</span>{" "}Steps
              </span>
              <span>
                <span className="font-semibold text-foreground">{maxDay}</span>{" "}Days
              </span>
              <span className="flex items-center gap-1 text-blue-600 font-medium">
                <Mail className="h-3.5 w-3.5" />{emailCount}
              </span>
              <span className="flex items-center gap-1 text-violet-600 font-medium">
                <MessageSquare className="h-3.5 w-3.5" />{smsCount}
              </span>
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <Phone className="h-3.5 w-3.5" />{callCount}
              </span>
            </div>
            <div className="relative group/activate">
              <Button
                onClick={handleSave}
                disabled={steps.length === 0 || !canActivate}
              >
                {id ? "Update Flow" : "Create Flow"}
              </Button>
              {!canActivate && (
                <div className="absolute right-0 bottom-full mb-2 w-52 px-3 py-2 bg-popover border border-border rounded-lg shadow-md text-xs text-foreground opacity-0 group-hover/activate:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
                  Assign a segment before activating
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Wizard body ── */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* ════════════ STEP 0: Flow Details + Segment ════════════ */}
        {wizardStep === 0 && (
          <div className="flex-1 overflow-auto">
            <div className="max-w-xl mx-auto px-8 py-10">
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
                  <SectionLabel>Flow Details</SectionLabel>
                  <div className="space-y-1.5">
                    <FieldLabel required>Flow Name</FieldLabel>
                    <Input
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (nameError) setNameError("");
                      }}
                      placeholder="e.g. 30-Day Lead Nurture"
                      className={nameError ? "border-destructive focus-visible:ring-destructive/30" : ""}
                    />
                    {nameError && (
                      <p className="flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" /> {nameError}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Description</FieldLabel>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optional — describe the purpose of this flow"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <SectionLabel>Target Segment</SectionLabel>
                    <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                      Optional
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You can assign a segment now or skip and do it later. A segment must be assigned before activating the flow.
                  </p>
                  <div className="space-y-2">
                    <FieldLabel>Segment</FieldLabel>
                    <div className="relative" ref={segmentRef}>
                      <div
                        className={`flex items-center gap-2 px-3 h-9 rounded-md border bg-background cursor-pointer transition-colors ${
                          segmentOpen
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-input hover:border-primary/40"
                        }`}
                        onClick={() => setSegmentOpen(true)}
                      >
                        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        {segmentOpen ? (
                          <input
                            autoFocus
                            value={segmentSearch}
                            onChange={(e) => setSegmentSearch(e.target.value)}
                            placeholder="Search segments…"
                            className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground min-w-0"
                          />
                        ) : selectedSegmentId ? (
                          <>
                            <span className="flex-1 text-sm font-medium text-foreground truncate">
                              {selectedSegment?.name}
                            </span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {selectedSegment?.contactCount.toLocaleString()} contacts
                            </span>
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSegmentId("");
                              }}
                              className="ml-1 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Select a segment… (optional)
                          </span>
                        )}
                      </div>

                      {segmentOpen && (
                        <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-lg border border-input bg-background shadow-md overflow-hidden">
                          <ul className="max-h-52 overflow-y-auto divide-y divide-border">
                            {filteredSegments.length === 0 ? (
                              <li className="px-4 py-4 text-sm text-muted-foreground text-center">
                                No segments found
                              </li>
                            ) : (
                              filteredSegments.map((seg) => (
                                <li
                                  key={seg.id}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setSelectedSegmentId(seg.id);
                                    setSegmentSearch("");
                                    setSegmentOpen(false);
                                  }}
                                  className={`flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                                    selectedSegmentId === seg.id
                                      ? "bg-primary/5 text-primary"
                                      : "hover:bg-muted/40 text-foreground"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {selectedSegmentId === seg.id ? (
                                      <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                                    ) : (
                                      <span className="h-3.5 w-3.5 flex-shrink-0" />
                                    )}
                                    <span className="font-medium truncate">{seg.name}</span>
                                  </div>
                                  <span className="text-muted-foreground text-xs ml-4 whitespace-nowrap">
                                    {seg.contactCount.toLocaleString()} contacts
                                  </span>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleNextStep} size="default" className="gap-1.5">
                    Next — Configure Steps <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════ STEP 1: 3-column layout ════════════ */}
        {wizardStep === 1 && (
          <div className="flex-1 flex overflow-hidden">

            {/* ── Sidebar: actions ── */}
            <div className="w-[220px] flex-shrink-0 border-r border-border bg-card flex flex-col overflow-y-auto">
              <div className="px-3 pt-4 pb-4 flex flex-col">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 pb-1.5">Actions</p>
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleAddStep(opt.value)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-foreground hover:bg-muted transition-colors text-left"
                  >
                    <span className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${TYPE_ICON_BG[opt.value]}`}>
                      <StepTypeIcon type={opt.value} />
                    </span>
                    {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleAddDelayFromSidebar}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-foreground hover:bg-muted transition-colors text-left"
                >
                  <span className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-amber-50 text-amber-600">
                    <Clock className="h-4 w-4" />
                  </span>
                  Delay
                </button>
                <button
                  type="button"
                  onClick={handleAddCondition}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-foreground hover:bg-muted transition-colors text-left"
                >
                  <span className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-amber-50 text-amber-600">
                    <GitBranch className="h-4 w-4" />
                  </span>
                  Condition
                </button>
              </div>
            </div>

            {/* ── Center: Steps timeline ── */}
            <div className="flex-1 min-w-0 overflow-y-auto px-6 py-6 space-y-5">
              {selectedSegment ? (
                <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    {selectedSegment.name}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {selectedSegment.contactCount.toLocaleString()} contacts
                  </span>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/40 px-4 py-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <span className="text-sm text-amber-700 flex-1">
                    No segment assigned. You can save as a draft and assign a segment before activating.
                  </span>
                  <button
                    type="button"
                    onClick={() => setWizardStep(0)}
                    className="text-xs text-amber-700 underline hover:no-underline flex-shrink-0"
                  >
                    Assign segment
                  </button>
                </div>
              )}

              {steps.filter((s) => s.actionType !== "delay").length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-border p-12 text-center text-muted-foreground">
                  <Mail className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium text-foreground mb-1">No steps yet</p>
                  <p className="text-sm">Add a step from the panel on the left to get started.</p>
                </div>
              ) : (
                <DndProvider backend={HTML5Backend}>
                  <div>
                    {steps.map((step, i) => {
                      if (step.actionType === "delay") {
                        return (
                          <DelayRow
                            key={step.id}
                            step={step}
                            isSelected={openIndex === i}
                            onSelect={() => tryOpen(i)}
                            onRemove={() => handleRemoveStep(i)}
                          />
                        );
                      }
                      const isLastStep = i === steps.length - 1;
                      const nextIsDelay = !isLastStep && steps[i + 1]?.actionType === "delay";
                      return (
                        <div key={step.id}>
                          <StepRow
                            step={step}
                            index={i}
                            totalSteps={steps.length}
                            isSelected={openIndex === i}
                            onSelect={() => tryOpen(i)}
                            onRemove={() => handleRemoveStep(i)}
                            onDuplicate={() => handleDuplicateStep(i)}
                            onReorder={handleReorder}
                            showConnector={!isLastStep && !nextIsDelay}
                          />
                          {!isLastStep && !nextIsDelay && (
                            <button
                              type="button"
                              onClick={() => handleInsertDelay(i)}
                              className="flex items-center gap-1.5 mx-auto pl-12 py-0.5 text-[11px] text-muted-foreground hover:text-amber-600 transition-colors group"
                            >
                              <span className="h-px w-8 bg-border group-hover:bg-amber-300 transition-colors" />
                              <Clock className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                              <span>add delay</span>
                              <span className="h-px w-8 bg-border group-hover:bg-amber-300 transition-colors" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </DndProvider>
              )}
            </div>

            {/* Drag handle to resize the step-info panel */}
            <div
              onMouseDown={handlePanelResizeStart}
              title="Drag to resize"
              className="w-1 flex-shrink-0 cursor-col-resize bg-transparent hover:bg-primary/40 transition-colors"
            />

            {/* ── Right panel: Step configuration (resizable) ── */}
            <div
              className="flex-shrink-0 border-l border-border bg-card flex flex-col overflow-hidden"
              style={{ width: panelWidth }}
            >
              {openIndex !== null && steps[openIndex] ? (
                <StepConfigPanel
                  key={steps[openIndex].id}
                  step={steps[openIndex]}
                  totalSteps={steps.length}
                  onSave={(updated) => handleStepSave(openIndex, updated)}
                  onCancel={() => { setOpenIndex(null); setIsDirty(false); }}
                  onRemove={() => handleRemoveStep(openIndex)}
                  onDirty={() => setIsDirty(true)}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Pencil className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No step selected</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Click a step in the timeline to configure it here.
                  </p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in the current step. Discard them and open the other step?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className="bg-background text-foreground border border-border hover:bg-muted"
              onClick={cancelDiscard}
            >
              Keep editing
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDiscard}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={incompleteModalOpen} onOpenChange={setIncompleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Some steps need attention</AlertDialogTitle>
            <AlertDialogDescription>
              {incompleteCount} step{incompleteCount !== 1 ? "s" : ""} still need
              {incompleteCount === 1 ? "s" : ""} to be set up. Look for the{" "}
              <AlertCircle className="inline h-3 w-3 text-destructive align-middle" />{" "}
              indicator to find steps that still need to be configured.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIncompleteModalOpen(false)}>
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
