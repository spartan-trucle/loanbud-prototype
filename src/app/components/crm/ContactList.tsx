import { useState, useMemo } from "react";
import { Search, Upload } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useAppData } from "@/app/contexts/AppDataContext";
import { useNavigate } from "react-router";
import { AttributionFilterPopover } from "./AttributionFilterPopover";
import { ContactsFilterBar } from "./ContactsFilterBar";
import { EMPTY_CONTACT_FILTERS, type ContactFilters } from "./contactFilters";
import { ContactAddModal } from "./ContactAddModal";
import { ContactImportModal } from "./ContactImportModal";
import type { Contact, ContactImportSource } from "@/app/types";
import {
  attributionDescendantIds,
  attributionPathNodes,
} from "@/app/data/attributionTaxonomy";
import {
  attributionSummary,
  LEAD_SOURCES,
  leadSourceLabel,
  leadSourceTone,
} from "@/app/data/attribution";
import { contactsSharingPhone } from "@/app/data/contactDuplicates";
import { resolveCampaign, resolveCampaignId } from "@/app/data/campaignUtils";

type ActiveView = "all" | "broker" | "lender" | "partner";

const VIEW_CHIPS: { label: string; value: ActiveView }[] = [
  { label: "All Contacts", value: "all" },
  { label: "My Leads", value: "broker" },
  { label: "Referral Partners", value: "partner" },
  { label: "Saved View (1)", value: "lender" },
];

const CONTACT_STATUSES = ["Active", "Inactive", "Unqualified"];

const TH_CLASS = "px-6 py-4 text-left text-sm text-muted-foreground";
const TH_STYLE = { fontFamily: "var(--font-sans)", fontWeight: 600 } as const;

/** Companies shown in the list: the multi-company field, falling back to the listing name. */
function companiesOf(contact: Contact): string[] {
  if (contact.companies && contact.companies.length > 0) return contact.companies;
  return contact.listingName ? [contact.listingName] : [];
}

/**
 * The list shows the traffic source only. Drill-downs stay on the contact detail —
 * a second line per row makes the table noisy and the enum is what people scan for.
 * The full path is still available on hover.
 */
function TrafficSourceCell({ contact }: { contact: Contact }) {
  const trafficSource = contact.leadSource;

  if (!trafficSource) {
    return <span className="text-xs text-muted-foreground">Unknown</span>;
  }

  return (
    <span
      title={attributionSummary(contact)}
      className={`inline-flex w-fit px-2 py-0.5 rounded-full border text-xs whitespace-nowrap ${leadSourceTone(trafficSource)}`}
    >
      {leadSourceLabel(trafficSource)}
    </span>
  );
}

