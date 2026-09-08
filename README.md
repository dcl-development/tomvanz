# tomvanz.com

Tom’s map. He adds catch photos, GPX tracks, and pins in Studio. You ship the site.

## Apps

- `web/` — Next.js map on Vercel (`https://tomvanz.vercel.app`)
- `studio/` — Sanity Studio on Vercel (`tomvanz-studio` project)

## Local

```bash
cd web && npm install && npm run dev
cd studio && npm install && npm run dev
```

Studio: http://localhost:3333  
Site: http://localhost:3000

Copy `web/.env.example` to `web/.env.local` and add `SANITY_API_READ_TOKEN` if you want one. Project id and dataset are already public defaults.

## Studio

Custom inputs (GPS warning, GPX parse, map pin) live in `studio/`. Robot tokens cannot publish to sanity.studio, so Studio is also a Vercel app from this repo (`studio/` root). After the first deploy, send Tom that URL and invite him as Editor in [sanity.io/manage](https://www.sanity.io/manage).

To put it on `tomvanz.sanity.studio` later, from `studio/`:

```bash
npx sanity login
npm run deploy
```

## Tom

Invite him as Editor in [sanity.io/manage](https://www.sanity.io/manage). He publishes from Studio. Drafts stay off the map.
