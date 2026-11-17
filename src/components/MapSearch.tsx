'use client'

import {useState} from 'react'
import {urlFor} from '@/lib/sanity/image'
import {formatMiles} from '@/lib/geo'
import {
  activeFilterCount,
  emptyMapFilters,
  type MapFilterState,
  type ResultItem,
  type SortMode,
  type TypeOption,
} from '@/lib/map-filters'

type Props = {
  state: MapFilterState
  onChange: (next: MapFilterState) => void
  typeOptions: TypeOption[]
  hasDrone: boolean
  years: string[]
  results: ResultItem[]
  total: number
  onPick: (item: ResultItem) => void
}

const SORTS: {value: SortMode; label: string}[] = [
  {value: 'newest', label: 'Newest'},
  {value: 'oldest', label: 'Oldest'},
  {value: 'az', label: 'A–Z'},
]

function formatDate(value?: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'})
}

export function MapSearch({state, onChange, typeOptions, hasDrone, years, results, total, onPick}: Props) {
  const [open, setOpen] = useState(false)
  const count = activeFilterCount(state)

  const toggleType = (value: string) =>
    onChange({
      ...state,
      types: state.types.includes(value) ? state.types.filter((t) => t !== value) : [...state.types, value],
    })

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="absolute left-3 top-3 z-10 flex h-[44px] items-center gap-2 rounded-full bg-white/90 px-4 text-[13px] font-semibold text-black shadow-sm ring-1 ring-black/10 md:left-4 md:top-4"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
        Search
        {count > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1.5 text-[11px] text-white">
            {count}
          </span>
        ) : null}
      </button>

      {open ? (
        <section
          aria-label="Search and filter the map"
          className="tv-card tv-sheet absolute inset-x-0 bottom-0 z-30 flex h-[72vh] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-12px_48px_rgba(0,0,0,0.25)] md:inset-x-auto md:bottom-4 md:left-4 md:top-[68px] md:h-auto md:w-[360px] md:rounded-2xl md:shadow-[0_16px_48px_rgba(0,0,0,0.25)]"
        >
          <div className="flex items-center gap-2 px-4 pb-2 pt-4">
            <input
              type="search"
              value={state.query}
              onChange={(event) => onChange({...state, query: event.target.value})}
              placeholder="Search photos and routes"
              aria-label="Search"
              className="h-11 min-w-0 flex-1 rounded-full bg-black/[0.06] px-4 text-[15px] outline-none placeholder:text-black/40 focus:bg-black/[0.09]"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close search"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-[20px] leading-none"
            >
              ×
            </button>
          </div>

          <div className="space-y-2.5 px-4 pb-3">
            {typeOptions.length > 1 || hasDrone ? (
              <Chips>
                {hasDrone ? (
                  <Chip active={state.drone} onClick={() => onChange({...state, drone: !state.drone})}>
                    Drone
                  </Chip>
                ) : null}
                {typeOptions.map((option) => (
                  <Chip
                    key={option.value}
                    active={state.types.includes(option.value)}
                    onClick={() => toggleType(option.value)}
                  >
                    {option.label}
                  </Chip>
                ))}
              </Chips>
            ) : null}
            {years.length > 1 ? (
              <Chips>
                {years.map((year) => (
                  <Chip
                    key={year}
                    active={state.year === year}
                    onClick={() => onChange({...state, year: state.year === year ? null : year})}
                  >
                    {year}
                  </Chip>
                ))}
              </Chips>
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1" role="group" aria-label="Sort">
                {SORTS.map((sort) => (
                  <button
                    key={sort.value}
                    type="button"
                    onClick={() => onChange({...state, sort: sort.value})}
                    aria-pressed={state.sort === sort.value}
                    className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${
                      state.sort === sort.value ? 'bg-black/[0.09] text-black' : 'text-black/45'
                    }`}
                  >
                    {sort.label}
                  </button>
                ))}
              </div>
              {count > 0 ? (
                <button
                  type="button"
                  onClick={() => onChange({...emptyMapFilters, sort: state.sort})}
                  className="text-[12px] font-semibold text-black/60 underline underline-offset-2"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          <p className="px-4 pb-1.5 text-[12px] text-black/45">
            {results.length === total ? `${total} on the map` : `${results.length} of ${total}`}
          </p>
          <ul className="min-h-0 flex-1 overflow-y-auto border-t border-black/5 pb-[env(safe-area-inset-bottom)]">
            {results.length === 0 ? (
              <li className="px-4 py-8 text-center text-[14px] text-black/50">Nothing matches that.</li>
            ) : (
              results.map((item) => {
                const date = formatDate(item.date)
                const meta = [item.label, date, item.miles ? formatMiles(item.miles) : null].filter(Boolean).join(' · ')
                return (
                  <li key={`${item.kind}-${item.id}`}>
                    <button
                      type="button"
                      onClick={() => onPick(item)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-black/[0.04] active:bg-black/[0.07]"
                    >
                      {item.photo?.asset ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={urlFor(item.photo).width(112).height(112).fit('crop').url()}
                          alt=""
                          className="h-11 w-11 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-11 w-11 shrink-0 rounded-lg bg-neutral-800" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold">{item.title}</span>
                        <span className="block truncate text-[12px] text-black/50">{meta}</span>
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </section>
      ) : null}
    </>
  )
}

function Chips({children}: {children: React.ReactNode}) {
  return <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>
}

function Chip({active, onClick, children}: {active: boolean; onClick: () => void; children: React.ReactNode}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium ${
        active ? 'bg-black text-white' : 'bg-black/[0.06] text-black/70'
      }`}
    >
      {children}
    </button>
  )
}