export function ContactList() {
  const { contacts, campaigns } = useAppData();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState<ActiveView>("all");
  // V2 (RFC-009): hierarchical attribution filter — selected pyramid nodes
  const [attributionIds, setAttributionIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<ContactFilters>(EMPTY_CONTACT_FILTERS);
  const [addOpen, setAddOpen] = useState(false);
  const [importSource, setImportSource] = useState<ContactImportSource | null>(null);

  // Filter dropdown options are derived from the data, like the real filter-data hook.
  const sharesPhone = useMemo(() => contactsSharingPhone(contacts), [contacts]);

  const companyOptions = useMemo(
    () => [...new Set(contacts.flatMap(companiesOf))].sort(),
    [contacts],
  );
  const roleOptions = useMemo(
    () => [...new Set(contacts.map((c) => c.userType))].sort(),
    [contacts],
  );
  const assigneeOptions = useMemo(
    () =>
      [...new Set(contacts.map((c) => c.loanOfficer).filter((v): v is string => !!v))].sort(),
    [contacts],
  );

  const filteredContacts = useMemo(() => {
    let result = contacts;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (c) =>
          c.firstName.toLowerCase().includes(term) ||
          c.lastName.toLowerCase().includes(term) ||
          c.email.toLowerCase().includes(term) ||
          c.listingName.toLowerCase().includes(term),
      );
    }

    if (activeView !== "all") {
      result = result.filter((c) => c.userType.toLowerCase() === activeView);
    }

    if (filters.company !== "ALL") {
      result = result.filter((c) => companiesOf(c).includes(filters.company));
    }

    if (filters.role !== "ALL") {
      result = result.filter((c) => c.userType === filters.role);
    }

    if (filters.status !== "ALL") {
      // Seeded contacts predate the status field; they read as Active.
      result = result.filter((c) => (c.status ?? "Active") === filters.status);
    }

    if (filters.assignee !== "ALL") {
      result = result.filter((c) => c.loanOfficer === filters.assignee);
    }

    if (filters.trafficSource !== "ALL") {
      result = result.filter(
        (c) => c.leadSource === filters.trafficSource,
      );
    }

    if (filters.campaign !== "ALL") {
      result = result.filter((c) => resolveCampaignId(c) === filters.campaign);
    }

    // Possible duplicates, computed rather than flagged at write time.
    //
    // Email is the only matching key, so somebody using a work address on one form
    // and a personal one on another becomes two contacts. Nothing detects that at
    // ingest — by design, since the alternative is matching on a phone number that a
    // household or a business line may share. It surfaces here instead, the same way
    // HubSpot surfaces its duplicates: as a list to review, not an automatic merge.
    if (filters.identityReview !== "ALL") {
      const wanted = filters.identityReview === "DUPLICATES";
      result = result.filter((c) => sharesPhone.has(c.id) === wanted);
    }

    if (filters.createdFrom) {
      const from = new Date(filters.createdFrom);
      result = result.filter((c) => c.createAt >= from);
    }

    if (filters.createdTo) {
      // The picker gives a day; include everything within that day.
      const to = new Date(filters.createdTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((c) => c.createAt <= to);
    }

    if (attributionIds.length > 0) {
      // descendant-inclusive: selecting "Partnership" matches every contact
      // classified anywhere under that branch (BizBuySell API + Checkbox, ...)
      const expanded = attributionDescendantIds(attributionIds);
      result = result.filter(
        (c) => c.attributionNodeId != null && expanded.has(c.attributionNodeId),
      );
    }

    return result;
  }, [contacts, searchTerm, activeView, attributionIds, filters, sharesPhone]);

  // per-node contact counts (descendant-inclusive) for the filter tree badges
  const attributionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of contacts) {
      if (!c.attributionNodeId) continue;
      for (const node of attributionPathNodes(c.attributionNodeId)) {
        counts.set(node.id, (counts.get(node.id) ?? 0) + 1);
      }
    }
    return counts;
  }, [contacts]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-8 py-6">
        <div className="flex items-center mb-4">
          <h2
            className="text-3xl mr-6"
            style={{ fontFamily: "var(--font-sans)", fontWeight: 600 }}
          >
            Contact List
          </h2>
          <p className="text-muted-foreground mt-1">
            {filteredContacts.length} contacts
          </p>
        </div>
        {/* View Chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {VIEW_CHIPS.map((chip) => (
            <button
              key={chip.value}
              onClick={() => setActiveView(chip.value)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border transition-colors ${
                activeView === chip.value
                  ? "bg-primary text-primary-foreground border-primary font-semibold"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
        {/* Search Bar and Actions Inline */}
        <div className="flex items-center gap-4 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-2 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              style={{ height: "38px" }}
            />
          </div>
          <AttributionFilterPopover
            selectedIds={attributionIds}
            onChange={setAttributionIds}
            countsByNodeId={attributionCounts}
            triggerLabel="Attribution"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="px-3 py-1.5 text-sm">
                <Upload className="w-4 h-4 mr-1.5" />
                Import
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setImportSource("csv")}>
                Import from CSV
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setImportSource("bizbuysell")}>
                Import BizBuySell leads
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="default"
            className="px-3 py-1.5 text-sm"
            onClick={() => setAddOpen(true)}
          >
            Add Contact
          </Button>
        </div>

        <ContactsFilterBar
          filters={filters}
          onChange={setFilters}
          companies={companyOptions}
          roles={roleOptions}
          statuses={CONTACT_STATUSES}
          assignees={assigneeOptions}
          identityReviewOptions={[
            { value: "ALL", label: "All contacts" },
            { value: "DUPLICATES", label: "Possible duplicates" },
            { value: "UNIQUE", label: "No duplicate found" },
          ]}
          trafficSources={LEAD_SOURCES.map((s: (typeof LEAD_SOURCES)[number]) => ({
            value: s.id,
            label: s.label,
          }))}
          campaigns={campaigns.map((c) => ({ value: c.id, label: c.name }))}
        />
      </div>

      {/* Contact Table */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className={TH_CLASS} style={TH_STYLE}>Full Name</th>
                <th className={TH_CLASS} style={TH_STYLE}>Role</th>
                <th className={TH_CLASS} style={TH_STYLE}>Companies</th>
                <th className={TH_CLASS} style={TH_STYLE}>Phone</th>
                <th className={TH_CLASS} style={TH_STYLE}>Email</th>
                <th className={TH_CLASS} style={TH_STYLE}>Created at</th>
                <th className={TH_CLASS} style={TH_STYLE}>Assignee</th>
                <th className={TH_CLASS} style={TH_STYLE}>Original Traffic Source</th>
                <th className={TH_CLASS} style={TH_STYLE}>Campaign</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredContacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/crm/contacts/${contact.id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-blue-600">
                      {contact.firstName} {contact.lastName}
                    </div>

                    {contact.optedOut && (
                      <span className="px-2 py-0.5 bg-destructive/10 text-destructive text-xs rounded-full border border-destructive/30">
                        Opted Out
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">{contact.userType}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">
                      {companiesOf(contact).join(", ") || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-blue-600">{contact.phone}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-blue-600">{contact.email}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">
                      {contact.createAt?.toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">
                      {contact.loanOfficer ?? (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <TrafficSourceCell contact={contact} />
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const campaign = resolveCampaign(contact, campaigns);
                      return campaign ? (
                        <span
                          className="text-sm text-blue-600"
                          title={`utm_campaign=${campaign.utmCampaign}`}
                        >
                          {campaign.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {filteredContacts.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <p>No contacts match your filters</p>
            </div>
          )}
        </div>
        </div>
      </div>

      <ContactAddModal
        open={addOpen}
        onOpenChange={setAddOpen}
        assignees={assigneeOptions}
      />
      {importSource && (
        <ContactImportModal
          open
          onOpenChange={(next) => !next && setImportSource(null)}
          source={importSource}
        />
      )}
    </div>
  );
}
