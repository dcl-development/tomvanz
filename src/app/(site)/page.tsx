import type {Metadata} from 'next'

import {MapApp} from '@/components/MapApp'
import {loadMapData} from '@/lib/sanity/load'

export const metadata: Metadata = {
  title: 'Tom Vanz',
}

// A pre-built page, refreshed in the background at most every 10 minutes. Visits (and uptime
// pings) are served from the cache and don't touch Sanity.
export const revalidate = 600

export default async function Home() {
  return <MapApp data={await loadMapData()} />
}
