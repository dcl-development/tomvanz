#!/usr/bin/env node --experimental-strip-types
/**
 * Backfill displayCoordinates + distanceMeters on published tracks from route.coordinates.
 *
 *   node --experimental-strip-types scripts/backfill-route-display.mjs --dry-run
 *   SANITY_API_WRITE_TOKEN=... node --experimental-strip-types scripts/backfill-route-display.mjs
 */

import {createClient} from '@sanity/client'
import {prepareRouteDisplayFields} from '../src/lib/simplify-route.ts'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? 'lee2r8sa'
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
const apiVersion = '2026-01-01'
const dryRun = process.argv.includes('--dry-run')
const writeToken = process.env.SANITY_API_WRITE_TOKEN ?? process.env.SANITY_AUTH_TOKEN

const query = `*[_type == "track" && defined(route.coordinates) && !(_id in path("drafts.**"))] | order(title asc) {
  _id,
  title,
  displayCoordinates,
  distanceMeters,
  "dense": route.coordinates
}`

function parseCoords(value) {
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((p) => (Array.isArray(p) && p.length >= 2 ? [Number(p[0]), Number(p[1])] : null))
      .filter((p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1]))
  } catch {
    return []
  }
}

async function fetchRoutes(client) {
  return client.fetch(query)
}

/** Match `trackMiles` / `lineMiles` when only dense coords exist. */
function lineMilesFromCoords(coords) {
  const EARTH_MI = 3958.8
  const toRad = (d) => (d * Math.PI) / 180
  const hDist = (a, b) => {
    const dLat = toRad(b[1] - a[1])
    const dLng = toRad(b[0] - a[0])
    const lat1 = toRad(a[1])
    const lat2 = toRad(b[1])
    const h =
      Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
    return 2 * EARTH_MI * Math.asin(Math.min(1, Math.sqrt(h)))
  }
  if (coords.length < 2) return null
  let miles = 0
  for (let i = 1; i < coords.length; i += 1) miles += hDist(coords[i - 1], coords[i])
  if (miles < 0.05) return null
  return miles
}

async function main() {
  const client = createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: !writeToken,
    token: writeToken,
  })

  const docs = await fetchRoutes(client)
  if (docs.length === 0) {
    console.log('No published tracks with route.coordinates.')
    return
  }

  const rows = docs.map((doc) => {
    const denseCoords = parseCoords(doc.dense)
    const {displayCoordinates, distanceMeters} = prepareRouteDisplayFields(denseCoords)
    const densePoints = denseCoords.length
    const denseBytes = typeof doc.dense === 'string' ? Buffer.byteLength(doc.dense, 'utf8') : 0
    const displayPoints = JSON.parse(displayCoordinates).length
    const displayBytes = Buffer.byteLength(displayCoordinates, 'utf8')
    const milesToday = lineMilesFromCoords(denseCoords)
    const milesStored = distanceMeters / 1609.344

    return {
      id: doc._id,
      title: doc.title ?? doc._id,
      densePoints,
      denseBytes,
      displayPoints,
      displayBytes,
      distanceMeters,
      displayCoordinates,
      milesToday: milesToday != null ? milesToday.toFixed(3) : '—',
      milesStored: milesStored.toFixed(3),
    }
  })

  console.log(dryRun ? 'DRY RUN — no writes\n' : 'LIVE — will patch documents\n')
  console.log(
    [
      'Title'.padEnd(28),
      'Pts before',
      'Bytes before',
      'Pts after',
      'Bytes after',
      'Distance m',
      'Mi today',
      'Mi stored',
    ].join('  '),
  )
  console.log('-'.repeat(120))

  for (const row of rows) {
    console.log(
      [
        row.title.slice(0, 28).padEnd(28),
        String(row.densePoints).padStart(10),
        String(row.denseBytes).padStart(12),
        String(row.displayPoints).padStart(9),
        String(row.displayBytes).padStart(11),
        String(row.distanceMeters).padStart(10),
        String(row.milesToday).padStart(9),
        String(row.milesStored).padStart(9),
      ].join('  '),
    )
  }

  const totalDense = rows.reduce((n, r) => n + r.denseBytes, 0)
  const totalDisplay = rows.reduce((n, r) => n + r.displayBytes, 0)
  console.log('-'.repeat(120))
  console.log(
    `Total coordinate JSON: ${(totalDense / 1024 / 1024).toFixed(2)} MB → ${(totalDisplay / 1024).toFixed(1)} KB (${rows.length} routes)`,
  )

  if (dryRun) {
    console.log('\nDry run complete. Omit --dry-run and set SANITY_API_WRITE_TOKEN to patch.')
    return
  }

  if (!writeToken) {
    console.error('\nMissing SANITY_API_WRITE_TOKEN (or SANITY_AUTH_TOKEN).')
    process.exit(1)
  }

  for (const row of rows) {
    await client
      .patch(row.id)
      .set({
        displayCoordinates: row.displayCoordinates,
        distanceMeters: row.distanceMeters,
      })
      .commit()
    console.log(`Patched ${row.title}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})