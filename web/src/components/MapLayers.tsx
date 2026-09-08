'use client'

import {CatchShape, PhotoShape, TrackShape} from './shapes'

export type LayerFilters = {
  photos: boolean
  tracks: boolean
  pins: boolean
}

type Props = {
  filters: LayerFilters
  onChange: (next: LayerFilters) => void
}

export function MapLayers({filters, onChange}: Props) {
  return (
    <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-white/90 px-1 py-1 shadow-sm ring-1 ring-black/10 md:right-4 md:top-4">
      <FilterChip
        label="Photos"
        active={filters.photos}
        onClick={() => onChange({...filters, photos: !filters.photos})}
      >
        <PhotoShape className="h-3.5 w-3.5" />
      </FilterChip>
      <FilterChip
        label="Tracks"
        active={filters.tracks}
        onClick={() => onChange({...filters, tracks: !filters.tracks})}
      >
        <TrackShape className="h-3.5 w-3.5" />
      </FilterChip>
      <FilterChip
        label="Pins"
        active={filters.pins}
        onClick={() => onChange({...filters, pins: !filters.pins})}
      >
        <CatchShape className="h-3.5 w-3.5" />
      </FilterChip>
    </div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] ${
        active ? 'bg-black text-white' : 'bg-transparent text-black/50'
      }`}
    >
      {children}
      {label}
    </button>
  )
}
