import {lineCoordinates, type MapData, type PinDoc, type TrackDoc} from '@/lib/sanity/types'

export type SortMode = 'newest' | 'oldest' | 'az'

export type MapFilterState = {
  query: string
  /** Empty means "everything". Values like `pin:trip` or `track:hike`. */
  types: string[]
  year: string | null
  sort: SortMode
}

export const emptyMapFilters: MapFilterState = {query: '', types: [], year: null, sort: 'newest'}

export type TypeOption = {value: string; label: string}

const PIN_LABELS: Record<string, string> = {
  trip: 'Trips',
  mountain: 'Mountains',
  park: 'Parks',
  place: 'Places',
}

const TRACK_LABELS: Record<string, string> = {
  bike: 'Bike rides',
  hike: 'Hikes',
  other: 'Other routes',
}

export function pinType(pin: PinDoc) {
  return `pin:${pin.kind}`
}

export function trackType(track: TrackDoc) {
  return `track:${track.activity}`
}

function dateOf(value?: string): number | null {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

export function yearOf(value?: string): string | null {
  const time = dateOf(value)
  return time == null ? null : String(new Date(time).getFullYear())
}

/** The kinds and years that actually exist in the data, so the panel only offers real choices. */
export function filterOptions(data: MapData) {
  const types = new Map<string, string>()
  for (const pin of data.pins) types.set(pinType(pin), PIN_LABELS[pin.kind] ?? 'Places')
  for (const track of data.tracks) types.set(trackType(track), TRACK_LABELS[track.activity] ?? 'Routes')
  const order = [...Object.keys(PIN_LABELS).map((k) => `pin:${k}`), ...Object.keys(TRACK_LABELS).map((k) => `track:${k}`)]
  const typeOptions: TypeOption[] = order
    .filter((value) => types.has(value))
    .map((value) => ({value, label: types.get(value)!}))

  const years = new Set<string>()
  for (const pin of data.pins) {
    const y = yearOf(pin.at)
    if (y) years.add(y)
  }
  for (const track of data.tracks) {
    const y = yearOf(track.startedAt)
    if (y) years.add(y)
  }
  return {typeOptions, years: [...years].sort((a, b) => Number(b) - Number(a))}
}

export function filtersActive(state: MapFilterState) {
  return state.query.trim() !== '' || state.types.length > 0 || state.year !== null
}

export function activeFilterCount(state: MapFilterState) {
  return (state.query.trim() ? 1 : 0) + state.types.length + (state.year ? 1 : 0)
}

function matchesQuery(query: string, ...fields: (string | undefined)[]) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return q.split(/\s+/).every((word) => fields.some((field) => field?.toLowerCase().includes(word)))
}

export function applyMapFilters(data: MapData, state: MapFilterState): MapData {
  if (!filtersActive(state)) return data
  const typeOk = (type: string) => state.types.length === 0 || state.types.includes(type)
  return {
    ...data,
    pins: data.pins.filter(
      (pin) =>
        typeOk(pinType(pin)) &&
        (!state.year || yearOf(pin.at) === state.year) &&
        matchesQuery(state.query, pin.title, pin.note, PIN_LABELS[pin.kind]),
    ),
    tracks: data.tracks.filter(
      (track) =>
        typeOk(trackType(track)) &&
        (!state.year || yearOf(track.startedAt) === state.year) &&
        matchesQuery(state.query, track.title, TRACK_LABELS[track.activity]),
    ),
  }
}

export type ResultItem = {
  kind: 'pin' | 'track'
  id: string
  title: string
  label: string
  date: string | undefined
  photo: PinDoc['photo']
  miles: number | null
}

/** Everything that passed the filters, as one list in the chosen order. */
export function resultList(shown: MapData, sort: SortMode, miles: (track: TrackDoc) => number | null): ResultItem[] {
  const items: ResultItem[] = [
    ...shown.pins.map<ResultItem>((pin) => ({
      kind: 'pin',
      id: pin._id,
      title: pin.title,
      label: PIN_LABELS[pin.kind] ?? 'Place',
      date: pin.at,
      photo: pin.photo,
      miles: null,
    })),
    ...shown.tracks.map<ResultItem>((track) => ({
      kind: 'track',
      id: track._id,
      title: track.title,
      label: TRACK_LABELS[track.activity] ?? 'Route',
      date: track.startedAt,
      photo: track.photo,
      miles: miles(track),
    })),
  ]
  const time = (item: ResultItem) => dateOf(item.date)
  return items.sort((a, b) => {
    if (sort === 'az') return a.title.localeCompare(b.title)
    const ta = time(a)
    const tb = time(b)
    if (ta == null && tb == null) return a.title.localeCompare(b.title)
    if (ta == null) return 1
    if (tb == null) return -1
    return sort === 'newest' ? tb - ta : ta - tb
  })
}

export function trackCoords(track: TrackDoc) {
  return lineCoordinates(track.route)
}
