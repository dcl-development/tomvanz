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
    coordinates: [number, number][]
  }
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
