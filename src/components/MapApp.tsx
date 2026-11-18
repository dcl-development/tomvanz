'use client'

import {useCallback, useDeferredValue, useEffect, useMemo, useRef, useState} from 'react'
import dynamic from 'next/dynamic'
import {ThreeDButton} from './ThreeDButton'
import {MapSearch} from './MapSearch'
import {PileStrip} from './PileStrip'
import {lineMiles} from '@/lib/geo'
import {
  applyMapFilters,
  emptyMapFilters,
  filterOptions,
  resultList,
  trackCoords,
  type MapFilterState,
  type ResultItem,
} from '@/lib/map-filters'
import type {MapData, PinDoc, SelectedItem} from '@/lib/sanity/types'

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
  /** Set when the page was opened from a shared link. */
  initialSelected?: SelectedItem | null
  /** The map data couldn't be loaded from Sanity (the map still opens, empty). */
  loadFailed?: boolean
}

export function MapApp({data: allData, initialSelected = null, loadFailed = false}: Props) {
  const [selected, setSelected] = useState<SelectedItem | null>(initialSelected)
  const [searchKey, setSearchKey] = useState(0)
  const [mapFilters, setMapFilters] = useState<MapFilterState>(emptyMapFilters)
  // The map follows typing a beat later, so it doesn't re-fit on every keystroke.
  const deferredFilters = useDeferredValue(mapFilters)
  const data = useMemo(() => applyMapFilters(allData, deferredFilters), [allData, deferredFilters])
  const options = useMemo(() => filterOptions(allData), [allData])
  const results = useMemo(
    () => resultList(applyMapFilters(allData, mapFilters), (track) => lineMiles(trackCoords(track))),
    [allData, mapFilters],
  )
  const [pileIds, setPileIds] = useState<string[] | null>(null)
  const [pileIndex, setPileIndex] = useState(0)
  const [mapFailed, setMapFailed] = useState(false)
  const [threeD, setThreeD] = useState(false)
  const [hint, setHint] = useState<'touch' | 'mouse' | null>(null)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (hintTimer.current) clearTimeout(hintTimer.current)
  }, [])

  const changeThreeD = (next: boolean) => {
    setThreeD(next)
    if (hintTimer.current) clearTimeout(hintTimer.current)
    if (!next) {
      setHint(null)
      return
    }
    setHint(window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse')
    hintTimer.current = setTimeout(() => setHint(null), 5000)
  }

  // Tilting the map by hand turns 3D on. No how-to hint: they clearly know how to move around.
  const startThreeDFromGesture = useCallback(() => setThreeD(true), [])

  // Any new selection (or a tap on empty map) closes the pile strip.
  const select = useCallback((item: SelectedItem | null) => {
    setPileIds(null)
    setSelected(item)
  }, [])

  const openPile = useCallback((ids: string[]) => {
    setSelected(null)
    setPileIndex(0)
    setPileIds(ids)
  }, [])

  const pilePins = useMemo(() => {
    if (!pileIds) return null
    const byId = new Map(data.pins.map((pin) => [pin._id, pin]))
    return pileIds.map((id) => byId.get(id)).filter((pin): pin is PinDoc => Boolean(pin))
  }, [pileIds, data])

  // Keep the address bar pointing at whatever is open, so the link can be shared.
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete('photo')
    url.searchParams.delete('track')
    if (selected) url.searchParams.set(selected.kind === 'pin' ? 'photo' : 'track', selected.id)
    window.history.replaceState(window.history.state, '', url)
  }, [selected])

  const pickResult = useCallback((item: ResultItem) => {
    setPileIds(null)
    setSelected(item.kind === 'pin' ? {kind: 'pin', id: item.id} : {kind: 'track', id: item.id, fly: true})
    // Close the results list so it isn't covering the card; the filters stay applied.
    setSearchKey((key) => key + 1)
  }, [])

  const total = allData.tracks.length + allData.pins.length
  const matching = data.tracks.length + data.pins.length

  const selectedStillVisible = useMemo(() => {
    if (!selected) return false
    if (selected.kind === 'track') return data.tracks.some((item) => item._id === selected.id)
    return data.pins.some((item) => item._id === selected.id)
  }, [selected, data])

  const card = selectedStillVisible ? selected : null

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#e8e8e8]"
      data-strip={pilePins && pilePins.length > 1 && !card ? 'true' : 'false'}
    >
      {mapFailed ? (
        <div className="flex h-full items-center justify-center text-[14px] text-black/70">
          Couldn’t load the map.
        </div>
      ) : (
        <MapCanvas
          data={data}
          threeD={threeD}
          onThreeDGesture={startThreeDFromGesture}
          selected={card}
          highlightId={pilePins?.[pileIndex]?._id ?? null}
          onSelect={select}
          onPile={openPile}
          onMapError={() => setMapFailed(true)}
        />
      )}
      {!mapFailed ? (
        <MapSearch
          key={searchKey}
          state={mapFilters}
          onChange={setMapFilters}
          typeOptions={options.typeOptions}
          hasDrone={options.hasDrone}
          results={results}
          total={allData.pins.length + allData.tracks.length}
          onPick={pickResult}
        />
      ) : null}
      {!mapFailed ? (
        <ThreeDButton threeD={threeD} onChange={changeThreeD} />
      ) : null}
      {!mapFailed && loadFailed ? (
        <p
          role="status"
          className="absolute inset-x-3 top-[68px] z-10 mx-auto w-fit max-w-[360px] rounded-2xl bg-white/95 px-4 py-2.5 text-center text-[13px] leading-snug text-black/75 shadow-md"
        >
          Couldn’t load the latest map data right now. Try reloading in a minute.
        </p>
      ) : null}
      {!mapFailed && !loadFailed && total === 0 ? (
        <p className="pointer-events-none absolute left-4 top-[68px] z-10 rounded-full bg-white/85 px-3 py-1.5 text-[13px] text-black/60 shadow-sm">
          Nothing mapped yet.
        </p>
      ) : null}
      {!mapFailed && !loadFailed && total > 0 && matching === 0 ? (
        <p className="pointer-events-none absolute left-4 top-[68px] z-10 rounded-full bg-white/85 px-3 py-1.5 text-[13px] text-black/60 shadow-sm">
          Nothing matches your search.
        </p>
      ) : null}
      {hint ? (
        <div
          role="status"
          className="tv-hint pointer-events-none absolute inset-x-0 bottom-[92px] z-10 flex justify-center px-14 md:bottom-16"
        >
          <p className="max-w-[340px] rounded-2xl bg-black/80 px-4 py-2.5 text-center text-[13px] leading-snug text-white shadow-lg backdrop-blur-md">
            {hint === 'touch'
              ? 'Drag with two fingers up or down to tilt, twist to rotate, pinch to zoom.'
              : 'Right-click and drag (or Ctrl + drag) to tilt and rotate. Scroll to zoom.'}
          </p>
        </div>
      ) : null}
      {pilePins && pilePins.length > 1 && !card ? (
        <PileStrip
          pins={pilePins}
          onIndexChange={setPileIndex}
          onOpen={(id) => select({kind: 'pin', id})}
          onClose={() => select(null)}
        />
      ) : null}
    </div>
  )
}
