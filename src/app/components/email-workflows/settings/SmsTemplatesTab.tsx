import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import type { SmsTemplate, SmsTemplateCategory } from "../../../types";
import { useAppData } from "../../../contexts/AppDataContext";
import { Badge } from "../../ui/badge";
import { Input } from "../../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { CategoryManagerModal } from "./CategoryManagerModal";
import {
  DetailSection,
  FieldLabel,
  TemplateDetailHeader,
  TemplateEmptyState,
  TemplateModalShell,
  TemplateSidebarShell,
} from "./TemplateTabShared";

const SMS_CATEGORY_BUILTINS = ["Follow-up", "Reminder", "Appointment", "Alert", "Custom"];


const emptyForm = { name: "", message: "", category: "Follow-up" as SmsTemplateCategory };
type FormState = typeof emptyForm;

function extractVariables(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
}

function smsSegments(text: string) {
  return Math.ceil(text.length / 160) || 1;
}

// ── Form ──────────────────────────────────────────────────────────────────────

function SmsForm({
  form,
  categories,
  onChange,
}: {
  form: FormState;
  categories: string[];
  onChange: (updates: Partial<FormState>) => void;
}) {
  const variables = extractVariables(form.message);
  const segments = smsSegments(form.message);
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <FieldLabel>Template Name</FieldLabel>
        <Input value={form.name} placeholder="e.g. Quick Follow-up" onChange={(e) => onChange({ name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <FieldLabel>Category</FieldLabel>
        <Select value={form.category} onValueChange={(v) => onChange({ category: v as SmsTemplateCategory })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <FieldLabel>Message</FieldLabel>
          <span className="text-xs text-muted-foreground">{form.message.length} chars · {segments} segment{segments > 1 ? "s" : ""}</span>
        </div>
        <Textarea
          value={form.message}
          placeholder="Hi {{first_name}}, ..."
          rows={5}
          className="resize-none text-sm leading-relaxed"
          onChange={(e) => onChange({ message: e.target.value })}
        />
      </div>
      {variables.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">Detected variables</p>
          <div className="flex flex-wrap gap-1.5">
            {variables.map((v) => <Badge key={v} variant="secondary" className="text-xs font-mono px-2 py-0.5">{`{{${v}}}`}</Badge>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

export function SmsTemplatesTab() {
  const {
    smsTemplates,
    handleCreateSmsTemplate,
    handleUpdateSmsTemplate,
    handleDeleteSmsTemplate,
    smsCategories,
    handleAddSmsCategory,
    handleDeleteSmsCategory,
    handleRenameSmsCategory,
  } = useAppData();

  const [selected, setSelected] = useState<SmsTemplate | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState(emptyForm);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editConfirmSave, setEditConfirmSave] = useState(false);

  const openNew = () => { setNewForm(emptyForm); setNewOpen(true); };

  const handleCreate = () => {
    if (!newForm.name.trim() || !newForm.message.trim()) {
      toast.error("Name and message are required.");
      return;
    }
    handleCreateSmsTemplate({ ...newForm, characterCount: newForm.message.length });
    toast.success("SMS template created.");
    setNewOpen(false);
  };

  const openEdit = () => {
    if (!selected) return;
    setEditForm({ name: selected.name, message: selected.message, category: selected.category });
    setEditConfirmSave(false);
    setEditOpen(true);
  };

  const handleEditSave = () => {
    if (!editForm.name.trim() || !editForm.message.trim()) {
      toast.error("Name and message are required.");
      return;
    }
    setEditConfirmSave(true);
  };

  const handleEditConfirmSave = () => {
    if (selected) {
      handleUpdateSmsTemplate(selected.id, {
        ...editForm,
        characterCount: editForm.message.length,
      });
      setSelected({ ...selected, ...editForm });
      toast.success("SMS template updated.");
    }
    setEditOpen(false);
    setEditConfirmSave(false);
  };

  const handleDelete = (id: string) => {
    handleDeleteSmsTemplate(id);
    if (selected?.id === id) setSelected(null);
    setConfirmDeleteId(null);
    toast.success("SMS template deleted.");
  };

  const viewVariables = extractVariables(selected?.message ?? "");
  const viewSegments = smsSegments(selected?.message ?? "");

  return (
    <>
      <div className="flex h-full min-h-0">
        <TemplateSidebarShell
          newLabel="New Template"
          onNew={openNew}
          onCategories={() => setCatModalOpen(true)}
          isEmpty={smsTemplates.length === 0}
          emptyIcon={<MessageSquare className="w-7 h-7 text-muted-foreground/30 mb-2" />}
          emptyText="No templates yet."
        >
          {smsTemplates.map((t) => {
            const isActive = selected?.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setSelected(t); setConfirmDeleteId(null); }}
                className={`w-full text-left px-3 py-2.5 border-b border-border/40 last:border-b-0 transition-colors ${isActive ? "bg-background shadow-sm" : "hover:bg-background/60"}`}
              >
                <p className={`text-sm font-medium truncate ${isActive ? "text-primary" : "text-foreground"}`}>{t.name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={"text-[10px] font-medium px-1.5 py-0.5 rounded border bg-muted text-muted-foreground border-border"}>{t.category}</span>
                  <span className="text-[10px] text-muted-foreground">{t.characterCount} chars</span>
                </div>
              </button>
            );
          })}
        </TemplateSidebarShell>

        {selected ? (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            <div className="rounded-xl border border-border bg-card">
              <TemplateDetailHeader
                name={selected.name}
                subtitle={<><span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-muted text-muted-foreground border-border">{selected.category}</span><span className="text-xs text-muted-foreground">{selected.characterCount} chars</span></>}
                itemId={selected.id}
                confirmDeleteId={confirmDeleteId}
                onEdit={openEdit}
                onDelete={() => handleDelete(selected.id)}
                onRequestDelete={setConfirmDeleteId}
                onCancelDelete={() => setConfirmDeleteId(null)}
              />
            </div>
            <div>
              <div className="rounded-xl border border-border bg-card p-4">
                <DetailSection
                  label="Message"
                  headerRight={<span className="text-xs text-muted-foreground">{selected.characterCount} chars · {viewSegments} segment{viewSegments > 1 ? "s" : ""}</span>}
                >
                  <div className="space-y-3">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selected.message}</p>
                    {viewVariables.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-border">
                        <p className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">Variables</p>
                        <div className="flex flex-wrap gap-1.5">
                          {viewVariables.map((v) => <Badge key={v} variant="secondary" className="text-xs font-mono px-2 py-0.5">{`{{${v}}}`}</Badge>)}
                        </div>
                      </div>
                    )}
                  </div>
                </DetailSection>
              </div>
            </div>
          </div>
        ) : (
          <TemplateEmptyState
            icon={<MessageSquare className="w-5 h-5 text-muted-foreground/50" />}
            label="No template selected"
            hint="Pick a template from the list or create a new one."
          />
        )}
      </div>

      <TemplateModalShell open={newOpen} title="New SMS Template" saveLabel="Create Template" onOpenChange={setNewOpen} onSave={handleCreate}>
        <SmsForm form={newForm} categories={smsCategories} onChange={(u) => setNewForm((f) => ({ ...f, ...u }))} />
      </TemplateModalShell>

      <TemplateModalShell
        open={editOpen}
        title="Edit SMS Template"
        saveLabel="Save Changes"
        confirmSave={editConfirmSave}
        itemLabel="template"
        onOpenChange={(open) => { if (!open) { setEditOpen(false); setEditConfirmSave(false); } }}
        onSave={handleEditSave}
        onConfirmSave={handleEditConfirmSave}
        onCancelConfirm={() => setEditConfirmSave(false)}
      >
        <SmsForm form={editForm} categories={smsCategories} onChange={(u) => setEditForm((f) => ({ ...f, ...u }))} />
      </TemplateModalShell>

      <CategoryManagerModal
        open={catModalOpen}
        title="SMS Template Categories"
        categories={smsCategories}
        builtins={SMS_CATEGORY_BUILTINS}
        onOpenChange={setCatModalOpen}
        onAdd={handleAddSmsCategory}
        onDelete={handleDeleteSmsCategory}
        onRename={handleRenameSmsCategory}
      />
    </>
  );
}
