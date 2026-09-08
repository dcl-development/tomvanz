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
    coordinates: Array<Geopoint | [number, number]>
  }
}

export function lineCoordinates(route: TrackDoc['route'] | undefined): [number, number][] {
  const points = route?.coordinates
  if (!Array.isArray(points)) return []

  const coords: [number, number][] = []
  for (const point of points) {
    if (Array.isArray(point) && point.length >= 2) {
      const lng = Number(point[0])
      const lat = Number(point[1])
      if (Number.isFinite(lng) && Number.isFinite(lat)) coords.push([lng, lat])
      continue
    }
    if (!Array.isArray(point)) {
      const lng = Number(point.lng)
      const lat = Number(point.lat)
      if (Number.isFinite(lng) && Number.isFinite(lat)) coords.push([lng, lat])
    }
  }
  return coords
}

export type PinKind = 'catch' | 'mountain' | 'park' | 'place'

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
  photos: PhotoDoc[]
  tracks: TrackDoc[]
  pins: PinDoc[]
}

export type SelectedItem =
  | {kind: 'photo'; id: string}
  | {kind: 'track'; id: string}
  | {kind: 'pin'; id: string}
