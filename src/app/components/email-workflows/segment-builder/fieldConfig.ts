import type {
  CustomFieldDefinition,
  FilterFieldV2,
  FilterOperatorV2,
} from "@/app/types";
import { filterableFields } from "@/app/data/customFieldUsage";
import type { FieldPickerItem } from "./FilterFieldPicker";

// ─── Field config ─────────────────────────────────────────────────────────────

export interface FieldConfig {
  label: string;
  description: string;
  category: string;
  subCategory?: string;
  type: "select" | "boolean" | "workflow" | "date" | "text" | "number";
  operators: FilterOperatorV2[];
  options?: string[];
}

export const CORE_FIELD_CONFIG: Record<string, FieldConfig> = {
  firstName: {
    label: "First Name",
    description: "The contact's first name",
    category: "Properties",
    subCategory: "Contact Info",
    type: "text",
    operators: ["contains", "not_contains", "=", "!="],
  },
  lastName: {
    label: "Last Name",
    description: "The contact's last name",
    category: "Properties",
    subCategory: "Contact Info",
    type: "text",
    operators: ["contains", "not_contains", "=", "!="],
  },
  email: {
    label: "Email",
    description: "The contact's email address",
    category: "Properties",
    subCategory: "Contact Info",
    type: "text",
    operators: ["contains", "not_contains", "=", "!="],
  },
  phone: {
    label: "Phone",
    description: "The contact's phone number",
    category: "Properties",
    subCategory: "Contact Info",
    type: "text",
    operators: ["contains", "not_contains", "=", "!="],
  },
  userType: {
    label: "User Type",
    description: "Role of the contact in the lending network",
    category: "Properties",
    subCategory: "Contact Info",
    type: "select",
    operators: ["=", "!="],
    options: ["Broker", "Lender", "Partner"],
  },
  brokerageName: {
    label: "Brokerage Name",
    description: "Brokerage organization the contact is affiliated with",
    category: "Properties",
    subCategory: "Contact Info",
    type: "text",
    operators: ["contains", "not_contains", "=", "!="],
  },
  listingStatus: {
    label: "Listing Status",
    description: "Current processing stage of the loan application",
    category: "Properties",
    subCategory: "Application",
    type: "select",
    operators: ["=", "!="],
    options: ["New", "Draft", "Submitted", "On Hold", "Declined"],
  },
  listingName: {
    label: "Listing Name",
    description: "Name or title of the loan listing",
    category: "Properties",
    subCategory: "Application",
    type: "text",
    operators: ["contains", "not_contains", "=", "!="],
  },
  createAt: {
    label: "Created Date",
    description: "Date the contact record was created",
    category: "Properties",
    subCategory: "Application",
    type: "date",
    operators: ["before", "after", "within_last_n_days"],
  },
  openReminders: {
    label: "Open Reminders",
    description: "Number of open reminder tasks for this contact",
    category: "Properties",
    subCategory: "Application",
    type: "number",
    operators: ["=", "!=", ">", "<", ">=", "<="],
  },
  optedOut: {
    label: "Opted Out",
    description: "Whether the contact has opted out of email communications",
    category: "Activity",
    type: "boolean",
    operators: ["is true", "is false"],
  },
  lastContacted: {
    label: "Last Contacted",
    description: "Date this contact was last reached out to",
    category: "Activity",
    type: "date",
    operators: ["before", "after", "within_last_n_days"],
  },
  // The four underwriting criteria. Each matches an application value OR the
  // lead's own answer from an ad form — see matchesQualificationRule.
  self_reported_fico: {
    label: "FICO Score",
    description:
      "Credit score from the application, or the band the lead selected on an ad form",
    category: "Properties",
    subCategory: "Qualification",
    type: "number",
    operators: [">=", "<=", ">", "<", "=", "!="],
  },
  funding_purpose: {
    label: "Funding Purpose",
    description:
      "What the money is for, from the application or the lead's own answer",
    category: "Properties",
    subCategory: "Qualification",
    type: "select",
    operators: ["=", "!=", "contains", "not_contains"],
    options: [
      "Working capital",
      "Equipment",
      "Acquisition",
      "Refinance",
      "Real estate",
    ],
  },
  requested_amount: {
    label: "Requested Amount",
    description:
      "Loan amount requested on the application, or the amount the lead asked for",
    category: "Properties",
    subCategory: "Qualification",
    type: "number",
    operators: [">=", "<=", ">", "<", "=", "!="],
  },
  funding_timeline: {
    label: "Funding Timeline",
    description: "How soon the money is needed, from either source",
    category: "Properties",
    subCategory: "Qualification",
    type: "select",
    operators: ["=", "!="],
    options: ["Immediately", "2 – 4 weeks", "4 weeks+"],
  },
  hasActiveEnrollment: {
    label: "Has Active Enrollment",
    description: "Whether the contact is enrolled in any active workflow",
    category: "Membership",
    type: "boolean",
    operators: ["is true", "is false"],
  },
  enrolledInWorkflow: {
    label: "Enrolled in Workflow",
    description: "The specific workflow the contact is enrolled in",
    category: "Membership",
    type: "workflow",
    operators: ["=", "!="],
  },
};

