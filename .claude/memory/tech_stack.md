---
name: LoanBudCRM tech stack and dependencies
description: Framework versions, key packages, build config, and notable dep choices
type: project
---

## Core

- React 18.3.1 + TypeScript (strict mode, no `any`)
- Vite 6.4.2 with `@vitejs/plugin-react` and `@tailwindcss/vite`
- Tailwind CSS 4.1.12

## UI

- Shadcn/ui (Radix UI primitives) in `src/app/components/ui/`
- `lucide-react` 0.487.0 — icon library
- `next-themes` 0.4.6 — theme toggling
- **MUI is not installed.** `@mui/*` and `@emotion/*` were removed as unused — build
  with Tailwind + Radix primitives instead.

## Forms & Validation

- `react-hook-form` 7.55.0

## Data Viz

- `recharts` 2.15.2 (D3 comes in through it) — lazy-loaded, only on the analytics route

## Routing

- `react-router` 7.13.0 — data router with route-level `lazy` code splitting

## Drag & Drop

- `react-dnd` 16.0.1 + `react-dnd-html5-backend`

## Email editor

- `react-email-editor` ^2.0.0 (Unlayer)

## Notifications

- `sonner` 2.0.3

## Dates & Pickers

- `react-day-picker` 8.10.1
- Native `<input type="date">` for simple range filters

## Utilities

- `clsx` 2.1.1, `class-variance-authority` 0.7.1, `tailwind-merge` 3.2.0
- `cmdk` 1.1.1 (command palette), `vaul` 1.1.2 (drawer)
- `react-resizable-panels` 2.1.7, `embla-carousel-react` 8.6.0
- `tw-animate-css` 1.3.8

## Scripts

- `npm run dev` — Vite dev server at `http://localhost:5173`
- `npm run build` — `tsc -b` **then** `vite build` (type errors fail the build)
- `npm run typecheck` — `tsc -b --force`
- `npm run lint` — ESLint, zero-warnings policy
- `npm run test` — Vitest

## Build notes

- Custom Vite plugin `figmaAssetResolver()` handles `figma:asset/*` imports
- `base` is environment-driven: `/` in dev, `/loanbud-prototype/` on `vite build`
  (GitHub Pages). The router mirrors it via `import.meta.env.BASE_URL`.
- `manualChunks` keeps `react` / `react-dom` / `react-router` in a `vendor-react`
  chunk so browsers reuse it across deploys
- TypeScript uses project references (`tsconfig.json` → `tsconfig.node.json`);
  `tsconfig.node.json` must stay `composite: true` or `tsc -b` breaks
- `src/vite-env.d.ts` provides `vite/client` types — without it `import.meta.env`
  is untyped
- ESLint 10.2.0 with typescript-eslint 8.58.2
