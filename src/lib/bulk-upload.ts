import exifr from 'exifr'

/** What the bulk uploader pulls out of a photo file. */
export type PhotoMeta = {
  lat?: number
  lng?: number
  /** When it was taken, as an ISO date-time. */
  takenAt?: string
}

/**
 * Reads the GPS position and the time taken from a photo's own data. Missing or unreadable
 * data is fine (screenshots, edited exports): the fields are simply left out.
 */
export async function readPhotoMeta(input: Blob | ArrayBuffer | Uint8Array): Promise<PhotoMeta> {
  let data: Record<string, unknown> | undefined
  try {
    data = (await exifr.parse(input, {gps: true})) ?? undefined
  } catch {
    return {}
  }
  if (!data) return {}

  const meta: PhotoMeta = {}
  const lat = Number(data.latitude)
  const lng = Number(data.longitude)
  if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
    meta.lat = lat
    meta.lng = lng
  }

  const when = (data.DateTimeOriginal ?? data.CreateDate) as Date | string | undefined
  const date = when instanceof Date ? when : when ? new Date(when) : null
  // Ignore obviously bogus clocks (cameras that were never set report 1970 or 2000).
  if (date && !Number.isNaN(date.getTime()) && date.getFullYear() >= 2005 && date.getTime() < Date.now() + 86_400_000) {
    meta.takenAt = date.toISOString()
  }
  return meta
}

const PHOTO_EXTENSIONS = /\.(jpe?g|png|heic|heif|webp|tiff?)$/i

/** Photos only: by MIME type, or by extension when the browser doesn't report one. */
export function isPhotoFile(file: {name: string; type: string}): boolean {
  return file.type.startsWith('image/') || PHOTO_EXTENSIONS.test(file.name)
}

/** The pin document created for an uploaded photo. Title is left blank on purpose; it's optional. */
export function pinFromUpload(assetId: string, meta: PhotoMeta) {
  return {
    _type: 'pin' as const,
    kind: 'place' as const,
    photo: {_type: 'image' as const, asset: {_type: 'reference' as const, _ref: assetId}},
    ...(meta.lat != null && meta.lng != null
      ? {location: {_type: 'geopoint' as const, lat: meta.lat, lng: meta.lng}}
      : {}),
    ...(meta.takenAt ? {at: meta.takenAt} : {}),
  }
}

/** Runs `worker` over `items`, at most `limit` at a time, returning when all are done. */
export async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const lanes = Array.from({length: Math.min(limit, items.length)}, async () => {
    while (next < items.length) {
      const item = items[next]!
      next += 1
      await worker(item)
    }
  })
  await Promise.all(lanes)
}
