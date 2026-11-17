import {client} from './client'
import {mapQuery} from './queries'
import type {MapData} from './types'

/**
 * Sanity reads are cached for 10 minutes (the pages' own `revalidate` is 600 to match), so
 * the site, and anything that pings it on a timer, doesn't hit Sanity on every request.
 * Edits in the Studio show up on the site within about ten minutes.
 */
const cached = {next: {revalidate: 600}}

const empty: MapData = {name: 'Tom Vanz', tracks: [], pins: []}

export async function loadMapData(): Promise<MapData> {
  return (await client.fetch(mapQuery, {}, cached)) ?? empty
}

export async function loadSiteName(): Promise<string> {
  return (
    (await client.fetch<string | null>(
      'coalesce(*[_type == "siteSettings"][0].name, "Tom Vanz")',
      {},
      cached,
    )) ?? 'Tom Vanz'
  )
}
