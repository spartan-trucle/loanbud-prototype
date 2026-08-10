import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import {
  ArrowLeft,
  ChevronRight,
  ChevronDown,
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
  UserCheck,
} from "lucide-react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "../ui/alert-dialog";
import { useAppData } from "../../contexts/AppDataContext";
import type { WorkflowStep } from "../../types";
import { computeDayOffsets } from "../../lib/workflowUtils";
import {
  StepTypeIcon,
  StepConfigFields,
  SectionLabel,
  FieldLabel,
  STEP_DEFAULTS,
  TYPE_OPTIONS,
  TYPE_ICON_STYLE,
  TYPE_ICON_BG,
  TYPE_HOVER_STYLE,
  type ActionType,
  type StepDraft,
} from "./StepConfigForm";

// ─── Constants ───────────────────────────────────────────────────────────────

// ─── Step templates ───────────────────────────────────────────────────────────

interface StepTemplate {
  id: string;
  name: string;
  description: string;
  steps: Array<{ name: string; actionType: ActionType; dayOffset: number }>;
}

const STEP_TEMPLATES: StepTemplate[] = [
  {
    id: "14-day-comms",
    name: "Active Sequence",
    description:
      "11-step sequence over 14 days: email, call, and SMS touchpoints",
    steps: [
      { name: "First Email", actionType: "email", dayOffset: 0 },
      { name: "Call Reminder Step", actionType: "call-reminder", dayOffset: 0 },
      { name: "Send SMS Step", actionType: "sms", dayOffset: 0 },
      { name: "Send Email Step", actionType: "email", dayOffset: 2 },
      { name: "Call Reminder", actionType: "call-reminder", dayOffset: 3 },
      { name: "Delayed SMS", actionType: "sms", dayOffset: 4 },
      { name: "Follow up Email", actionType: "email", dayOffset: 6 },
      { name: "Call Reminder", actionType: "call-reminder", dayOffset: 7 },
      { name: "Send SMS Step", actionType: "sms", dayOffset: 9 },
      { name: "Send Email Step", actionType: "email", dayOffset: 11 },
      { name: "Final Call", actionType: "call-reminder", dayOffset: 14 },
    ],
  },
  {
    id: "calls-closed",
    name: "Calls Closed Sequence",
    description:
      "3-step closing sequence: email, call reminder, then SMS follow-up",
    steps: [
      { name: "Send Email", actionType: "email", dayOffset: 0 },
      { name: "Call Reminder", actionType: "call-reminder", dayOffset: 1 },
      { name: "Send SMS", actionType: "sms", dayOffset: 2 },
    ],
  },
];

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

// ─── StepRow ──────────────────────────────────────────────────────────────────

const STEP_DRAG_TYPE = "WORKFLOW_STEP";

interface StepRowProps {
  step: WorkflowStep;
  index: number;
  totalSteps: number;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (updated: WorkflowStep) => void;
  onCancel: () => void;
  onRemove: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  showConnector: boolean;
  onDirty: () => void;
}

