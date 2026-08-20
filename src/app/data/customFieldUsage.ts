import type {
  ContactLeadAnswer,
  Contact,
  CustomFieldDefinition,
  CustomFieldType,
  LeadFormDefinition,
  Segment,
} from "../types";

/**
 * What a custom field is worth, and what breaks if it goes away.
 *
 * Pure functions only — no components — so the settings screen and the segment
 * builder can both import from here under the repo's react-refresh rule.
 *
 * The whole point of this file is the usage count. An admin looking at a field named
 * `heard_about_us` cannot tell from the row whether archiving it costs nothing or
 * silently breaks two live lead forms and a segment. Counting the references answers
 * that from data the CRM already holds.
 */

/** An active field is one that has not been archived. */
export function isActiveField(field: CustomFieldDefinition): boolean {
  return !field.archivedAt;
}

export function activeFields(
  fields: CustomFieldDefinition[],
): CustomFieldDefinition[] {
  return fields.filter(isActiveField);
}

export function archivedFields(
  fields: CustomFieldDefinition[],
): CustomFieldDefinition[] {
  return fields.filter((field) => Boolean(field.archivedAt));
}

/** Fields the contact tab should render: active, visible, in that order. */
export function displayableFields(
  fields: CustomFieldDefinition[],
): CustomFieldDefinition[] {
  return fields.filter((field) => isActiveField(field) && field.isVisible);
}

/** Fields the segment builder should offer. Both switches, and not archived. */
export function filterableFields(
  fields: CustomFieldDefinition[],
): CustomFieldDefinition[] {
  return fields.filter(
    (field) => isActiveField(field) && field.isVisible && field.isFilterable,
  );
}

// ── System fields ────────────────────────────────────────────────────────────

/**
 * Real columns on the contact record that look like custom fields to an admin.
 *
 * They are listed on the settings screen — locked — because the alternative is
 * worse: an admin who cannot find "FICO" here concludes it does not exist and
 * creates a second one, and from then on half the answers land in each.
 */
export interface SystemFieldDescriptor {
  key: string;
  label: string;
  type: CustomFieldType;
  description: string;
}

export const SYSTEM_FIELD_GROUP = "System";

export const SYSTEM_FIELDS: SystemFieldDescriptor[] = [
  {
    key: "leadFicoMin",
    label: "Lead FICO — low end",
    type: "number",
    description:
      "Bottom of the credit band the lead selected on an ad form. Written by lead ingest, not editable here.",
  },
  {
    key: "leadFicoMax",
    label: "Lead FICO — high end",
    type: "number",
    description:
      "Top of the credit band the lead selected on an ad form. Written by lead ingest, not editable here.",
  },
  {
    key: "leadFundingPurpose",
    label: "Lead funding purpose",
    type: "text",
    description:
      "What the lead said the money is for. The verified purpose lives on the application.",
  },
  {
    key: "leadRequestedAmount",
    label: "Lead requested amount",
    type: "number",
    description:
      "Amount the lead asked for, parsed to a number. The verified amount lives on the application.",
  },
  {
    key: "timeFrame",
    label: "Funding timeline",
    type: "text",
    description:
      "How soon the lead says they need the money. Shared with the application's own timeline column.",
  },
];

// ── Usage ────────────────────────────────────────────────────────────────────

/** One thing that points at a field, named rather than just counted. */
export interface UsageReference {
  kind: "lead-form" | "segment" | "contact";
  /** Name to show — form name, segment name, or a contact count summary. */
  name: string;
  id: string;
}

export interface FieldUsage {
  leadForms: UsageReference[];
  segments: UsageReference[];
  /** How many contacts hold a value under this key. */
  contactCount: number;
  /** Lead forms + segments + (contacts as one) — the number on the row. */
  total: number;
}

/** Does a segment reference this key anywhere in its include or exclude filters? */
function segmentUsesKey(segment: Segment, key: string): boolean {
  const all = [...segment.filters, ...(segment.excludeFilters ?? [])];
  return all.some((rule) => rule.field === key);
}

/**
 * Everywhere one field is referenced.
 *
 * Contacts are counted rather than listed: at 26 contacts a list is fine, at 26,000
 * it is not, and the number is what drives the decision either way. Forms and
 * segments are listed by name, because "two lead forms" is not enough to act on —
 * you need to know it is the two that are live.
 */
export function fieldUsage(
  field: Pick<CustomFieldDefinition, "key">,
  leadForms: LeadFormDefinition[],
  segments: Segment[],
  contacts: Contact[],
  leadAnswers: ContactLeadAnswer[],
): FieldUsage {
  const forms = leadForms
    .filter((form) =>
      form.fieldMappings.some(
        (mapping) =>
          mapping.targetKind === "custom" && mapping.targetKey === field.key,
      ),
    )
    .map((form) => ({ kind: "lead-form" as const, name: form.name, id: form.id }));

  const matchedSegments = segments
    .filter((segment) => segmentUsesKey(segment, field.key))
    .map((segment) => ({
      kind: "segment" as const,
      name: segment.name,
      id: segment.id,
    }));

  const answeredContactIds = new Set(
    leadAnswers.filter((a) => a.targetKey === field.key && a.value.trim() !== "").map((a) => a.contactId),
  );
  const contactCount = contacts.filter((contact) => answeredContactIds.has(contact.id)).length;

  return {
    leadForms: forms,
    segments: matchedSegments,
    contactCount,
    total: forms.length + matchedSegments.length + (contactCount > 0 ? 1 : 0),
  };
}

