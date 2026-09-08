'use client'

import {CatchShape, PhotoShape, TrackShape} from './shapes'

export type LayerFilters = {
  photos: boolean
  tracks: boolean
  pins: boolean
}

type Props = {
  name: string
  filters: LayerFilters
  onChange: (next: LayerFilters) => void
}

export function HeaderBar({name, filters, onChange}: Props) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-black/10 bg-white px-4 md:h-14 md:px-5">
      <h1 className="min-w-0 truncate text-[18px] font-normal tracking-tight text-black md:text-[20px]">
        {name}
      </h1>
      <nav aria-label="Layers" className="flex shrink-0 items-center">
        <FilterLink
          label="Photos"
          active={filters.photos}
          onClick={() => onChange({...filters, photos: !filters.photos})}
        >
          <PhotoShape className="h-3.5 w-3.5" />
        </FilterLink>
        <FilterLink
          label="Tracks"
          active={filters.tracks}
          onClick={() => onChange({...filters, tracks: !filters.tracks})}
        >
          <TrackShape className="h-3.5 w-3.5" />
        </FilterLink>
        <FilterLink
          label="Pins"
          active={filters.pins}
          onClick={() => onChange({...filters, pins: !filters.pins})}
        >
          <CatchShape className="h-3.5 w-3.5" />
        </FilterLink>
      </nav>
    </header>
  )
}

function FilterLink({
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
      className={`flex items-center gap-1.5 px-2.5 py-2 text-[13px] md:px-3 ${
        active ? 'text-black' : 'text-black/35 hover:text-black/70'
      }`}
    >
      {children}
      {label}
    </button>
  )
}