function StepRow({
  step,
  index,
  totalSteps,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onRemove,
  onReorder,
  showConnector,
  onDirty,
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

  const nameInputRef = useRef<HTMLInputElement>(null);

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
    sendMode: step.sendMode,
  });

  useEffect(() => {
    setDraft({
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
      sendMode: step.sendMode,
    });
  }, [step, isEditing]);

  function updateDraft(patch: Partial<StepDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
    onDirty();
  }

  return (
    <div
      ref={(node) => {
        dragPreview(drop(node));
      }}
      className={`flex gap-4 transition-opacity ${isDragging ? "opacity-40" : ""} ${isOver ? "ring-2 ring-primary/30 rounded-xl" : ""}`}
    >
      {/* Timeline column */}
      <div className="flex flex-col items-center flex-shrink-0 w-10">
        <div
          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center bg-white shadow-sm ${TYPE_ICON_STYLE[step.actionType]}`}
        >
          <StepTypeIcon type={step.actionType} />
        </div>
        {showConnector && (
          <div className="w-0.5 bg-border/60 flex-1 min-h-6 mt-1 rounded-full" />
        )}
      </div>

      {/* Card column */}
      <div className="flex-1 pb-4">
        {isEditing ? (
          /* ── Edit form ── */
          <div className="rounded-xl border-2 border-primary/30 bg-card shadow-sm">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2 flex-1 min-w-0 mr-4">
                <div
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${TYPE_ICON_STYLE[step.actionType]}`}
                >
                  <StepTypeIcon type={step.actionType} size="sm" />
                </div>
                <div className="flex items-center gap-1.5 group/name">
                  <input
                    ref={nameInputRef}
                    value={draft.name}
                    onChange={(e) => updateDraft({ name: e.target.value })}
                    placeholder={STEP_DEFAULTS[draft.actionType]}
                    size={Math.max(12, (draft.name || STEP_DEFAULTS[draft.actionType]).length + 1)}
                    className="text-sm font-semibold text-foreground bg-transparent border-0 border-b border-transparent focus:border-border focus:outline-none placeholder:text-muted-foreground/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => { nameInputRef.current?.focus(); nameInputRef.current?.select(); }}
                    className="opacity-0 group-hover/name:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                    title="Edit name"
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground/40" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onRemove}
                  disabled={totalSteps <= 1}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Remove step"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <Button size="sm" variant="outline" onClick={onCancel}>
                  Discard
                </Button>
                <Button size="sm" onClick={() => onSave({ ...step, ...draft })}>
                  Save
                </Button>
                <button
                  onClick={onCancel}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Collapse"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="px-5 py-4">
              <StepConfigFields
                draft={draft}
                onChange={(p) => updateDraft(p)}
              />
            </div>
          </div>
        ) : (
          /* ── Collapsed card ── */
          (() => {
            const isIncomplete =
              (step.actionType === "email" && !step.templateId) ||
              (step.actionType === "sms" && !step.smsTemplateId);
            return (
              <div
                role="button"
                tabIndex={0}
                onClick={onEdit}
                onKeyDown={(e) => e.key === "Enter" && onEdit()}
                className="rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all px-4 py-3 flex items-center gap-3 cursor-pointer"
              >
                <div
                  ref={(el) => { drag(el); }}
                  onClick={(e) => e.stopPropagation()}
                  className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors flex-shrink-0 -ml-1"
                >
                  <GripVertical className="h-4 w-4" />
                </div>
                <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold flex items-center justify-center flex-shrink-0 select-none whitespace-nowrap">
                  Step {index + 1} · Day {Math.floor(step.dayOffset)}
                </span>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-semibold text-foreground text-sm truncate">
                    {step.name || STEP_DEFAULTS[step.actionType]}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isIncomplete && (
                    <span title="Setup incomplete — missing template" className="flex-shrink-0">
                      <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}

// ─── DelayRow ─────────────────────────────────────────────────────────────────

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

function DelayRow({
  step,
  isOpen,
  onOpen,
  onClose,
  onChangeDays,
  onRemove,
  onDirty,
}: {
  step: WorkflowStep;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChangeDays: (days: number, hours?: number, minutes?: number) => void;
  onRemove: () => void;
  onDirty: () => void;
}) {
  const [savedValue, setSavedValue] = useState(() => stepToDelayString(step));
  const [inputValue, setInputValue] = useState(() => stepToDelayString(step));
  const [error, setError] = useState<string | null>(null);

  function handleChange(value: string) {
    setInputValue(value);
    const parsed = parseDelayInput(value);
    setError(parsed ? null : 'Invalid format — use e.g. "2d 4h 30m"');
    onDirty();
  }

  function handleSave() {
    const parsed = parseDelayInput(inputValue);
    if (!parsed) return;
    onChangeDays(parsed.days, parsed.hours, parsed.minutes);
    setSavedValue(inputValue);
    onClose();
  }

  function handleDiscard() {
    setInputValue(savedValue);
    setError(null);
    onClose();
  }

  return (
    <div className="flex gap-4 mb-4">
      {/* Timeline column spacer */}
      <div className="flex flex-col items-center flex-shrink-0 w-10">
        <div className="w-0.5 bg-border h-2 rounded-full" />
        <div className="w-9 h-9 rounded-full border-2 border-dashed border-border bg-muted/40 flex items-center justify-center">
          <Clock className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="w-0.5 bg-border flex-1 min-h-2 mt-1 rounded-full" />
      </div>

      {/* Card */}
      <div className="flex-1 pb-2">
        {isOpen ? (
          /* ── Expanded ── */
          <div className="rounded-xl border-2 border-primary/30 bg-card shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Wait / Delay
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onRemove}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Remove delay"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <Button size="sm" variant="outline" onClick={handleDiscard}>
                  Discard
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!!error}>
                  Save
                </Button>
                <button
                  type="button"
                  onClick={handleDiscard}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Collapse"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="px-4 py-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => handleChange(e.target.value)}
                  placeholder="e.g. 1d 4h 30m"
                  className={`w-44 text-sm font-medium text-foreground bg-background border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${error ? "border-destructive focus:ring-destructive/30" : "border-border"}`}
                />
                {error ? (
                  <span className="flex items-center gap-1 text-[11px] text-destructive">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    {error}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    Use <span className="font-mono text-foreground/70">d</span> days,{" "}
                    <span className="font-mono text-foreground/70">h</span> hours,{" "}
                    <span className="font-mono text-foreground/70">m</span> minutes — e.g.{" "}
                    <span className="font-mono text-foreground/70">2d</span>,{" "}
                    <span className="font-mono text-foreground/70">4h 30m</span>,{" "}
                    <span className="font-mono text-foreground/70">1d 2h</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border/60 pt-2.5">
                The sequence pauses here for the set duration before the next step is sent. The timer starts once the previous step has been completed or delivered.
              </p>
            </div>
          </div>
        ) : (
          /* ── Collapsed ── */
          <div
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={(e) => e.key === "Enter" && onOpen()}
            className="rounded-xl border border-dashed border-border bg-muted/30 hover:border-primary/30 hover:shadow-sm transition-all px-4 py-2.5 flex items-center gap-3 cursor-pointer"
          >
            <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Wait
              </span>
              <span className="text-xs font-mono font-semibold text-foreground/80 bg-muted px-1.5 py-0.5 rounded">
                {savedValue}
              </span>
              {error && (
                <AlertCircle className="h-3 w-3 text-destructive flex-shrink-0" />
              )}
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── WorkflowBuilder ──────────────────────────────────────────────────────────

export function WorkflowBuilder() {
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
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [nameError, setNameError] = useState("");
  const [step1Error, setStep1Error] = useState("");
  const [saveError, setSaveError] = useState("");
  const [incompleteModalOpen, setIncompleteModalOpen] = useState(false);
  const [_incompleteCount, _setIncompleteCount] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const hasSeeded = useRef(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        segmentRef.current &&
        !segmentRef.current.contains(e.target as Node)
      ) {
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

  const filteredSegments = segments.filter(
    (s) => s.status === "Active" && s.name.toLowerCase().includes(segmentSearch.trim().toLowerCase()),
  );
  const selectedSegment = segments.find((s) => s.id === selectedSegmentId);

  const emailCount = steps.filter((s) => s.actionType === "email").length;
  const smsCount = steps.filter((s) => s.actionType === "sms").length;
  const callCount = steps.filter(
    (s) => s.actionType === "call-reminder",
  ).length;
  const actionStepCount = steps.filter((s) => s.actionType !== "delay").length;
  const maxDay =
    steps.length > 0 ? Math.max(...steps.map((s) => s.dayOffset)) : 0;

  const handleNextStep = () => {
    if (!name.trim()) {
      setNameError("Flow name is required.");
      return;
    }
    setNameError("");
    if (!selectedSegmentId) {
      setStep1Error("Please select a segment.");
      return;
    }
    setStep1Error("");
    setWizardStep(1);
  };

  const recompute = (arr: WorkflowStep[]) =>
    computeDayOffsets(arr).map((s, i) => ({ ...s, order: i + 1 }));

  function tryOpen(index: number) {
    if (openIndex !== null && openIndex !== index && isDirty) {
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

  const handleInsertDelay = (afterIndex: number) => {
    const arr = [...steps];
    arr.splice(afterIndex + 1, 0, defaultDelayStep());
    setSteps(recompute(arr));
  };

  const handleDelayDaysChange = (
    index: number,
    days: number,
    hours?: number,
    _minutes?: number,
    untilDate?: string,
    untilTime?: string,
  ) => {
    const updated = steps.map((s, i) =>
      i === index
        ? {
            ...s,
            delayDays: Math.max(0, days),
            delayHours: hours ?? s.delayHours ?? 0,
            note: untilDate
              ? `until:${untilDate}|${untilTime ?? "09:00"}`
              : s.note,
          }
        : s,
    );
    setSteps(recompute(updated));
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

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const ns = [...steps];
    const [moved] = ns.splice(fromIndex, 1);
    ns.splice(toIndex, 0, moved);
    setSteps(recompute(ns));
    if (openIndex === fromIndex) setOpenIndex(toIndex);
  };

  const handleLoadTemplate = (tpl: StepTemplate) => {
    const actionStepsCount = steps.filter(
      (s) => s.actionType !== "delay",
    ).length;
    if (actionStepsCount > 0) {
      if (
        !window.confirm(
          `Replace current steps with the "${tpl.name}" template?`,
        )
      )
        return;
    }
    const sorted = [...tpl.steps].sort((a, b) => a.dayOffset - b.dayOffset);
    const result: WorkflowStep[] = [];
    sorted.forEach((s, i) => {
      result.push({ ...defaultStep(0, s.actionType), name: s.name });
      if (i < sorted.length - 1) {
        const gap = sorted[i + 1].dayOffset - s.dayOffset;
        if (gap > 0) result.push({ ...defaultDelayStep(), delayDays: gap });
      }
    });
    setSteps(recompute(result));
    setOpenIndex(null);
    setIsDirty(false);
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
                  className="bg-transparent border-none outline-none text-xs text-muted-foreground placeholder:text-muted-foreground/40 focus:ring-0 w-64 mt-0.5 block"
                />
              </div>
            ) : (
              <h1 className="text-lg font-semibold text-foreground leading-tight">
                {id ? "Edit Flow" : "Create New Flow"}
              </h1>
            )}
          </div>
        </div>
        {wizardStep === 1 && (
          <div className="flex items-center gap-4">
            {/* Summary stats */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground border-r border-border pr-4">
              <span>
                <span className="font-semibold text-foreground">
                  {actionStepCount}
                </span>{" "}
                Steps
              </span>
              <span>
                <span className="font-semibold text-foreground">{maxDay}</span>{" "}
                Days
              </span>
              <span className="flex items-center gap-1 text-blue-600 font-medium">
                <Mail className="h-3.5 w-3.5" />
                {emailCount}
              </span>
              <span className="flex items-center gap-1 text-violet-600 font-medium">
                <MessageSquare className="h-3.5 w-3.5" />
                {smsCount}
              </span>
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <Phone className="h-3.5 w-3.5" />
                {callCount}
              </span>
            </div>
            <Button onClick={handleSave} disabled={steps.length === 0}>
              {id ? "Update Flow" : "Save Flow"}
            </Button>
          </div>
        )}
      </div>

      {/* ── Wizard body ── */}
      <div className="flex-1 overflow-auto">
        {/* ════════════ STEP 1: Choose Segment ════════════ */}
        {wizardStep === 0 && (
          <div className="max-w-xl mx-auto px-8 py-10">
            <div className="space-y-4">
              {/* ── Flow Details card ── */}
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
                    className={
                      nameError
                        ? "border-destructive focus-visible:ring-destructive/30"
                        : ""
                    }
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

              {/* ── Target Segment card ── */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-3">
                <SectionLabel>Target Segment</SectionLabel>
                <div className="space-y-2">
                  <FieldLabel required>Segment</FieldLabel>

                  {/* Search input with dropdown */}
                  <div className="relative" ref={segmentRef}>
                    <div
                      className={`flex items-center gap-2 px-3 h-9 rounded-md border bg-background cursor-pointer transition-colors ${
                        segmentOpen
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-input hover:border-primary/40"
                      } ${step1Error ? "border-destructive" : ""}`}
                      onClick={() => {
                        setSegmentOpen(true);
                      }}
                    >
                      <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      {segmentOpen ? (
                        <input
                          autoFocus
                          value={segmentSearch}
                          onChange={(e) => {
                            setSegmentSearch(e.target.value);
                            if (step1Error) setStep1Error("");
                          }}
                          placeholder="Search segments…"
                          className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground min-w-0"
                        />
                      ) : selectedSegmentId ? (
                        <>
                          <span className="flex-1 text-sm font-medium text-foreground truncate">
                            {selectedSegment?.name}
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {selectedSegment?.contactCount.toLocaleString()}{" "}
                            contacts
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
                          Select a segment…
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
                                  if (step1Error) setStep1Error("");
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
                                  <span className="font-medium truncate">
                                    {seg.name}
                                  </span>
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

                  {step1Error && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5" /> {step1Error}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleNextStep}
                  size="default"
                  className="gap-1.5"
                >
                  Next — Configure Steps <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ════════════ STEP 2: Configure Steps ════════════ */}
        {wizardStep === 1 && (
          <div className="px-8 py-8 flex gap-8 items-start max-w-6xl mx-auto w-full">
            {/* ── Main content ── */}
            <div className="flex-1 min-w-0 space-y-5">
              {/* Segment info card */}
              {selectedSegment && (
                <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    {selectedSegment.name}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {selectedSegment.contactCount.toLocaleString()} contacts
                  </span>
                </div>
              )}
              {/* Steps timeline */}
              {steps.filter((s) => s.actionType !== "delay").length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-border p-12 text-center text-muted-foreground">
                  <Mail className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium text-foreground mb-1">
                    No steps yet
                  </p>
                  <p className="text-sm">
                    Add a step from the panel on the right to get started.
                  </p>
                </div>
              ) : (
                <DndProvider backend={HTML5Backend}>
                  <div>
                    {/* Start node — static, non-draggable */}
                    <div className="flex gap-4 mb-0">
                      <div className="flex flex-col items-center flex-shrink-0 w-10">
                        <div className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center bg-gray-100 shadow-sm">
                          <UserCheck className="h-4 w-4 text-gray-500" />
                        </div>
                        <div className="w-0.5 bg-border/60 flex-1 min-h-6 mt-1 rounded-full" />
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3 select-none">
                          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold flex-shrink-0 whitespace-nowrap">
                            Day 0
                          </span>
                          <span className="font-semibold text-muted-foreground text-sm">Contact enrolled</span>
                        </div>
                      </div>
                    </div>
                    {steps.map((step, i) => {
                      if (step.actionType === "delay") {
                        return (
                          <DelayRow
                            key={step.id}
                            step={step}
                            isOpen={openIndex === i}
                            onOpen={() => tryOpen(i)}
                            onClose={() => { setOpenIndex(null); setIsDirty(false); }}
                            onChangeDays={(days, hours, minutes) =>
                              handleDelayDaysChange(i, days, hours, minutes)
                            }
                            onRemove={() => handleRemoveStep(i)}
                            onDirty={() => setIsDirty(true)}
                          />
                        );
                      }
                      const isLastStep = i === steps.length - 1;
                      const nextIsDelay =
                        !isLastStep && steps[i + 1]?.actionType === "delay";
                      return (
                        <div key={step.id}>
                          <StepRow
                            step={step}
                            index={i}
                            totalSteps={steps.length}
                            isEditing={openIndex === i}
                            onEdit={() => tryOpen(i)}
                            onSave={(updated) => handleStepSave(i, updated)}
                            onCancel={() => { setOpenIndex(null); setIsDirty(false); }}
                            onRemove={() => handleRemoveStep(i)}
                            onReorder={handleReorder}
                            showConnector={!isLastStep && !nextIsDelay}
                            onDirty={() => setIsDirty(true)}
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

            {/* ── Right sidebar ── */}
            <div className="w-72 flex-shrink-0 sticky top-8">
              {/* Add step */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm mb-4">
                <SectionLabel>Add Step</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleAddStep(opt.value)}
                      className={`flex flex-col items-center justify-center gap-2 px-2 py-3 rounded-lg border border-border bg-background transition-all duration-150 group ${TYPE_HOVER_STYLE[opt.value]}`}
                    >
                      <span
                        className={`w-9 h-9 rounded-lg flex items-center justify-center ${TYPE_ICON_BG[opt.value]}`}
                      >
                        <StepTypeIcon type={opt.value} />
                      </span>
                      <span className="text-xs font-medium text-foreground leading-tight text-center">
                        {opt.label}
                      </span>
                    </button>
                  ))}
                  <button
                    onClick={() => handleInsertDelay(steps.length - 1)}
                    disabled={steps.length === 0}
                    className="flex flex-col items-center justify-center gap-2 px-2 py-3 rounded-lg border border-border bg-background transition-all duration-150 hover:border-amber-300 hover:bg-amber-50/40 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600">
                      <Clock className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-medium text-foreground leading-tight text-center">
                      Add Delay
                    </span>
                  </button>
                </div>
              </div>

              {/* Templates */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm mb-4">
                <SectionLabel>Templates</SectionLabel>
                <div className="flex flex-col gap-2">
                  {STEP_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() =>
                        setSelectedTemplateId(
                          tpl.id === selectedTemplateId ? "" : tpl.id,
                        )
                      }
                      className={`w-full text-left px-3 py-2.5 rounded-lg border-2 transition-all ${
                        selectedTemplateId === tpl.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40 hover:bg-muted/30"
                      }`}
                    >
                      <p
                        className={`text-sm font-semibold leading-tight ${selectedTemplateId === tpl.id ? "text-primary" : "text-foreground"}`}
                      >
                        {tpl.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        {tpl.description}
                      </p>
                    </button>
                  ))}
                  <Button
                    size="sm"
                    variant={selectedTemplateId ? "default" : "outline"}
                    disabled={!selectedTemplateId}
                    onClick={() => {
                      const tpl = STEP_TEMPLATES.find(
                        (t) => t.id === selectedTemplateId,
                      );
                      if (tpl) handleLoadTemplate(tpl);
                    }}
                    className="w-full"
                  >
                    Load Template
                  </Button>
                </div>
              </div>
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

      <AlertDialog
        open={incompleteModalOpen}
        onOpenChange={setIncompleteModalOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Some steps need attention</AlertDialogTitle>
            <AlertDialogDescription>
              Please complete all steps before saving. Look for the{" "}
              <AlertCircle className="inline h-3 w-3 text-destructive align-middle" />{" "}
              indicator to find steps that still need to be set up.
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
