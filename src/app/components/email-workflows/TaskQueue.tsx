import { useState, useEffect } from "react";
import { useLocation } from "react-router";
import {
  CheckCircle2,
  Plus,
  ArrowUp,
  ArrowDown,
  Search,
  BarChart3,
  Users,
  Layers,
} from "lucide-react";
import type { TaskItem } from "@/app/types";
import { useAppData } from "@/app/contexts/AppDataContext";
import { CURRENT_USER } from "@/app/config/featureFlags";
import { canManageTasks } from "@/app/config/team";
import { getTaskTypeConfig } from "@/app/lib/taskTypeRegistry";
import { TaskBulkActionsBar } from "./TaskBulkActionsBar";
import { TaskBulkActionModal } from "./TaskBulkActionModal";
import { CreateTaskModal } from "./CreateTaskModal";
import { BulkCreateTaskModal } from "./BulkCreateTaskModal";
import { LoGroupsModal } from "./LoGroupsModal";
import { TaskAdvancedFilter } from "./TaskAdvancedFilter";
import { TaskDetailPanel } from "./TaskDetailPanel";

const DUE_SOON_MS = 24 * 60 * 60 * 1000;

type BulkMode = "complete" | "reschedule" | "delete" | null;
type DueDateFilter = "all" | "today" | "this-week" | "overdue";
type SortField = "dueDate" | "name" | "source";

