# LoanBud Prototype

React SPA prototype for the LoanBud feature demo. Frontend only — no backend, no
database; all data is seeded from JSON into `localStorage`.

## Getting Started

```bash
npm i             # install dependencies
npm run dev       # dev server at http://localhost:5173
npm run build     # typecheck (tsc -b) then production build
npm run typecheck # TypeScript only
npm run lint      # ESLint (zero-warnings policy)
npm run test      # Vitest
```

`npm run build` type-checks first, so type errors fail the build rather than shipping.

The base path is environment-driven: `/` in dev, `/loanbud-prototype/` in the GitHub
Pages build. The router mirrors it via `import.meta.env.BASE_URL` — don't hardcode it.

## Tech Stack

- **React 18** + **TypeScript** (strict mode)
- **Vite 6** — bundler, route-level code splitting
- **Tailwind CSS 4** + **Shadcn/ui** (Radix UI primitives)
- **React Router 7** — data router with lazy routes
- **React Hook Form** — form state
- **Recharts** — data visualisations (lazy, analytics route only)
- **React DnD** — drag and drop
- **Sonner** — toast notifications

MUI is intentionally not installed — build with Tailwind + Radix instead.

## Project Structure

```
src/
  main.tsx                         # Entry: AppDataProvider + RouterProvider
  app/
    router.tsx                     # Route definitions, all screens lazy-loaded
    types/index.ts                 # Shared TypeScript interfaces
    contexts/
      AppDataContext.tsx           # Shared state and mutation handlers
      useContentLibrary.ts         # Templates / voicemail / identities domain
    data/
      store.ts                     # localStorage-backed store (runtime source of truth)
      trafficSources.ts            # Closed traffic-source enum + UTM resolver
      campaignUtils.ts             # Campaign resolution for a contact
      *.json                       # Seed data per entity
    components/
      ui/                          # Shadcn UI primitives (avoid modifying)
      crm/                         # Contacts, companies, listings, inbox, settings
      crm/campaigns/               # Campaigns tab
      applications/                # Loan applications, business acquisition
      email-workflows/             # Workflows, segments, templates, tasks
  styles/
    theme.css                      # Design tokens (colors, typography)
    fonts.css                      # Font imports
```

## Features

**CRM** — Contacts (filterable list, import from CSV/BizBuySell, 3-column detail),
Companies, Listings, Inbox (email + SMS conversations), Tasks, Segments, Workflows,
Settings.

**Attribution** — Original Traffic Source with two drill-downs, plus **Campaigns** as
a first-class object keyed by `utm_campaign`. Attribution Source is kept as a system
field (it identifies the originating system and gates record ownership), not a
marketing field.

**Custom fields** — Define fields in Settings and they render on the contact tab.
Fields arriving from a new marketing form are auto-discovered and stay hidden until
an admin turns them on, so a new form needs no engineering work.

**Lead form ingest** (`/crm/lead-form`) — simulates a marketing form posting into the
CRM, showing how the traffic source, campaign, and questionnaire answers are resolved.

**Email workflows** — Workflow list and builder, board view, segments and segment
builder, email/SMS/voicemail templates, send history, analytics.

## Data & State

All data is client-side. `store.ts` seeds `localStorage` from JSON on first load and
exposes typed read/write per entity — never import JSON seed files directly in
components. Shared state and mutation handlers live in `AppDataContext`
(`useAppData()`); local UI state stays in the component.
