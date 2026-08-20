# LoanBud Prototype

## Project Overview

LoanBud Prototype — React SPA for loan management.

- Frontend-only (no backend, no DB); all data lives in JSON seed files under `src/app/data/`
- `src/app/data/store.ts` manages reads/writes via `localStorage`, seeded from JSON files on first load
- Figma-originated project: components reflect the design system

## Tech Stack

- React 18 + TypeScript (strict mode)
- Vite 6 (bundler)
- Tailwind CSS 4 + Shadcn/ui (Radix UI primitives)
- React Router 7
- Recharts + D3 (data viz)
- React DnD (drag and drop)
- Sonner (toasts)

## Commands

- `npm run dev` — start dev server at `http://localhost:5173`
- `npm run build` — typecheck (`tsc -b`) then production build
- `npm run typecheck` — TypeScript only
- `npm run lint` — ESLint (zero-warnings policy)
- `npm run test` — Vitest

The app is served at the domain root in every environment (`base: "/"` in
`vite.config.ts`), so the router takes no `basename`. `vercel.json` adds the SPA
rewrite that sends every path to `index.html`.

## Key Source Paths

- `src/app/router.tsx` — route definitions; every screen is lazy-loaded via `lazyRoute`
- `src/app/contexts/useContentLibrary.ts` — templates/scripts/identities/categories domain,
  split out of `AppDataContext` and destructured back in (same `useAppData()` shape)
- `src/app/App.tsx` — root component, layout, nav structure
- `src/app/contexts/AppDataContext.tsx` — shared state and all data mutation handlers
- `src/app/components/ui/` — the Shadcn primitives in use, plus AppHeader / AppSidebar / NotificationPanel / PlaceholderView (do not modify unless necessary)
- `src/app/components/crm/` — CRM feature components (ContactList, ContactDetail, CompanyList, ListingList, InboxPage, CRMSettings, LeadFormIngest)
- `src/app/components/crm/Contact{GeneralInfo,Marketing,InboundDetails}Section.tsx` — the
  contact detail left-column property sections and the form-answers section
- `src/app/components/crm/campaigns/` — Campaigns tab (list, detail, create/edit modal)
- `src/app/data/attribution.ts` — the five contact-attribution dimensions (acquisition origin,
  marketing platform, source organization, intake method, campaign), all frozen when the
  contact is created. Replaced the HubSpot-shaped Original/Latest Traffic Source pair;
  "most recent touch" is a query over `inboundLeadEvents`, not a column
- `src/app/data/metaLeadAds.ts` — Meta Lead Ads adapter: Instant Forms carry no UTM, so
  attribution is derived from Meta's ids. Campaign matching itself lives in
  `campaignUtils.ts` — it was never Meta-specific
- `src/app/data/campaignUtils.ts` — campaign resolution for a contact, plus
  `findCampaignByExternalId`: every channel matches through `Campaign.externalRefs`,
  including the web, whose `utm_campaign` value is stored as a `web` ref. There is no
  `Campaign.utmCampaign` column — it was one more thing an auto-created Meta campaign
  had to invent, and the invented slug collided as soon as two ad campaigns shared a name
- `src/app/data/campaignMetrics.ts` — pure funnel (Leads → Applications → Funded) /
  lead-quality / platform-split maths shared by CampaignList and CampaignDetail. No cost or
  ROI maths: `Campaign.spend` is deprecated and unread
- `src/app/data/customFieldUsage.ts` — custom-field "used in" counting, archive impact,
  grouping/filtering, and the locked System field descriptors. There is no Custom fields
  settings screen: display name and visibility live on the form's field mappings
  (Settings → Lead syncing), which is the only place they were ever set
- `src/app/data/leadQualification.ts` — the four underwriting criteria: parsing what ad
  forms send, OR matching (application **or** lead-declared) for segments, and the
  application-wins precedence rule for display
- `src/app/data/leadFormUtils.ts` — lead-form logic: question text from the platform's
  own key, per-form answer rows, mapping status, cross-form conflict detection, lead
  counts derived from contacts (never stored)