export const OPERATOR_LABELS: Partial<Record<FilterOperatorV2, string>> = {
  "=": "equals",
  "!=": "not equals",
  "contains": "contains",
  "not_contains": "not contains",
  "is true": "is true",
  "is false": "is false",
  "before": "before",
  "after": "after",
  "within_last_n_days": "within last N days",
  ">": "greater than",
  "<": "less than",
  ">=": "at least",
  "<=": "at most",
};

const CORE_FIELDS: FilterFieldV2[] = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "userType",
  "brokerageName",
  "listingStatus",
  "listingName",
  "createAt",
  "openReminders",
  "self_reported_fico",
  "funding_purpose",
  "requested_amount",
  "funding_timeline",
  "optedOut",
  "lastContacted",
  "hasActiveEnrollment",
  "enrolledInWorkflow",
];

/**
 * Operators a custom field can be filtered with, chosen from its type.
 *
 * A number field offered `contains` would be nonsense, and a date field offered
 * `=` would almost never match. The type already says which comparisons mean
 * something, so it picks them.
 */
const OPERATORS_BY_TYPE: Record<CustomFieldDefinition["type"], FilterOperatorV2[]> = {
  text: ["contains", "not_contains", "=", "!="],
  number: [">=", "<=", ">", "<", "=", "!="],
  date: ["before", "after"],
  select: ["=", "!="],
};

/**
 * A filterable custom field, as a segment field.
 *
 * This function is why the "Filterable" switch means anything. Before it existed the
 * switch wrote a boolean nothing read: an admin turned it on, went to the segment
 * builder, and the field was not there.
 */
export function customFieldConfig(definition: CustomFieldDefinition): FieldConfig {
  return {
    label: definition.label,
    description:
      definition.description ??
      `Custom field answered on a form (${definition.key})`,
    category: "Properties",
    subCategory: definition.section || "Custom fields",
    type: definition.type,
    operators: OPERATORS_BY_TYPE[definition.type],
    options: definition.type === "select" ? definition.options : undefined,
  };
}

/** Core fields plus every filterable custom field, keyed by field id. */
export function buildFieldConfig(
  definitions: CustomFieldDefinition[] = [],
): Record<string, FieldConfig> {
  const config: Record<string, FieldConfig> = { ...CORE_FIELD_CONFIG };
  for (const definition of filterableFields(definitions)) {
    // Four custom fields share a key with an underwriting criterion — the ad form
    // writes both. The core entry wins there: it matches the application *and* the
    // lead's own answer, and it compares numbers instead of band labels.
    if (config[definition.key]) continue;
    // Otherwise the field's own key is its filter id, so a saved segment keeps
    // working even if the field is later renamed.
    config[definition.key] = customFieldConfig(definition);
  }
  return config;
}

export function buildAllFields(
  definitions: CustomFieldDefinition[] = [],
): FilterFieldV2[] {
  const extra = filterableFields(definitions)
    .map((f) => f.key)
    .filter((key) => !CORE_FIELD_CONFIG[key]);
  return [...CORE_FIELDS, ...extra];
}

const FALLBACK_CONFIG: FieldConfig = {
  label: "Unknown field",
  description: "This field is no longer available",
  category: "Properties",
  type: "text",
  operators: ["=", "!="],
};

/** Never throws on a field id that has since been archived or renamed away. */
export function fieldConfigFor(
  field: string,
  config: Record<string, FieldConfig> = CORE_FIELD_CONFIG,
): FieldConfig {
  return config[field] ?? FALLBACK_CONFIG;
}

export function buildFieldPickerItems(
  definitions: CustomFieldDefinition[] = [],
): FieldPickerItem<FilterFieldV2>[] {
  const config = buildFieldConfig(definitions);
  return buildAllFields(definitions).map((f) => {
    const cfg = fieldConfigFor(f, config);
    return {
      field: f,
      label: cfg.label,
      description: cfg.description,
      category: cfg.category,
      subCategory: cfg.subCategory,
      fieldType: cfg.type,
      options: cfg.options,
    };
  });
}

export function defaultValueForField(
  field: FilterFieldV2,
  config: Record<string, FieldConfig> = CORE_FIELD_CONFIG,
): string {
  const cfg = fieldConfigFor(field, config);
  if (cfg.type === "boolean") return "";
  if (cfg.type === "select" && cfg.options?.length) return cfg.options[0];
  if (cfg.type === "number") return "0";
  return "";
}

export function defaultOperatorForField(
  field: FilterFieldV2,
  config: Record<string, FieldConfig> = CORE_FIELD_CONFIG,
): FilterOperatorV2 {
  return fieldConfigFor(field, config).operators[0];
}
