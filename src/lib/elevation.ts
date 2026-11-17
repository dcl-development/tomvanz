/**
 * Elevation along a route, read from the same free terrain tiles the 3D view uses.
 * Everything runs in the browser; it's an approximation (terrain data, not GPS altitude).
 */

const TILE_URL = (z: number, x: number, y: number) =>
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`

const FEET_PER_METER = 3.28084
const SAMPLES = 90
const MAX_TILES = 14

export type ElevationProfile = {
  /** Distance from the start, in miles. */
  miles: number[]
  /** Elevation in feet. */
  feet: number[]
  gainFeet: number
  lossFeet: number
  minFeet: number
  maxFeet: number
}

type Tile = {data: Uint8ClampedArray; size: number}

const tileCache = new Map<string, Promise<Tile | null>>()

function lngLatToTile(lng: number, lat: number, z: number) {
  const n = 2 ** z
  const x = ((lng + 180) / 360) * n
  const latRad = (lat * Math.PI) / 180
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  return {x, y}
}

function loadTile(z: number, x: number, y: number): Promise<Tile | null> {
  const key = `${z}/${x}/${y}`
  const cached = tileCache.get(key)
  if (cached) return cached
  const promise = new Promise<Tile | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d', {willReadFrequently: true})
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0)
        resolve({data: ctx.getImageData(0, 0, img.width, img.height).data, size: img.width})
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = TILE_URL(z, x, y)
  })
  tileCache.set(key, promise)
  return promise
}

function haversineMiles(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Evenly spaced points along the line, with their distance from the start. */
function samplePoints(coords: [number, number][]) {
  const cumulative = [0]
  for (let i = 1; i < coords.length; i += 1) {
    cumulative.push(cumulative[i - 1]! + haversineMiles(coords[i - 1]!, coords[i]!))
  }
  const total = cumulative[cumulative.length - 1] ?? 0
  const points: {lng: number; lat: number; miles: number}[] = []
  if (total <= 0) return {points, total}
  let seg = 1
  for (let i = 0; i < SAMPLES; i += 1) {
    const target = (total * i) / (SAMPLES - 1)
    while (seg < coords.length - 1 && cumulative[seg]! < target) seg += 1
    const a = coords[seg - 1]!
    const b = coords[seg]!
    const span = cumulative[seg]! - cumulative[seg - 1]!
    const t = span > 0 ? (target - cumulative[seg - 1]!) / span : 0
    points.push({lng: a[0] + (b[0] - a[0]) * t, lat: a[1] + (b[1] - a[1]) * t, miles: target})
  }
  return {points, total}
}

/** Highest zoom (up to 12) that keeps the number of tiles to download reasonable. */
function pickZoom(points: {lng: number; lat: number}[]) {
  for (let z = 12; z >= 7; z -= 1) {
    const tiles = new Set(
      points.map((p) => {
        const t = lngLatToTile(p.lng, p.lat, z)
        return `${Math.floor(t.x)}/${Math.floor(t.y)}`
      }),
    )
    if (tiles.size <= MAX_TILES) return z
  }
  return 7
}

export async function routeElevation(coords: [number, number][]): Promise<ElevationProfile | null> {
  const {points, total} = samplePoints(coords)
  if (points.length < 2 || total < 0.05) return null

  const z = pickZoom(points)
  const meters: number[] = []
  for (const point of points) {
    const t = lngLatToTile(point.lng, point.lat, z)
    const tile = await loadTile(z, Math.floor(t.x), Math.floor(t.y))
    if (!tile) return null
    const px = Math.min(tile.size - 1, Math.floor((t.x - Math.floor(t.x)) * tile.size))
    const py = Math.min(tile.size - 1, Math.floor((t.y - Math.floor(t.y)) * tile.size))
    const i = (py * tile.size + px) * 4
    meters.push(tile.data[i]! * 256 + tile.data[i + 1]! + tile.data[i + 2]! / 256 - 32768)
  }

  // Light smoothing so tile-edge noise doesn't inflate the climb.
  const smooth = meters.map((_, i) => {
    const from = Math.max(0, i - 2)
    const to = Math.min(meters.length - 1, i + 2)
    let sum = 0
    for (let k = from; k <= to; k += 1) sum += meters[k]!
    return sum / (to - from + 1)
  })
  const feet = smooth.map((m) => m * FEET_PER_METER)

  // Count a climb or drop only once it exceeds 10 ft, to ignore wobble.
  let gain = 0
  let loss = 0
  let anchor = feet[0]!
  for (const f of feet) {
    if (f - anchor >= 10) {
      gain += f - anchor
      anchor = f
    } else if (anchor - f >= 10) {
      loss += anchor - f
      anchor = f
    }
  }

  return {
    miles: points.map((p) => p.miles),
    feet,
    gainFeet: gain,
    lossFeet: loss,
    minFeet: Math.min(...feet),
    maxFeet: Math.max(...feet),
  }
}

export function formatFeet(feet: number): string {
  return `${Math.round(feet).toLocaleString()} ft`
}
