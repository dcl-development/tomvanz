# AGENTS.md — tomvanz

Personal site for Tom Vanz (tomvanz.com): MapLibre map of trips, pins and GPX tracks at `/` (and `/map`, which carries shared-link query strings), the Video compressor (Drone) at `/droneclips`, and embedded Sanity Studio at `/studio`.

## Dev framework

This repo follows Jake's dev framework: [jakedcl/dev-framework](https://github.com/jakedcl/dev-framework) (start at its `AGENTS.md`). The framework is the source of truth; if anything in this file conflicts with it, the framework wins.

The framework repo is private. Cloud agents open it with `git clone --depth 1 https://x-access-token:${DEV_FRAMEWORK_READ_TOKEN}@github.com/jakedcl/dev-framework /tmp/dev-framework` (the token is a Cursor secret; never print or commit it).

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

- Sanity reads go through `src/lib/sanity/load.ts`: cached 60s, timeout + one retry, and guarded so a Sanity outage can't break the site (a build with Sanity down still succeeds with an empty map and a notice; a failed refresh keeps the last good homepage). `/` is a pre-built page with `revalidate = 60`. Studio edits show within ~1 min. Don't add uncached or unguarded Sanity fetches to the layout or `/`. Point uptime monitors at `/api/health` (never touches Sanity).

- GPX routes are stored as JSON text, not geopoint arrays.
- Content model: **Photo** (`photo`: image, title, location, note, takenAt, drone, plus a hidden `legacyId`) and **Route** (`track`). There is no separate pin type. `legacyId` holds the id an old pin had before the 2026-11 conversion, so shared links made with it still open the photo (`src/lib/shared-item.ts`).
- Drone photos are detected from `DJI_*` file names (`src/lib/drone.ts`), with a manual override switch in the Studio.
- Studio tools: **Bulk upload** (creates Photos from dropped images, reading GPS and date from the file).
- Track colors come from the activity field: bike blue, hike green.

## Repo facts

- Single Next.js app at the repository root; run all npm commands from `/`.
- Vercel builds a preview for each PR; PRs are squash-merged into `main` (README).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
