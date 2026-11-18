import type {Metadata} from 'next'
import {loadMapData} from '@/lib/sanity/load'
import {urlFor} from '@/lib/sanity/image'
import {MapApp} from '@/components/MapApp'
import {first, sharedItem} from '@/lib/shared-item'

type Props = {
  searchParams: Promise<{[key: string]: string | string[] | undefined}>
}

export async function generateMetadata({searchParams}: Props): Promise<Metadata> {
  const params = await searchParams
  if (!first(params.photo) && !first(params.track)) return {title: 'Tom Vanz'}
  const shared = sharedItem((await loadMapData()).data, params)
  if (!shared) return {title: 'Tom Vanz'}
  const image = shared.photo?.asset
    ? urlFor(shared.photo).width(1200).height(630).fit('crop').url()
    : undefined
  return {
    title: `${shared.title} · Tom Vanz`,
    openGraph: {title: shared.title, siteName: 'Tom Vanz', images: image ? [{url: image, width: 1200, height: 630}] : undefined},
    twitter: {card: image ? 'summary_large_image' : 'summary', title: shared.title, images: image ? [image] : undefined},
  }
}

export default async function MapPage({searchParams}: Props) {
  const {data, failed} = await loadMapData()
  const shared = sharedItem(data, await searchParams)
  return <MapApp data={data} initialSelected={shared?.selected ?? null} loadFailed={failed} />
}
