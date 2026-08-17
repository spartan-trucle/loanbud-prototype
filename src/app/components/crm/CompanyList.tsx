import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
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
import { useAppData } from "@/app/contexts/AppDataContext";

const COMPANY_TYPES = ["Borrower", "Partner", "Lender", "Vendor"];

const TH_CLASS = "px-6 py-4 text-left text-sm text-muted-foreground";
const TH_STYLE = { fontFamily: "var(--font-sans)", fontWeight: 600 } as const;

export function CompanyList() {
  const { companies, contacts, handleCreateCompany } = useAppData();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [addOpen, setAddOpen] = useState(false);

  const contactName = (id?: string) => {
    const contact = contacts.find((c) => c.id === id);
    return contact ? `${contact.firstName} ${contact.lastName}` : null;
  };

  const visible = useMemo(() => {
    let result = companies;
    if (typeFilter !== "ALL") {
      result = result.filter((c) => c.companyType === typeFilter);
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(term));
    }
    return result;
  }, [companies, search, typeFilter]);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border bg-card px-8 py-6">
        <div className="flex items-center mb-4">
          <h2
            className="text-3xl mr-6"
            style={{ fontFamily: "var(--font-sans)", fontWeight: 600 }}
          >
            Companies
          </h2>
          <p className="text-muted-foreground mt-1">{visible.length} companies</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-2 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              style={{ height: "38px" }}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-[180px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Company type: All</SelectItem>
              {COMPANY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setAddOpen(true)} className="px-3 py-1.5 text-sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Company
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className={TH_CLASS} style={TH_STYLE}>Company Name</th>
                    <th className={TH_CLASS} style={TH_STYLE}>Company Type</th>
                    <th className={TH_CLASS} style={TH_STYLE}>Primary Contact</th>
                    <th className={TH_CLASS} style={TH_STYLE}>Last Activity</th>
                    <th className={TH_CLASS} style={TH_STYLE}>Tags</th>
                    <th className={TH_CLASS} style={TH_STYLE}>Attribution Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((company) => (
                    <tr key={company.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-blue-600">
                        {company.name}
                      </td>
                      <td className="px-6 py-4 text-sm">{company.companyType}</td>
                      <td className="px-6 py-4 text-sm">
                        {contactName(company.primaryContactId) ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {company.updatedAt?.toLocaleDateString() ??
                          company.createdAt.toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {(company.tags ?? []).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded-full border border-border bg-muted/50 text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-muted-foreground">
                          {company.attributionSource ?? "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {visible.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <p>No companies match your filters</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AddCompanyModal
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreate={(name, companyType) => {
          handleCreateCompany({ name, companyType, attributionSource: "CRM" });
          toast.success(`${name} added`);
        }}
      />
    </div>
  );
}

function AddCompanyModal({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, companyType: string) => void;
}) {
  const [name, setName] = useState("");
  const [companyType, setCompanyType] = useState("Borrower");

  const submit = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), companyType);
    setName("");
    setCompanyType("Borrower");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Add company</DialogTitle>
          <DialogDescription>
            Created in the CRM, so its attribution source is recorded as manual entry.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="company-name">Company name</Label>
            <Input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Company type</Label>
            <Select value={companyType} onValueChange={setCompanyType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!name.trim()} onClick={submit}>
            Add company
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
