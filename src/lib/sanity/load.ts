import {client} from './client'
import {mapQuery} from './queries'
import type {MapData} from './types'

/**
 * How Sanity is read, with guardrails so a Sanity problem can't take the site down:
 *
 *  - Reads are cached for 60 seconds (the pages' own `revalidate` is 60 to match).
 *  - Each read is bounded by a timeout and gets one retry, so a slow Sanity can't hang a page.
 *  - If Sanity can't be reached while the site is being built, the page is still built (with an
 *    empty map and a notice) instead of failing the deploy; it fills in on the next refresh.
 *  - If it can't be reached while an already-built page is being refreshed, the error is
 *    rethrown so Next.js keeps serving the last good copy instead of replacing it with nothing.
 *  - The site name falls back to a default, so the layout never fails.
 */
const REVALIDATE_SECONDS = 60
const ATTEMPT_TIMEOUT_MS = 5000
const ATTEMPTS = 2

const emptyMap: MapData = {name: 'Tom Vanz', tracks: [], pins: []}

const isBuilding = () => process.env.NEXT_PHASE === 'phase-production-build'

async function readSanity<T>(query: string): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    try {
      return await client.fetch<T>(
        query,
        {},
        {next: {revalidate: REVALIDATE_SECONDS}, signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)},
      )
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

export type LoadedMap = {data: MapData; failed: boolean}

/**
 * @param keepLastGood set for pages that are cached and refreshed in the background (the
 * homepage): a failed refresh then throws so the previous good page stays up.
 */
export async function loadMapData({keepLastGood = false}: {keepLastGood?: boolean} = {}): Promise<LoadedMap> {
  try {
    return {data: (await readSanity<MapData | null>(mapQuery)) ?? emptyMap, failed: false}
  } catch (error) {
    console.error('[sanity] map data unavailable:', error)
    if (keepLastGood && !isBuilding()) throw error
    return {data: emptyMap, failed: true}
  }
}

export async function loadSiteName(): Promise<string> {
  try {
    return (
      (await readSanity<string | null>('coalesce(*[_type == "siteSettings"][0].name, "Tom Vanz")')) ??
      'Tom Vanz'
    )
  } catch (error) {
    console.error('[sanity] site name unavailable:', error)
    return 'Tom Vanz'
  }
}