- `src/app/data/inboundLeadEvents.json` — the raw inbox: one row per submission, kept whole,
  carrying the resolution (`matched` / `created` / `skipped`) and its reason. Email is the only
  matching key (HubSpot's rule); a phone number is never one, so no lead ever needs triage —
  there is no unresolved-leads queue by design
- `src/app/data/contactLeadAnswers.ts` + `contactLeadAnswers.json` — a lead's answers,
  one row per contact per question (RFC-013 rev 18). **Not** a `Record<string,string>` on
  the Contact: the segment builder can only filter a real typed column, so `value` backs
  equality and `valueMin`/`valueMax` back ranges — a bucketed answer ("580-639",
  "Under $100k") is a range, not a scalar. `upsertAnswers` updates in place and keeps the
  newest by `answeredAt`, so an out-of-order submission cannot overwrite a later answer and
  a question the newer form skipped keeps its old answer. Full history lives on the event
- `src/app/data/contactDuplicates.ts` — the price of email-only matching: `contactsSharingPhone`
  computes possible duplicates from shared phone numbers. A query, never a stored flag — a flag
  written at ingest goes stale the moment somebody edits a number. Backs the ContactList
  "Identity" filter
- `src/app/data/leadForms.json` / `platformAccounts.json` — the five live LoanBud forms,
  their question → field mappings, and the Meta page they belong to
- `src/app/components/crm/LeadSyncing{Settings,FormPanel}.tsx` — Settings → Lead syncing:
  pages list → page drawer → form field-mapping drawer; counts derived from contacts,
  only timestamps stored
- `src/app/components/email-workflows/segment-builder/fieldConfig.ts` — segment field
  vocabulary; `buildFieldConfig(definitions)` adds every filterable custom field
- `src/app/components/applications/` — ApplicationList, BusinessAcquisitionList
- `src/app/components/email-workflows/` — Email workflow feature components
- `src/app/types/index.ts` — shared TypeScript interfaces and view/section union types
- `src/app/data/store.ts` — localStorage-backed data store (source of truth at runtime)
- `src/app/data/*.json` — seed data files: contacts, companies, listings, segments, tasks, taskItems, emailHistory, campaigns, leadForms, platformAccounts, inboundLeadEvents, contactLeadAnswers, applications, businessAcquisitions

## Coding Conventions

- Use existing Shadcn UI components from `src/app/components/ui/`. Only the primitives
  actually in use are kept in the repo; unreachable ones were removed along with their
  Radix packages. If you need one back, re-add it with `npx shadcn@latest add <name>`
  rather than hand-rolling it. MUI is **not installed**.
- Prefer Tailwind utility classes over inline styles or new CSS files
- No absolute positioning unless strictly necessary; use flex/grid layouts
- Keep components focused; extract helpers/subcomponents to their own files when a file grows large
- TypeScript strict — no `any`, no unused imports (ESLint enforces zero warnings)
- Date format: "Jun 10" style (short month + day)
- Base font-size is 14px
- Forms: plain `useState` per field with inline errors below each field. React Hook Form
  is **not** installed — it was only ever pulled in by an unused Shadcn wrapper. Use the
  Shadcn `<Input>` / `<Select>` / `<Checkbox>` primitives rather than building custom ones
- Local UI state (open/close, hover, active tab) stays in the component — only
  genuinely shared state goes into context

## State Management

- React Context API for shared state (no Redux, no Zustand)
- No backend calls — all data flows from `store.ts` (which seeds from JSON files) or local component state
- `store.ts` exposes typed getters/setters per entity; always go through it rather than importing JSON directly
- All shared state and mutation handlers live in `AppDataContext` (`useAppData()` hook)

## Reference Docs

Detailed reference files are in `.claude/memory/`:
- `project_structure.md` — full route table, component tree, path aliases
- `types_reference.md` — all TypeScript interfaces (Contact, Task, Application, BusinessAcquisitionRecord, etc.)
- `data_layer.md` — store API, AppDataContext handlers, seed files
- `design_system.md` — color tokens, fonts, sidebar theme, Figma design rules
- `tech_stack.md` — package versions, build config
