---
name: LoanBudCRM project structure
description: Route table, component tree, path aliases — updated Aug 2026
type: project
---

## Routing

Routes live in `src/app/router.tsx` (not App.tsx). Every screen is **lazy-loaded**
through the local `lazyRoute()` helper; only the layouts are eager.

Base path is environment-driven: `/` in dev, `/loanbud-prototype/` in the GitHub Pages
build. The router reads it back via `import.meta.env.BASE_URL` — never hardcode it.

| Path | Component |
|------|-----------|
| `/` | → redirect to `/applications` |
| `/applications` | `ApplicationList` |
| `/business-acquisition` | `BusinessAcquisitionList` |
| `/users` `/automations` `/questionnaires` `/configurations` | `PlaceholderView` |
| `/crm` | → redirect to `/crm/contacts` (via `CRMLayout`) |
| `/crm/contacts` | `ContactList` |
| `/crm/contacts/:id` | `ContactDetail` |
| `/crm/companies` | `CompanyList` |
| `/crm/listings` | `ListingList` |
| `/crm/campaigns` | `CampaignList` |
| `/crm/campaigns/:id` | `CampaignDetail` |
| `/crm/lead-form` | `LeadFormIngest` |
| `/crm/inbox` | `InboxPage` |
| `/crm/tasks` | `TaskQueue` |
| `/crm/segments` | `UserSegmentsV2` |
| `/crm/segments/:id` | `SegmentDetail` |
| `/crm/segments/builder` | `SegmentBuilderV2` |
| `/crm/workflows` | `WorkflowList` |
| `/crm/workflows/new` `/crm/workflows/:id/edit` | `WorkflowBuilderV2` |
| `/crm/workflows/:id/board` | `WorkflowBoardV2` |
| `/crm/settings` | `CRMSettings` |
| `/email-workflows` | → redirect to `/email-workflows/flows` (via `EmailWorkflowsLayout`) |
| `/email-workflows/flows` | `WorkflowList` |
| `/email-workflows/flows/new` `/flows/:id/edit` | `WorkflowBuilderV2` |
| `/email-workflows/flows/:id/board` | `WorkflowBoardV2` |
| `/email-workflows/flow-builder` | `FlowBuilder` |
| `/email-workflows/user-segments` | `UserSegmentsV2` |
| `/email-workflows/user-segments/:id` | `SegmentDetail` |
| `/email-workflows/user-segments/builder` | `SegmentBuilderV2` |
| `/email-workflows/templates` | `TemplatesView` |
| `/email-workflows/templates/new` `/templates/:id` | `EmailTemplateEditorPage` |
| `/email-workflows/history` | `EmailHistory` |
| `/email-workflows/tasks` | `TaskQueue` |
| `/email-workflows/analytics` | `AnalyticsDashboard` |

There is no V1/V2 toggle — the V2 components are the only implementation.

## Component tree

`src/app/components/` organized by domain:

**`applications/`**
- `ApplicationList.tsx` — loan applications table with stage tabs, search, bulk select
- `BusinessAcquisitionList.tsx` — business acquisition records table with stage tabs

**`crm/`**
- `ContactList.tsx` + `ContactsFilterBar.tsx` + `contactFilters.ts` — list, filter set, filter state
- `ContactAddModal.tsx`, `ContactImportModal.tsx` — create one, or bulk-import CSV / BizBuySell
- `ContactDetail.tsx` — 3-column detail page
- `ContactAttributionBlock.tsx` — traffic source + drill-downs + campaign (attribution source demoted to a system field)
- `ContactQuestionnaireSection.tsx` — renders admin-defined custom fields
- `ContactOfficeAndSegments.tsx`, `ContactCommunicationsTab.tsx`, `ExtraWorkflows.tsx`, `PauseAllCommsModal.tsx`, `AttributionFilterPopover.tsx`
- `CompanyList.tsx`, `ListingList.tsx`, `InboxPage.tsx` (email + SMS conversations)
- `CRMSettings.tsx` + `CrmSettingsSections.tsx` — settings shell and its sections (Lead syncing lives in `LeadSyncingSettings.tsx`; there is no Custom fields screen)
- `LeadFormIngest.tsx` — simulates a marketing form posting into the CRM
- `campaigns/` — `CampaignList`, `CampaignDetail`, `CampaignFormModal`

**`email-workflows/`**
- Top level: `WorkflowList`, `TaskQueue`, `TaskDetailPanel`, `TemplatesView`, `EmailHistory`, `FlowBuilder`, `SegmentDetail`, `WorkflowAnalytics`, `WorkflowContactPanel`, `ContactContextPanel`, `OutcomeCapturePanel`, `StepConfigForm`, `TaskAdvancedFilter`
- Modals: `CreateTaskModal`, `BulkCreateTaskModal`, `TaskActionModal`, `TaskBulkActionModal`, `TaskBulkActionsBar`, `QuickEmailModal`, `CreateSegmentDialog`, `LoGroupsModal`
- `v2/` — `WorkflowBuilderV2`, `WorkflowBoardV2`, `UserSegmentsV2`, `SegmentBuilderV2`, `AnalyticsDashboard` (each a thin `.tsx` re-export of its `.impl.tsx`)
- `segment-builder/`, `settings/` — sub-panels for those two areas

**`ui/`** — Shadcn/Radix primitives (do not modify); custom: `AppSidebar.tsx`, `AppHeader.tsx`, `IconSidebar.tsx`, `NotificationPanel.tsx`, `PlaceholderView.tsx`, `sonner.tsx`, `use-mobile.ts`, `utils.ts`

## Key shared files

- Types: `src/app/types/index.ts`
- Data store: `src/app/data/store.ts`
- App data context: `src/app/contexts/AppDataContext.tsx`
- Content-library domain: `src/app/contexts/useContentLibrary.ts` (templates, folders, voicemail, sender identities, categories — destructured back into the provider so `useAppData()` keeps one shape)
- Attribution model: `src/app/data/trafficSources.ts`, `src/app/data/campaignUtils.ts`, `src/app/data/attributionTaxonomy.ts`
- Navigation config: `src/app/data/navigation.ts`

## Path aliases (vite.config.ts + tsconfig)

- `@` → `src/`
- `@app` → `src/app/`
- `@features` → `src/app/components/`
- `@ui` → `src/app/components/ui/`
- `@types` → `src/app/types/`
- `@data` → `src/app/data/`

**Why:** Figma Make exported a flat scaffold; refactored for scalability.
**How to apply:** New features go in a new domain folder under `src/app/components/`.
Import types from `@app/types`, data from `@data/store`. Never import JSON seed files
directly in components.