interface TaskQueueProps {
  tasks?: TaskItem[];
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
  viewMode?: "list" | "assignee";
  onViewModeToggle?: () => void;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isWithinDays(date: Date, days: number) {
  const now = new Date();
  const limit = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return date >= now && date <= limit;
}

export function TaskQueue({
  tasks: tasksProp,
  searchTerm,
  onSearchChange,
  viewMode,
  onViewModeToggle,
}: TaskQueueProps) {
  const {
    contacts,
    taskItems,
    handleBulkCompleteTask,
    handleBulkRescheduleTask,
    handleBulkDeleteTask,
  } = useAppData();

  const isAdmin = canManageTasks();

  const allTasks = tasksProp ?? taskItems;
  const contactById = new Map(contacts.map((c) => [c.id, c]));

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [showLoGroups, setShowLoGroups] = useState(false);
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState<BulkMode>(null);

  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [sortField, setSortField] = useState<SortField>("dueDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Detail panel state — store ID only so it always reflects live taskItems
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const detailTask = detailTaskId ? (allTasks.find((t) => t.id === detailTaskId) ?? null) : null;

  // Auto-open task detail panel when navigated with state: { openTaskId }
  const location = useLocation();
  useEffect(() => {
    const openTaskId = (location.state as { openTaskId?: string } | null)?.openTaskId;
    if (openTaskId) {
      setDetailTaskId(openTaskId);
      setDetailOpen(true);
    }
  }, [location.state]);

  // Assignee filter — only active when tasks prop is NOT passed (full Tasks page)
  const showAssigneeFilter = !tasksProp;
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const uniqueAssignees = Array.from(
    new Set(allTasks.map((t) => t.assignee).filter((a): a is string => !!a))
  ).sort();

  const now = new Date();

  const useMyTasks = myTasksOnly;

  const filtered = allTasks.filter((t) => {
    if (!showCompleted && (t.status === "completed" || t.status === "suspended")) return false;
    const due = new Date(t.dueDate);
    if (dueDateFilter === "today" && !isSameDay(due, now)) return false;
    if (dueDateFilter === "this-week" && !isWithinDays(due, 7)) return false;
    if (dueDateFilter === "overdue" && !(due < now && t.status !== "completed")) return false;
    if (useMyTasks && t.assignee !== CURRENT_USER) return false;
    if (!useMyTasks && showAssigneeFilter && assigneeFilter !== "all" && t.assignee !== assigneeFilter) return false;
    return true;
  });

  const isOverdue = (t: TaskItem) =>
    t.status === "overdue" || (new Date(t.dueDate) < now && t.status !== "completed" && t.status !== "suspended");

  const isDueSoon = (t: TaskItem) => {
    if (t.status === "completed" || t.status === "suspended") return false;
    const due = new Date(t.dueDate);
    return due >= now && due.getTime() - now.getTime() <= DUE_SOON_MS;
  };

  const comparator = (a: TaskItem, b: TaskItem): number => {
    if (sortField === "dueDate")
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (sortField === "name") return a.contactName.localeCompare(b.contactName);
    return (a.source ?? "").localeCompare(b.source ?? "");
  };

  const overdueTasks = filtered.filter(isOverdue).sort(comparator);
  const nonOverdueTasks = filtered.filter((t) => !isOverdue(t)).sort(comparator);
  const pendingTasks = [
    ...(sortDir === "asc" ? overdueTasks : [...overdueTasks].reverse()),
    ...(sortDir === "asc" ? nonOverdueTasks : [...nonOverdueTasks].reverse()),
  ];

  const openDetailPanel = (task: TaskItem) => {
    setDetailTaskId(task.id);
    setDetailOpen(true);
  };

  const handleSelectAll = () => {
    if (selectedTasks.length === pendingTasks.length && pendingTasks.length > 0)
      setSelectedTasks([]);
    else setSelectedTasks(pendingTasks.map((t) => t.id));
  };
  const handleSelectTask = (id: string) => {
    setSelectedTasks((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const openBulkModal = (mode: BulkMode) => setBulkMode(mode);
  const closeBulkModal = () => setBulkMode(null);

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
    setSelectedTasks([]);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 text-primary" />
    ) : (
      <ArrowDown className="w-3 h-3 text-primary" />
    );
  };

  const dueDateChips: { key: DueDateFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "today", label: "Today" },
    { key: "this-week", label: "This Week" },
    { key: "overdue", label: "Overdue" },
  ];

  const dueDateCounts: Record<DueDateFilter, number> = {
    all: allTasks.filter((t) => t.status !== "completed").length,
    today: allTasks.filter(
      (t) => t.status !== "completed" && isSameDay(new Date(t.dueDate), now),
    ).length,
    "this-week": allTasks.filter(
      (t) => t.status !== "completed" && isWithinDays(new Date(t.dueDate), 7),
    ).length,
    overdue: allTasks.filter((t) => isOverdue(t)).length,
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Page header — hidden when embedded inside another component */}
      {!tasksProp && <div className="border-b border-border bg-card px-8 py-5 shrink-0">
        <h1 className="text-3xl font-semibold text-foreground">Tasks</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{allTasks.length} tasks</p>
      </div>}

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Filter row */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-border gap-4 shrink-0">
          <div className="flex items-center gap-1">
            {dueDateChips.map(({ key, label }) => {
              const active = dueDateFilter === key;
              const count = dueDateCounts[key];
              const isOverdueChip = key === "overdue";
              return (
                <button
                  key={key}
                  onClick={() => {
                    setDueDateFilter(key);
                    setSelectedTasks([]);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    active && isOverdueChip
                      ? "bg-red-50 text-red-600 border-red-200"
                      : active
                      ? "bg-muted text-foreground border-border"
                      : "text-muted-foreground hover:bg-muted/60 border-border"
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span
                      className={`text-[11px] font-semibold tabular-nums ${
                        active && isOverdueChip ? "text-red-400" : "text-muted-foreground"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* V2 (RFC-008): My tasks / Team toggle */}
            {(
              <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
                <button
                  onClick={() => { setMyTasksOnly(true); setSelectedTasks([]); }}
                  className={`px-2.5 py-1 transition-colors ${myTasksOnly ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                >
                  My tasks
                </button>
                <button
                  onClick={() => { setMyTasksOnly(false); setSelectedTasks([]); }}
                  className={`px-2.5 py-1 transition-colors ${!myTasksOnly ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                >
                  Team
                </button>
              </div>
            )}
            {showAssigneeFilter && !useMyTasks && (
              <select
                value={assigneeFilter}
                onChange={(e) => {
                  setAssigneeFilter(e.target.value);
                  setSelectedTasks([]);
                }}
                className="h-7 px-2.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">All assignees</option>
                {uniqueAssignees.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            )}
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => {
                  setShowCompleted(e.target.checked);
                  setSelectedTasks([]);
                }}
                className="rounded border-border"
              />
              Show completed
            </label>
            {/* V2 (RFC-008): admin bulk-create + LO groups */}
            {isAdmin && (
              <>
                <button
                  onClick={() => setShowLoGroups(true)}
                  title="LO Groups"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border text-foreground text-xs font-medium rounded-lg hover:bg-muted transition-colors"
                >
                  <Users className="w-3.5 h-3.5" />
                  LO Groups
                </button>
                <button
                  onClick={() => setShowBulkCreate(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-primary/40 text-primary text-xs font-medium rounded-lg hover:bg-primary/5 transition-colors"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Bulk Create
                </button>
              </>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              New Task
            </button>
          </div>
        </div>

        {/* V2 (RFC-008): advanced filter preview (Phase 3) */}
        {<TaskAdvancedFilter />}

        {/* Search + view toggle */}
        {onSearchChange && (
          <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm ?? ""}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-muted/40 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {onViewModeToggle && (
              <button
                onClick={onViewModeToggle}
                className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg hover:bg-muted text-xs font-medium transition-colors shrink-0"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                {viewMode === "list" ? "By Assignee" : "List View"}
              </button>
            )}
          </div>
        )}

        <div className={`flex-1 overflow-auto ${selectedTasks.length > 0 ? "pb-20" : ""}`}>
          <table className="w-full table-fixed min-w-[900px]">
            <thead className="bg-muted/50 border-b border-border sticky top-0">
              <tr>
                <th className="w-[50px] px-4 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={
                      selectedTasks.length === pendingTasks.length && pendingTasks.length > 0
                    }
                    onChange={handleSelectAll}
                    className="rounded border-border"
                  />
                </th>
                <th
                  className="w-[150px] px-4 py-4 text-left text-sm font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => toggleSort("dueDate")}
                >
                  <div className="flex items-center gap-1.5">
                    Due Date <SortIcon field="dueDate" />
                  </div>
                </th>
                <th
                  className="w-[200px] px-4 py-4 text-left text-sm font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => toggleSort("name")}
                >
                  <div className="flex items-center gap-1.5">
                    Contact <SortIcon field="name" />
                  </div>
                </th>
                <th className="w-[100px] px-4 py-4 text-left text-sm font-semibold text-muted-foreground">
                  Type
                </th>
                <th
                  className="w-[180px] px-4 py-4 text-left text-sm font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => toggleSort("source")}
                >
                  <div className="flex items-center gap-1.5">
                    Source <SortIcon field="source" />
                  </div>
                </th>
                <th className="w-[130px] px-4 py-4 text-left text-sm font-semibold text-muted-foreground">
                  Assignee
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-muted-foreground">
                  Objective / Notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pendingTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p>All caught up!</p>
                  </td>
                </tr>
              ) : (
                pendingTasks.map((task) => {
                  const isSelected = selectedTasks.includes(task.id);
                  const overdueFlag = isOverdue(task);
                  const typeConfig = getTaskTypeConfig(task.taskType);
                  const TypeIcon = typeConfig.icon;

                  return (
                    <tr
                      key={task.id}
                      className={`group hover:bg-muted/20 transition-colors cursor-pointer ${
                        isSelected ? "bg-muted/10" : ""
                      } ${task.status === "suspended" ? "opacity-50" : ""}`}
                      onClick={() => openDetailPanel(task)}
                    >
                      {/* Checkbox — does not open panel */}
                      <td
                        className="px-4 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectTask(task.id)}
                          className="rounded border-border"
                        />
                      </td>

                      {/* Due date */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-muted-foreground">{formatDate(task.dueDate)}</div>
                        {overdueFlag && task.status !== "completed" && (
                          <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded uppercase tracking-tighter">
                            Overdue
                          </span>
                        )}
                        {!overdueFlag && isDueSoon(task) && (
                          <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded uppercase tracking-tighter">
                            Due soon
                          </span>
                        )}
                        {task.status === "completed" && (
                          <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded uppercase tracking-tighter">
                            Done
                          </span>
                        )}
                        {task.status === "suspended" && (
                          <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded uppercase tracking-tighter">
                            Paused
                          </span>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-foreground truncate">
                          {task.contactName}
                        </div>
                        <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-muted rounded uppercase tracking-tighter text-muted-foreground">
                          {task.contactStatus}
                        </span>
                      </td>

                      {/* Type badge — colors from registry */}
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-tighter ${typeConfig.badgeColor}`}
                        >
                          <TypeIcon className="w-2.5 h-2.5" />
                          {task.taskType}
                        </span>
                      </td>

                      {/* Source */}
                      <td className="px-4 py-4">
                        {task.source ? (
                          <>
                            <div
                              className="text-sm text-foreground truncate"
                              title={task.source}
                            >
                              {task.source}
                            </div>
                            {task.ruleName && (
                              <div className="text-xs text-muted-foreground truncate">
                                {task.ruleName}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Assignee */}
                      <td className="px-4 py-4">
                        {task.assignee ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-semibold text-primary">
                                {task.assignee.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span
                              className="text-xs text-muted-foreground truncate"
                              title={task.assignee}
                            >
                              {task.assignee}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Objective / Notes */}
                      <td className="px-4 py-4">
                        {task.triggerContext && (
                          <div
                            className="text-sm text-foreground line-clamp-2"
                            title={task.triggerContext}
                          >
                            {task.triggerContext}
                          </div>
                        )}
                        {task.notes && (
                          <div className="mt-1 text-xs text-muted-foreground italic line-clamp-2">
                            VM: {task.notes}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {selectedTasks.length > 0 && (
          <TaskBulkActionsBar
            selectedCount={selectedTasks.length}
            onComplete={() => openBulkModal("complete")}
            onReschedule={() => openBulkModal("reschedule")}
            onDelete={() => openBulkModal("delete")}
          />
        )}

        <TaskBulkActionModal
          isOpen={bulkMode !== null}
          mode={bulkMode}
          selectedCount={selectedTasks.length}
          onComplete={(dis, note) => {
            handleBulkCompleteTask(selectedTasks, dis, note);
            setSelectedTasks([]);
            closeBulkModal();
          }}
          onReschedule={(date) => {
            handleBulkRescheduleTask(selectedTasks, date);
            setSelectedTasks([]);
            closeBulkModal();
          }}
          onDelete={() => {
            handleBulkDeleteTask(selectedTasks);
            setSelectedTasks([]);
            closeBulkModal();
          }}
          onClose={closeBulkModal}
        />

        <CreateTaskModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />

        {/* V2 (RFC-008): admin bulk-create + LO group management */}
        {isAdmin && (
          <>
            <BulkCreateTaskModal
              isOpen={showBulkCreate}
              onClose={() => setShowBulkCreate(false)}
              onManageGroups={() => setShowLoGroups(true)}
            />
            <LoGroupsModal
              isOpen={showLoGroups}
              onClose={() => setShowLoGroups(false)}
            />
          </>
        )}
      </div>

      {/* Task Detail Panel (right-side drawer) — sole interaction surface for all task actions */}
      <TaskDetailPanel
        task={detailTask}
        isOpen={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailTaskId(null);
        }}
        contactPhone={
          detailTask ? (contactById.get(detailTask.contactId)?.phone ?? undefined) : undefined
        }
        contactEmail={
          detailTask ? (contactById.get(detailTask.contactId)?.email ?? undefined) : undefined
        }
        contactListingName={
          detailTask ? (contactById.get(detailTask.contactId)?.listingName ?? undefined) : undefined
        }
        contact={detailTask ? (contactById.get(detailTask.contactId) ?? null) : null}
      />
    </div>
  );
}
