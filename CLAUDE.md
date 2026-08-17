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
- React Hook Form
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
- `src/app/components/ui/` — Shadcn UI primitives (do not modify unless necessary)
- `src/app/components/crm/` — CRM feature components (ContactList, ContactDetail, CompanyList, ListingList, InboxPage, CRMSettings, LeadFormIngest)
- `src/app/components/crm/campaigns/` — Campaigns tab (list, detail, create/edit modal)
- `src/app/data/trafficSources.ts` — closed traffic-source enum + UTM resolver (flat attribution model)
- `src/app/data/campaignUtils.ts` — campaign resolution for a contact, utm key helper
- `src/app/components/applications/` — ApplicationList, BusinessAcquisitionList
- `src/app/components/email-workflows/` — Email workflow feature components
- `src/app/types/index.ts` — shared TypeScript interfaces and view/section union types
- `src/app/data/store.ts` — localStorage-backed data store (source of truth at runtime)
- `src/app/data/*.json` — seed data files: contacts, companies, listings, segments, tasks, taskItems, emailHistory, campaigns, customFieldDefinitions, applications, businessAcquisitions

## Coding Conventions

- Use existing Shadcn UI components from `src/app/components/ui/`. MUI is **not installed** — if a primitive is missing, build it with Tailwind + Radix
- Prefer Tailwind utility classes over inline styles or new CSS files
- No absolute positioning unless strictly necessary; use flex/grid layouts
- Keep components focused; extract helpers/subcomponents to their own files when a file grows large
- TypeScript strict — no `any`, no unused imports (ESLint enforces zero warnings)
- Date format: "Jun 10" style (short month + day)
- Base font-size is 14px
- Forms: React Hook Form for form state; validate per field with inline errors below
  each field; use the Shadcn `<Input>` / `<Select>` / `<Checkbox>` primitives rather
  than building custom ones
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