/** Usage for every field in one pass over the sources. */
export function usageByField(
  fields: CustomFieldDefinition[],
  leadForms: LeadFormDefinition[],
  segments: Segment[],
  contacts: Contact[],
  leadAnswers: ContactLeadAnswer[],
): Map<string, FieldUsage> {
  return new Map(
    fields.map((field) => [
      field.id,
      fieldUsage(field, leadForms, segments, contacts, leadAnswers),
    ]),
  );
}

/**
 * A field worth deleting: nothing references it, and no form invented it.
 *
 * Auto-discovered fields are excluded even at zero usage — one arrived because a
 * form posted a key nobody registered, so it is a question waiting for an admin, not
 * a leftover.
 */
export function isUnused(
  field: CustomFieldDefinition,
  usage: FieldUsage | undefined,
): boolean {
  if (field.isAutoDiscovered) return false;
  return !usage || usage.total === 0;
}

/** Plain-language summary of what archiving this field would affect. */
export function archiveImpact(usage: FieldUsage): string[] {
  const lines: string[] = [];
  for (const form of usage.leadForms) {
    lines.push(`Lead form "${form.name}" maps a question to this field`);
  }
  for (const segment of usage.segments) {
    lines.push(`Segment "${segment.name}" filters on this field`);
  }
  if (usage.contactCount > 0) {
    lines.push(
      `${usage.contactCount} contact${usage.contactCount === 1 ? " holds" : "s hold"} an answer under this key`,
    );
  }
  return lines;
}

// ── Grouping and filtering the table ─────────────────────────────────────────

export interface FieldGroup {
  section: string;
  fields: CustomFieldDefinition[];
}

/** Fields bucketed by their group, groups in alphabetical order. */
export function groupFields(fields: CustomFieldDefinition[]): FieldGroup[] {
  const groups = new Map<string, CustomFieldDefinition[]>();
  for (const field of fields) {
    const section = field.section || "Ungrouped";
    const existing = groups.get(section);
    if (existing) existing.push(field);
    else groups.set(section, [field]);
  }

  return [...groups.entries()]
    .map(([section, list]) => ({ section, fields: list }))
    .sort((a, b) => a.section.localeCompare(b.section));
}

/** Every distinct group name in use, for the group picker. */
export function fieldGroupNames(fields: CustomFieldDefinition[]): string[] {
  return [...new Set(fields.map((f) => f.section || "Ungrouped"))].sort();
}

export type VisibilityFilter = "all" | "visible" | "hidden";
export type OriginFilter = "all" | "auto" | "manual";
export type UsageFilter = "all" | "used" | "unused";

export interface FieldFilters {
  search: string;
  type: CustomFieldType | "all";
  visibility: VisibilityFilter;
  origin: OriginFilter;
  usage: UsageFilter;
}

export const EMPTY_FIELD_FILTERS: FieldFilters = {
  search: "",
  type: "all",
  visibility: "all",
  origin: "all",
  usage: "all",
};

/**
 * Search matches the label *and* the key.
 *
 * The key matters more than it looks: when a form sends `heard_about_us` and the
 * answer does not show up, the admin is holding the key, not the label.
 */
export function matchesFieldFilters(
  field: CustomFieldDefinition,
  filters: FieldFilters,
  usage: FieldUsage | undefined,
): boolean {
  const term = filters.search.trim().toLowerCase();
  if (
    term &&
    !field.label.toLowerCase().includes(term) &&
    !field.key.toLowerCase().includes(term)
  ) {
    return false;
  }

  if (filters.type !== "all" && field.type !== filters.type) return false;

  if (filters.visibility === "visible" && !field.isVisible) return false;
  if (filters.visibility === "hidden" && field.isVisible) return false;

  if (filters.origin === "auto" && !field.isAutoDiscovered) return false;
  if (filters.origin === "manual" && field.isAutoDiscovered) return false;

  const used = (usage?.total ?? 0) > 0;
  if (filters.usage === "used" && !used) return false;
  if (filters.usage === "unused" && used) return false;

  return true;
}

/** Turns a label into the stable key that forms post. */
export function toFieldKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Whether a key can be used for a new field.
 *
 * Archived fields still own their key — their answers are still stored under it, so
 * reusing it would merge two different questions' answers into one column.
 */
export function isKeyAvailable(
  key: string,
  fields: CustomFieldDefinition[],
  ignoreId?: string,
): boolean {
  if (!key) return false;
  if (SYSTEM_FIELDS.some((f) => f.key === key)) return false;
  return !fields.some((field) => field.key === key && field.id !== ignoreId);
}
