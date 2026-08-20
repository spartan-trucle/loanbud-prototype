import { X } from "lucide-react";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

import {
  countActiveFilters,
  EMPTY_CONTACT_FILTERS,
  type ContactFilters,
} from "./contactFilters";

export interface FilterOption {
  value: string;
  label: string;
}

interface ContactsFilterBarProps {
  filters: ContactFilters;
  onChange: (filters: ContactFilters) => void;
  companies: string[];
  roles: string[];
  statuses: string[];
  assignees: string[];
  trafficSources: FilterOption[];
  identityReviewOptions: FilterOption[];
  campaigns: FilterOption[];
}

const DATE_INPUT_CLASS =
  "h-9 rounded-md border border-border bg-input-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function ContactsFilterBar({
  filters,
  onChange,
  companies,
  roles,
  statuses,
  assignees,
  trafficSources,
  identityReviewOptions,
  campaigns,
}: ContactsFilterBarProps) {
  const set = <K extends keyof ContactFilters>(key: K, value: ContactFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const activeCount = countActiveFilters(filters);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect
        label="Company"
        value={filters.company}
        options={companies}
        onChange={(v) => set("company", v)}
      />
      <FilterSelect
        label="Role"
        value={filters.role}
        options={roles}
        onChange={(v) => set("role", v)}
      />
      <FilterSelect
        label="Status"
        value={filters.status}
        options={statuses}
        onChange={(v) => set("status", v)}
      />
      <FilterSelect
        label="Assignee"
        value={filters.assignee}
        options={assignees}
        onChange={(v) => set("assignee", v)}
      />
      <FilterSelect
        label="Traffic source"
        value={filters.trafficSource}
        options={trafficSources}
        onChange={(v) => set("trafficSource", v)}
      />
      <FilterSelect
        label="Campaign"
        value={filters.campaign}
        options={campaigns}
        onChange={(v) => set("campaign", v)}
      />
      <FilterSelect
        label="Identity"
        value={filters.identityReview}
        options={identityReviewOptions}
        onChange={(v) => set("identityReview", v)}
      />

      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">Created</span>
        <input
          type="date"
          aria-label="Created from"
          value={filters.createdFrom}
          onChange={(e) => set("createdFrom", e.target.value)}
          className={DATE_INPUT_CLASS}
        />
        <span className="text-muted-foreground">–</span>
        <input
          type="date"
          aria-label="Created to"
          value={filters.createdTo}
          onChange={(e) => set("createdTo", e.target.value)}
          className={DATE_INPUT_CLASS}
        />
      </div>

      {activeCount > 0 && (
        <Button
          variant="ghost"
          className="h-9 px-2 text-sm text-muted-foreground"
          onClick={() => onChange(EMPTY_CONTACT_FILTERS)}
        >
          <X className="w-4 h-4 mr-1" />
          Clear ({activeCount})
        </Button>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: (string | FilterOption)[];
  onChange: (value: string) => void;
}) {
  const normalised: FilterOption[] = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[160px] text-sm" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">{label}: All</SelectItem>
        {normalised.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
