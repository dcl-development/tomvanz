'use client'

import {useMemo, useState} from 'react'
import dynamic from 'next/dynamic'
import {HeaderBar, type LayerFilters} from './HeaderBar'
import {InfoCard} from './InfoCard'
import type {MapData, SelectedItem} from '@/lib/sanity/types'

const MapCanvas = dynamic(() => import('./MapCanvas').then((mod) => mod.MapCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-[14px] text-black/50">
      Loading map
    </div>
  ),
})

type Props = {
  data: MapData
}

const emptyFilters: LayerFilters = {photos: true, tracks: true, pins: true}

export function MapApp({data}: Props) {
  const [filters, setFilters] = useState<LayerFilters>(emptyFilters)
  const [selected, setSelected] = useState<SelectedItem | null>(null)
  const [mapFailed, setMapFailed] = useState(false)

  const visibleCount =
    (filters.photos ? data.photos.length : 0) +
    (filters.tracks ? data.tracks.length : 0) +
    (filters.pins ? data.pins.length : 0)
  const total = data.photos.length + data.tracks.length + data.pins.length

  const selectedStillVisible = useMemo(() => {
    if (!selected) return false
    if (selected.kind === 'photo') return filters.photos && data.photos.some((item) => item._id === selected.id)
    if (selected.kind === 'track') return filters.tracks && data.tracks.some((item) => item._id === selected.id)
    return filters.pins && data.pins.some((item) => item._id === selected.id)
  }, [selected, filters, data])

  const card = selectedStillVisible ? selected : null

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#e8e8e8]">
      <HeaderBar name={data.name} filters={filters} onChange={setFilters} />
      {mapFailed ? (
        <div className="flex h-full items-center justify-center text-[14px] text-black/70">
          Couldn’t load the map.
        </div>
      ) : (
        <MapCanvas
          data={data}
          filters={filters}
          selected={card}
          onSelect={setSelected}
          onMapError={() => setMapFailed(true)}
        />
      )}
      {!mapFailed && total === 0 ? (
        <p className="pointer-events-none absolute left-4 top-16 z-10 text-[14px] text-black/55 md:top-[4.5rem]">
          Nothing mapped yet.
        </p>
      ) : null}
      {!mapFailed && total > 0 && visibleCount === 0 ? (
        <p className="pointer-events-none absolute left-4 top-16 z-10 text-[14px] text-black/55 md:top-[4.5rem]">
          Nothing mapped yet.
        </p>
      ) : null}
      {card ? <InfoCard data={data} selected={card} onClose={() => setSelected(null)} /> : null}
    </div>
  )
}
