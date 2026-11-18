import {lineCoordinates, type MapData, type PinDoc, type TrackDoc} from '@/lib/sanity/types'

export type MapFilterState = {
  query: string
  /** Empty means "everything". Values: `pin:all` (photos), `track:all` (routes), `track:hike`, … */
  types: string[]
  year: string | null
  /** Only photos shot with a drone. */
  drone: boolean
}

export const emptyMapFilters: MapFilterState = {query: '', types: [], year: null, drone: false}

export type TypeOption = {value: string; label: string}

const TRACK_LABELS: Record<string, string> = {
  bike: 'Bike rides',
  hike: 'Hikes',
  other: 'Other routes',
}

/** Every photo is of the one sort. */
export function pinType() {
  return 'pin:photo'
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

/** The route kinds and years that actually exist in the data, so the panel only offers real choices. */
export function filterOptions(data: MapData) {
  const routeKinds = new Map<string, string>()
  for (const track of data.tracks) routeKinds.set(trackType(track), TRACK_LABELS[track.activity] ?? 'Routes')
  const kinds: TypeOption[] = Object.keys(TRACK_LABELS)
    .map((k) => `track:${k}`)
    .filter((value) => routeKinds.has(value))
    .map((value) => ({value, label: routeKinds.get(value)!}))
  // Photos / Routes: one tap for "all of that sort" (only worth offering when both exist).
  const groups: TypeOption[] =
    data.pins.length > 0 && data.tracks.length > 0
      ? [
          {value: 'pin:all', label: 'Photos'},
          {value: 'track:all', label: 'Routes'},
        ]
      : []
  const typeOptions: TypeOption[] = [...groups, ...kinds]

  const years = new Set<string>()
  for (const pin of data.pins) {
    const y = yearOf(pin.at)
    if (y) years.add(y)
  }
  for (const track of data.tracks) {
    const y = yearOf(track.startedAt)
    if (y) years.add(y)
  }
  const hasDrone = data.pins.some((pin) => pin.isDrone)
  return {typeOptions, hasDrone, years: [...years].sort((a, b) => Number(b) - Number(a))}
}

export function filtersActive(state: MapFilterState) {
  return state.query.trim() !== '' || state.types.length > 0 || state.year !== null || state.drone
}

export function activeFilterCount(state: MapFilterState) {
  return (state.query.trim() ? 1 : 0) + state.types.length + (state.year ? 1 : 0) + (state.drone ? 1 : 0)
}

function matchesQuery(query: string, ...fields: (string | undefined)[]) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return q.split(/\s+/).every((word) => fields.some((field) => field?.toLowerCase().includes(word)))
}

export function applyMapFilters(data: MapData, state: MapFilterState): MapData {
  if (!filtersActive(state)) return data
  // 'pin:all' / 'track:all' are the Photos / Routes group chips: every kind of that sort.
  const typeOk = (type: string) =>
    state.types.length === 0 ||
    state.types.includes(type) ||
    state.types.includes(type.startsWith('pin:') ? 'pin:all' : 'track:all')
  return {
    ...data,
    pins: data.pins.filter(
      (pin) =>
        typeOk(pinType()) &&
        (!state.drone || pin.isDrone === true) &&
        (!state.year || yearOf(pin.at) === state.year) &&
        matchesQuery(state.query, pin.title, pin.note, pin.isDrone ? 'drone' : undefined),
    ),
    // Routes aren't photos, so they drop out when only drone photos are wanted.
    tracks: data.tracks.filter(
      (track) =>
        !state.drone &&
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
  /** Routes: bike / hike / other, for the icon's colour. */
  activity?: TrackDoc['activity']
}

/** Everything that passed the filters as one list: routes newest first, then undated photos A–Z. */
export function resultList(shown: MapData, miles: (track: TrackDoc) => number | null): ResultItem[] {
  const items: ResultItem[] = [
    ...shown.pins.map<ResultItem>((pin) => ({
      kind: 'pin',
      id: pin._id,
      title: pin.title?.trim() || 'Untitled photo',
      label: pin.isDrone ? 'Drone' : 'Photo',
      date: pin.at,
      photo: pin.photo,
      miles: null,
    })),
    ...shown.tracks.map<ResultItem>((track) => ({
      kind: 'track',
      id: track._id,
      title: track.title?.trim() || 'Untitled route',
      label: TRACK_LABELS[track.activity] ?? 'Route',
      date: track.startedAt,
      photo: track.photo,
      miles: miles(track),
      activity: track.activity,
    })),
  ]
  const time = (item: ResultItem) => dateOf(item.date)
  return items.sort((a, b) => {
    const ta = time(a)
    const tb = time(b)
    if (ta == null && tb == null) return a.title.localeCompare(b.title)
    if (ta == null) return 1
    if (tb == null) return -1
    return tb - ta
  })
}

export function trackCoords(track: TrackDoc) {
  return lineCoordinates(track.route)
}
