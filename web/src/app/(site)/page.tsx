import type {Metadata} from 'next'
import {client} from '@/lib/sanity/client'
import {mapQuery} from '@/lib/sanity/queries'
import {MapApp} from '@/components/MapApp'
import type {MapData} from '@/lib/sanity/types'

export const metadata: Metadata = {
  title: 'Tom Vanz',
}

export const dynamic = 'force-dynamic'

const empty: MapData = {
  name: 'Tom Vanz',
  photos: [],
  tracks: [],
  pins: [],
}

export default async function Home() {
  const data = (await client.fetch(mapQuery)) ?? empty
  return <MapApp data={data} />
}
