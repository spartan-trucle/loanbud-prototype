---
name: LoanBudCRM data layer
description: How data is stored, seeded, and accessed at runtime — localStorage + JSON seeds via store.ts and AppDataContext
type: project
---

**Fact:** All runtime data lives in `localStorage`, seeded from JSON files on first
load. There is no backend or API.

`src/app/data/store.ts` is the single source of truth. It exposes a `store` object with
typed read/write methods per entity. Components must go through `store` — never import
JSON files directly.

## Storage keys (namespace `loanbudcrm:`)

Keys carry a version segment. **Bumping the version resets that entity for every
existing user** — do it when a seed change must take effect, not otherwise.

| Key | Type |
|-----|------|
| `loanbudcrm:v5:contacts` | Contact[] |
| `loanbudcrm:v1:companies` | Company[] |
| `loanbudcrm:v1:listings` | ListingRecord[] |
| `loanbudcrm:v1:campaigns` | Campaign[] |
| `loanbudcrm:v1:customFieldDefinitions` | CustomFieldDefinition[] |
| `loanbudcrm:v2:segments` | Segment[] |
| `loanbudcrm:taskItems` · `loanbudcrm:tasks` | TaskItem[] · Task[] |
| `loanbudcrm:v3:emailHistory` | EmailRecord[] |
| `loanbudcrm:v2:contactActivity` | ContactActivityRecord[] |
| `loanbudcrm:v5:workflows` · `loanbudcrm:v5:workflowEnrollments` | Workflow[] · WorkflowEnrollment[] |
| `loanbudcrm:applications` · `loanbudcrm:businessAcquisitions` | Application[] · BusinessAcquisitionRecord[] |
| `loanbudcrm:v6:adminEmailTemplates` · `loanbudcrm:v1:templateFolders` | AdminEmailTemplate[] · TemplateFolder[] |
| `loanbudcrm:v2:smsTemplates` · `loanbudcrm:v2:voicemailScripts` · `loanbudcrm:v2:voicemailSettings` | content library |
| `loanbudcrm:v2:senderIdentities` · `loanbudcrm:v2:smsCategories` · `loanbudcrm:v2:voicemailCategories` | content library |
| `loanbudcrm:notifications` · `loanbudcrm:v2:notificationPrefs` · `loanbudcrm:loGroups` | misc |

## Store API (`store.<entity>.read() / write()`)

Each entity has `read(): T[]` and `write(data: T[]): void`. Date strings are revived
into `Date` objects on read.

`read<T>(key, fallback, dateFields)` takes the raw imported JSON as `fallback` — do
**not** cast seeds to the entity type at the call site. Seeds hold ISO strings where
the type declares `Date`, so a cast would be unsound; `reviveDates` is what makes the
type true.

## Seed data files (`src/app/data/`)

contacts, companies, listings, campaigns, customFieldDefinitions, segments,
emailHistory, contactActivity, tasks, taskItems, workflows, workflowEnrollments,
applications, businessAcquisitions, adminEmailTemplates, templateFolders,
smsTemplates, voicemailScripts, voicemailSettings, senderIdentities, notifications,
loGroups

## Attribution model (flat, HubSpot-style)

- `src/app/data/trafficSources.ts` — the **closed** traffic-source enum (code-owned,
  never editable in the UI), `resolveAttribution(contact)`, and `trafficSourceFromUtm()`
- `src/app/data/campaignUtils.ts` — `resolveCampaignId(contact)`, `contactsInCampaign()`,
  `toUtmKey()`
- Campaigns are their **own object** keyed by `utmCampaign`, not a level in a tree, so
  one campaign spanning several channels stays a single row
- Seeded contacts predate these fields; both resolvers fall back to the legacy
  `attributionNodeId` path in `attributionTaxonomy.ts`, so no seed rewrite was needed

## State management — AppDataContext

`src/app/contexts/AppDataContext.tsx` holds shared state. The content-library domain
(templates, folders, voicemail, sender identities, categories) lives in
`src/app/contexts/useContentLibrary.ts` and is **destructured back into the provider**,
so `useAppData()` exposes one flat shape regardless.

**Data:** `contacts`, `companies`, `listings`, `campaigns`, `customFieldDefinitions`,
`segments`, `emailHistory`, `contactActivity`, `tasks`, `taskItems`, `workflows`,
`workflowEnrollments`, `applications`, `businessAcquisitions`, plus the content library

**Contacts:** `handleUpdateContact`, `handleCreateContact`, `handleImportContacts(rows, source)`
(dedupes on email; `source` is `"csv"` or `"bizbuysell"`)

**Campaigns:** `handleCreateCampaign` (fills `utmCampaign` from the name when blank),
`handleUpdateCampaign`, `handleDeleteCampaign` (detaches contacts rather than deleting them)

**Custom fields:** `handleCreateCustomField`, `handleUpdateCustomField`, `handleDeleteCustomField`

**Lead ingest:** `handleIngestLeadForm(payload)` — resolves the traffic source from UTM,
finds-or-creates the campaign, and auto-discovers unknown answer keys as **hidden**
field definitions. Returns `LeadIngestResult`.

**Tasks / workflows / segments / notifications:** the remaining `handle*` families.

**Hook:** `useAppData()` — throws if used outside `AppDataProvider`.

**Why:** Frontend-only prototype; localStorage gives persistence across reloads
without a backend.
**How to apply:** When adding an entity — add a key to `KEYS`, add a read/write pair,
add a JSON seed, add state + handlers to `AppDataContext` (or a domain hook if the
slice is self-contained). Never use local component state for data that must persist.
