# ui-prototype

Frontend design prototype for nutrilens — dashboard, meal logging, diet plan,
and progress views, built with hardcoded mock data.

**No backend.** Every value comes from `src/data/mockData.ts`; the AI photo
analysis on the log-meal screen is simulated with a `setTimeout` delay, not a
real call to `apps/ai-server`. This prototype exists to validate the UI flows
described in `../organizational/` before `apps/api` and `apps/ai-server` are
built (see `../organizational/adr/0001-two-server-split.md`).

## Stack

React + TypeScript + Vite + Tailwind CSS v4.

## Development

```bash
npm install
npm run dev      # dev server
npm run build    # production build (tsc -b && vite build)
npm run lint      # oxlint
```
