import { useMemo, useRef, useState } from "react";
import { Upload } from "lucide-react";
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
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { useAppData } from "@/app/contexts/AppDataContext";
import type { ContactImportSource, NewContactInput } from "@/app/types";

const TEMPLATES: Record<
  ContactImportSource,
  { title: string; description: string; header: string; sample: string }
> = {
  csv: {
    title: "Import contacts",
    description:
      "Paste CSV rows or choose a file. Rows whose email already exists are skipped.",
    header: "first_name,last_name,email,phone,role",
    sample:
      "first_name,last_name,email,phone,role\nAva,Nguyen,ava@example.com,(555) 200-1000,Borrower",
  },
  bizbuysell: {
    title: "Import BizBuySell leads",
    description:
      "BizBuySell checkbox export. Imported contacts are tagged with the bizbuysell_checkbox lead source.",
    header: "first_name,last_name,email,phone,listing",
    sample:
      "first_name,last_name,email,phone,listing\nMarco,Silva,marco@example.com,(555) 300-2000,Coffee Roastery",
  },
};

/** Maps a CSV header cell to the Contact field it fills. Unknown columns are ignored. */
const COLUMN_ALIASES: Record<string, keyof NewContactInput> = {
  first_name: "firstName",
  firstname: "firstName",
  last_name: "lastName",
  lastname: "lastName",
  email: "email",
  phone: "phone",
  role: "userType",
  listing: "listingName",
};

function parseCsv(text: string): NewContactInput[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

  return lines.slice(1).flatMap((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row: Partial<NewContactInput> = {};

    headers.forEach((header, index) => {
      const field = COLUMN_ALIASES[header];
      if (!field || !cells[index]) return;
      // Every aliased target is a string field on Contact.
      (row as Record<string, string>)[field] = cells[index];
    });

    if (!row.firstName || !row.lastName || !row.email) return [];
    return [row as NewContactInput];
  });
}

interface ContactImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: ContactImportSource;
}

export function ContactImportModal({
  open,
  onOpenChange,
  source,
}: ContactImportModalProps) {
  const { handleImportContacts } = useAppData();
  const [raw, setRaw] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const template = TEMPLATES[source];

  const parsed = useMemo(() => parseCsv(raw), [raw]);

  const close = () => {
    setRaw("");
    onOpenChange(false);
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setRaw(String(reader.result ?? ""));
    reader.onerror = () => toast.error("Could not read that file");
    reader.readAsText(file);
  };

  const submit = () => {
    if (parsed.length === 0) return;
    const { imported, skipped } = handleImportContacts(parsed, source);
    if (imported === 0) {
      toast.info("Nothing imported — every row already exists");
    } else {
      toast.success(
        `Imported ${imported} contact${imported > 1 ? "s" : ""}` +
          (skipped > 0 ? ` · ${skipped} skipped as duplicates` : ""),
      );
    }
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{template.title}</DialogTitle>
          <DialogDescription>{template.description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="import-csv">CSV data</Label>
            <Button
              variant="outline"
              className="h-8 text-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Choose file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readFile(file);
                e.target.value = "";
              }}
            />
          </div>

          <Textarea
            id="import-csv"
            rows={8}
            spellCheck={false}
            value={raw}
            placeholder={template.sample}
            onChange={(e) => setRaw(e.target.value)}
            className="font-mono text-xs"
          />

          <p className="text-xs text-muted-foreground">
            Expected columns: <code>{template.header}</code>
          </p>

          {raw.trim().length > 0 && (
            <p className="text-sm">
              {parsed.length > 0 ? (
                <span className="text-foreground">
                  {parsed.length} row{parsed.length > 1 ? "s" : ""} ready to import
                </span>
              ) : (
                <span className="text-destructive">
                  No valid rows — each row needs first name, last name and email
                </span>
              )}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button disabled={parsed.length === 0} onClick={submit}>
            Import {parsed.length > 0 ? `${parsed.length} contacts` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
