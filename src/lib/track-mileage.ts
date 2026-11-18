import {lineMiles} from '@/lib/geo'
import {lineCoordinates, type TrackDoc} from '@/lib/sanity/types'

const METERS_PER_MILE = 1609.344

/** Mileage for UI: stored meters when present, else computed from the line on the doc. */
export function trackMiles(track: Pick<TrackDoc, 'route' | 'distanceMeters'>): number | null {
  if (track.distanceMeters != null && Number.isFinite(track.distanceMeters)) {
    const miles = track.distanceMeters / METERS_PER_MILE
    if (miles < 0.05) return null
    return miles
  }
  return lineMiles(lineCoordinates(track.route))
}