# AGENTS.md — tomvanz

Personal site for Tom Vanz (tomvanz.com): map, Drone Clips, and an embedded Sanity Studio.

## Dev framework

This repo follows Jake's dev framework: [jakedcl/dev-framework](https://github.com/jakedcl/dev-framework) (start at its `AGENTS.md`). The framework is the source of truth; if anything in this file conflicts with it, the framework wins.

## Repo facts

- The app lives in `web/`; run everything from there (`cd web && npm install && npm run dev`). App-level rules are in `web/AGENTS.md`.
- Next.js 16.4 App Router, React 19.3, Tailwind 4, MapLibre GL 6 (`web/package.json`).
- Sanity project `lee2r8sa`, dataset `production`. Studio is embedded at `/studio` (`web/sanity.config.ts`).
- Vercel builds a preview for each PR; PRs are squash-merged into `main` (README).
