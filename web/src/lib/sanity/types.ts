export type Geopoint = {
  lat: number
  lng: number
}

export type PhotoDoc = {
  _id: string
  fish: string
  caption?: string
  takenAt?: string
  location: Geopoint
  image: {
    asset?: {_ref: string}
  }
}

export type TrackDoc = {
  _id: string
  title: string
  activity: 'bike' | 'hike' | 'other'
  startedAt?: string
  route: {
    type: 'LineString'
    coordinates: string | Array<Geopoint | [number, number]>
  }
  photo?: {
    asset?: {_ref: string}
  }
}

export function lineCoordinates(route: {coordinates?: unknown} | undefined): [number, number][] {
  const raw = parseCoordinateList(route?.coordinates)
  const coords: [number, number][] = []
  for (const point of raw) {
    const pair = toLngLat(point)
    if (pair) coords.push(pair)
  }
  return coords
}

function parseCoordinateList(value: unknown): unknown[] {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return Array.isArray(value) ? value : []
}

function toLngLat(point: unknown): [number, number] | null {
  if (Array.isArray(point) && point.length >= 2) {
    const lng = Number(point[0])
    const lat = Number(point[1])
    return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null
  }
  if (point && typeof point === 'object' && 'lng' in point && 'lat' in point) {
    const lng = Number((point as Geopoint).lng)
    const lat = Number((point as Geopoint).lat)
    return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null
  }
  return null
}

export type PinKind = 'trip' | 'mountain' | 'park' | 'place'

export type PinDoc = {
  _id: string
  title: string
  kind: PinKind
  note?: string
  at?: string
  location: Geopoint
  photo?: {
    asset?: {_ref: string}
  }
}

export type MapData = {
  name: string
  tracks: TrackDoc[]
  pins: PinDoc[]
}

export type SelectedItem =
  | {kind: 'track'; id: string; lng?: number; lat?: number}
  | {kind: 'pin'; id: string}
