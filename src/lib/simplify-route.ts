/** Earth radius in meters (WGS84 mean). */
const EARTH_RADIUS_M = 6_371_000

export type LngLat = [number, number]

/** Great-circle distance between two WGS84 points, in meters. */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Path length along a dense line, in meters. */
export function lineLengthMeters(coords: LngLat[]): number {
  if (coords.length < 2) return 0
  let meters = 0
  for (let i = 1; i < coords.length; i += 1) {
    meters += haversineMeters(coords[i - 1]!, coords[i]!)
  }
  return meters
}

/** Drop consecutive points with identical lng/lat. */
export function removeConsecutiveDuplicates(coords: LngLat[]): LngLat[] {
  if (coords.length === 0) return []
  const out: LngLat[] = [coords[0]!]
  for (let i = 1; i < coords.length; i += 1) {
    const prev = out[out.length - 1]!
    const cur = coords[i]!
    if (cur[0] !== prev[0] || cur[1] !== prev[1]) out.push(cur)
  }
  return out
}

function toLocalMeters(origin: LngLat, point: LngLat): [number, number] {
  const cosLat = Math.cos((origin[1] * Math.PI) / 180)
  const x = ((point[0] - origin[0]) * Math.PI) / 180 * EARTH_RADIUS_M * cosLat
  const y = ((point[1] - origin[1]) * Math.PI) / 180 * EARTH_RADIUS_M
  return [x, y]
}

function perpendicularDistanceMeters(point: LngLat, start: LngLat, end: LngLat): number {
  const [px, py] = toLocalMeters(start, point)
  const [ex, ey] = toLocalMeters(start, end)
  const len2 = ex * ex + ey * ey
  if (len2 === 0) return Math.hypot(px, py)
  let t = (px * ex + py * ey) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - t * ex, py - t * ey)
}

/** Douglas–Peucker simplification; `toleranceMeters` is max cross-track error. */
export function douglasPeucker(coords: LngLat[], toleranceMeters: number): LngLat[] {
  if (coords.length <= 2) return coords.slice()

  let maxDist = 0
  let index = 0
  const end = coords.length - 1
  for (let i = 1; i < end; i += 1) {
    const d = perpendicularDistanceMeters(coords[i]!, coords[0]!, coords[end]!)
    if (d > maxDist) {
      index = i
      maxDist = d
    }
  }

  if (maxDist > toleranceMeters) {
    const left = douglasPeucker(coords.slice(0, index + 1), toleranceMeters)
    const right = douglasPeucker(coords.slice(index), toleranceMeters)
    return [...left.slice(0, -1), ...right]
  }

  return [coords[0]!, coords[end]!]
}

export function roundCoordinates(coords: LngLat[], decimals = 5): LngLat[] {
  const k = 10 ** decimals
  return coords.map(([lng, lat]) => [
    Math.round(lng * k) / k,
    Math.round(lat * k) / k,
  ])
}

export const DISPLAY_TOLERANCE_METERS = 2

/** Simplify for map display: dedupe, Douglas–Peucker (2 m), round to 5 decimals. */
export function simplifyRouteForDisplay(
  coords: LngLat[],
  toleranceMeters = DISPLAY_TOLERANCE_METERS,
): LngLat[] {
  const deduped = removeConsecutiveDuplicates(coords)
  if (deduped.length < 2) return roundCoordinates(deduped)
  return roundCoordinates(douglasPeucker(deduped, toleranceMeters))
}

export function prepareRouteDisplayFields(coords: LngLat[]): {
  displayCoordinates: string
  distanceMeters: number
} {
  const distanceMeters = lineLengthMeters(coords)
  const display = simplifyRouteForDisplay(coords)
  return {
    displayCoordinates: JSON.stringify(display),
    distanceMeters: Math.round(distanceMeters * 10) / 10,
  }
}