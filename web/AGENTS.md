# tomvanz.com (web/)

Map site for Tom Vanz: `/` is a MapLibre map of trips, pins and GPX tracks; Tom edits in Sanity Studio at `/studio`. The app lives in `web/`; run everything from there.

This Next.js version has breaking changes; check node_modules/next/dist/docs before using APIs.

## Stack (web/package.json)
Next.js 16.3.4 App Router, React 19.2.8, Tailwind 4, maplibre-gl ^6.8, exifr (photo EXIF), Sanity ^6.13 + next-sanity ^13 + @sanity/ui.

## Layout
- `src/app/(site)/` map site; `src/app/studio/` embedded Studio
- `src/components/`, `src/lib/`
- `src/sanity/` schemaTypes, structure
- `scripts/copy-maplibre-worker.mjs` runs before dev and build

## Commands
`cd web && npm install && npm run dev`; `npm run build`; `npm run lint`.

## Content
Sanity project `lee2r8sa`, dataset `production` (hardcoded in sanity.config.ts / sanity.cli.ts). `SANITY_API_READ_TOKEN` is optional. Drafts never show on the map.

## Gotchas
- GPX routes are stored as JSON text, not geopoint arrays.
- "trip" is the current name (formerly "catch"); trip photos are folded into pins (no separate Photos layer).
- The `photo` type is hidden from Studio's "new document" menu on purpose.
- Track colors come from the activity field: bike blue, hike green.
