# AGENTS.md — tomvanz

Personal site for Tom Vanz (tomvanz.com): MapLibre map of trips, pins and GPX tracks at `/` and `/map`, Drone Clips at `/droneclips`, and embedded Sanity Studio at `/studio`.

## Dev framework

This repo follows Jake's dev framework: [jakedcl/dev-framework](https://github.com/jakedcl/dev-framework) (start at its `AGENTS.md`). The framework is the source of truth; if anything in this file conflicts with it, the framework wins.

## Stack (`package.json`)

Next.js 16.4 App Router, React 19.3, Tailwind 4, maplibre-gl ^6.15, exifr (photo EXIF), Sanity ^6.20 + next-sanity ^13 + @sanity/ui.

This Next.js version has breaking changes; check `node_modules/next/dist/docs` before using APIs.

## Layout

- `src/app/(site)/` map site; `src/app/studio/` embedded Studio
- `src/components/`, `src/lib/`
- `src/sanity/` schemaTypes, structure
- `scripts/copy-maplibre-worker.mjs` runs before dev and build

## Commands

From the repo root: `npm install && npm run dev`; `npm run build`; `npm run lint`.

## Content

Sanity project `lee2r8sa`, dataset `production` (hardcoded in `sanity.config.ts` / `sanity.cli.ts`). `SANITY_API_READ_TOKEN` is optional. Drafts never show on the map.

## Gotchas

- GPX routes are stored as JSON text, not geopoint arrays.
- "trip" is the current name (formerly "catch"); trip photos are folded into pins (no separate Photos layer).
- The `photo` type is hidden from Studio's "new document" menu on purpose.
- Track colors come from the activity field: bike blue, hike green.

## Repo facts

- Single Next.js app at the repository root; run all npm commands from `/`.
- Vercel builds a preview for each PR; PRs are squash-merged into `main` (README).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
