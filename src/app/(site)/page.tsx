import type {Metadata} from 'next'

import {MapApp} from '@/components/MapApp'
import {loadMapData} from '@/lib/sanity/load'

export const metadata: Metadata = {
  title: 'Tom Vanz',
}

// A pre-built page, refreshed in the background at most once a minute. Visits (and uptime
// pings) are served from the cache. If Sanity is down during a refresh, the last good page
// keeps being served.
export const revalidate = 60

export default async function Home() {
  const {data, failed} = await loadMapData({keepLastGood: true})
  return <MapApp data={data} loadFailed={failed} />
}
