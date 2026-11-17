'use client'

import {CatchShape, TrackShape} from './shapes'

export type LayerFilters = {
  tracks: boolean
  pins: boolean
}

type Props = {
  filters: LayerFilters
  onChange: (next: LayerFilters) => void
  threeD: boolean
  onThreeDChange: (next: boolean) => void
}

export function MapLayers({filters, onChange, threeD, onThreeDChange}: Props) {
  return (
    <>
    <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-white/90 px-1 py-1 shadow-sm ring-1 ring-black/10 md:right-4 md:top-4">
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
    <button
      type="button"
      onClick={() => onThreeDChange(!threeD)}
      aria-pressed={threeD}
      aria-label={threeD ? 'Switch to flat map' : 'Switch to 3D terrain'}
      className={`absolute right-3 top-[60px] z-10 flex h-9 min-w-[52px] items-center justify-center rounded-full px-3 text-[13px] font-semibold shadow-sm ring-1 ring-black/10 transition md:right-4 md:top-[68px] ${
        threeD ? 'bg-black text-white' : 'bg-white/90 text-black/70'
      }`}
    >
      3D
    </button>
    </>
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
