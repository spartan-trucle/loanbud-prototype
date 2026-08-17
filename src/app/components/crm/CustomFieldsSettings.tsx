import { useEffect, useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import { useAppData } from "@/app/contexts/AppDataContext";
import type { CustomFieldDefinition, CustomFieldType } from "@/app/types";

const FIELD_TYPES: CustomFieldType[] = ["text", "number", "date", "select"];

const TH_CLASS = "px-6 py-3 text-left text-sm text-muted-foreground";
const TH_STYLE = { fontFamily: "var(--font-sans)", fontWeight: 600 } as const;

/** Turns a label into the stable key that forms post. */
function toFieldKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function CustomFieldsSettings() {
  const {
    customFieldDefinitions,
    handleUpdateCustomField,
    handleDeleteCustomField,
  } = useAppData();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomFieldDefinition | undefined>();

  const discovered = customFieldDefinitions.filter((f) => f.isAutoDiscovered);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">Custom fields</h3>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Define a field once and it appears on the contact tab, becomes filterable in
            segments, and can be used in email templates. Fields arriving from a new
            marketing form are captured automatically and stay hidden until you turn
            them on.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New field
        </Button>
      </div>

      {discovered.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <Sparkles className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-900">
            {discovered.length} field{discovered.length > 1 ? "s were" : " was"}{" "}
            auto-discovered from inbound forms and{" "}
            {discovered.some((f) => !f.isVisible)
              ? "are hidden until you show them"
              : "are now visible"}
            .
          </p>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className={TH_CLASS} style={TH_STYLE}>Label</th>
                <th className={TH_CLASS} style={TH_STYLE}>Key</th>
                <th className={TH_CLASS} style={TH_STYLE}>Type</th>
                <th className={TH_CLASS} style={TH_STYLE}>Section</th>
                <th className={TH_CLASS} style={TH_STYLE}>Show on contact</th>
                <th className={TH_CLASS} style={TH_STYLE}>Filterable</th>
                <th className={TH_CLASS} style={TH_STYLE} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customFieldDefinitions.map((field) => (
                <tr key={field.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-3">
                    <button
                      className="text-sm font-semibold text-blue-600"
                      onClick={() => {
                        setEditing(field);
                        setFormOpen(true);
                      }}
                    >
                      {field.label}
                    </button>
                    {field.isAutoDiscovered && (
                      <span className="ml-2 px-1.5 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800 text-[11px]">
                        auto
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <code className="text-xs">{field.key}</code>
                  </td>
                  <td className="px-6 py-3 text-sm">{field.type}</td>
                  <td className="px-6 py-3 text-sm">{field.section}</td>
                  <td className="px-6 py-3">
                    <Switch
                      checked={field.isVisible}
                      onCheckedChange={(checked) =>
                        handleUpdateCustomField(field.id, { isVisible: checked })
                      }
                    />
                  </td>
                  <td className="px-6 py-3">
                    <Switch
                      checked={field.isFilterable}
                      onCheckedChange={(checked) =>
                        handleUpdateCustomField(field.id, { isFilterable: checked })
                      }
                    />
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Button
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        handleDeleteCustomField(field.id);
                        toast.success(`${field.label} deleted`);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {customFieldDefinitions.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <p>No custom fields defined yet</p>
          </div>
        )}
      </div>

      <CustomFieldFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        field={editing}
      />
    </div>
  );
}

function CustomFieldFormModal({
  open,
  onOpenChange,
  field,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field?: CustomFieldDefinition;
}) {
  const { handleCreateCustomField, handleUpdateCustomField } = useAppData();
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [type, setType] = useState<CustomFieldType>("text");
  const [options, setOptions] = useState("");
  const [section, setSection] = useState("Questionnaire");
  const [isVisible, setIsVisible] = useState(true);
  const [isFilterable, setIsFilterable] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLabel(field?.label ?? "");
    setKey(field?.key ?? "");
    setKeyTouched(Boolean(field));
    setType(field?.type ?? "text");
    setOptions(field?.options?.join(", ") ?? "");
    setSection(field?.section ?? "Questionnaire");
    setIsVisible(field?.isVisible ?? true);
    setIsFilterable(field?.isFilterable ?? false);
  }, [open, field]);

  const effectiveKey = keyTouched ? key : toFieldKey(label);
  const canSubmit = label.trim().length > 0 && effectiveKey.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    const parsedOptions =
      type === "select"
        ? options
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined;

    const payload = {
      label: label.trim(),
      key: effectiveKey,
      type,
      options: parsedOptions,
      section: section.trim() || "Questionnaire",
      isVisible,
      isFilterable,
      isAutoDiscovered: field?.isAutoDiscovered ?? false,
    };

    if (field) {
      handleUpdateCustomField(field.id, payload);
      toast.success(`${payload.label} updated`);
    } else {
      handleCreateCustomField(payload);
      toast.success(`${payload.label} created`);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{field ? "Edit field" : "New custom field"}</DialogTitle>
          <DialogDescription>
            The key is what marketing forms post. Keep it stable once leads start
            arriving with it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="field-label">Label</Label>
            <Input
              id="field-label"
              value={label}
              placeholder="Monthly revenue"
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="field-key">Key</Label>
            <Input
              id="field-key"
              value={effectiveKey}
              className="font-mono text-sm"
              onChange={(e) => {
                setKeyTouched(true);
                setKey(toFieldKey(e.target.value));
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as CustomFieldType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="field-section">Section</Label>
              <Input
                id="field-section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
              />
            </div>
          </div>

          {type === "select" && (
            <div className="grid gap-1.5">
              <Label htmlFor="field-options">Options</Label>
              <Input
                id="field-options"
                value={options}
                placeholder="Under $100k, $100k – $250k, Over $250k"
                onChange={(e) => setOptions(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Comma separated.</p>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <div className="text-sm font-medium">Show on contact tab</div>
              <div className="text-xs text-muted-foreground">
                Hidden fields are still stored and still searchable later.
              </div>
            </div>
            <Switch checked={isVisible} onCheckedChange={setIsVisible} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <div className="text-sm font-medium">Filterable in segments</div>
              <div className="text-xs text-muted-foreground">
                Offer this field when building a segment.
              </div>
            </div>
            <Switch checked={isFilterable} onCheckedChange={setIsFilterable} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={submit}>
            {field ? "Save changes" : "Create field"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
