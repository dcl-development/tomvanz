/**
 * Moves the old "pin" documents and "trip photo" documents into the one Photo shape:
 *   image · title · location · note · takenAt · drone
 *
 * Pure logic only (no Sanity calls), so it can be tested and dry-run. The Studio tool does the
 * reading and writing. Every converted document keeps its _id, so shared links keep working.
 * (The backup file the tool offers keeps the originals in full.) A document that is already
 * in the new shape is left alone, so running this twice is harmless.
 */

type ImageValue = {_type?: string; asset?: {_ref?: string}; hotspot?: unknown; crop?: unknown; [key: string]: unknown}

/** A document as it may exist in Sanity today (old pin, old trip photo, or new Photo). */
export type OldDoc = {
  _id: string
  _type: string
  _createdAt?: string
  _rev?: string
  // old pin
  title?: string
  kind?: string
  photo?: ImageValue
  at?: string
  // old trip photo
  fish?: string
  caption?: string
  // shared
  image?: ImageValue
  note?: string
  takenAt?: string
  location?: {_type?: string; lat?: number; lng?: number; alt?: number}
  drone?: boolean
  [key: string]: unknown
}

export type PhotoDoc = {
  _id: string
  _type: 'photo'
  image: ImageValue
  title?: string
  note?: string
  takenAt?: string
  location?: {_type: 'geopoint'; lat: number; lng: number}
  drone?: boolean
}

export type Skipped = {id: string; title: string; reason: string}

export type MigrationPlan = {
  /** Documents that will be replaced, with what they'll become. */
  convert: {from: OldDoc; to: PhotoDoc}[]
  /** Left exactly as they are, and why. */
  skipped: Skipped[]
  /** Photos already in the new shape. */
  alreadyDone: number
}

const clean = (value: string | undefined | null) => {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed === '' ? undefined : trimmed
}

const labelOf = (doc: OldDoc) => clean(doc.title) ?? clean(doc.fish) ?? doc._id

/** The new-shape document for an old one, or the reason it can't be converted. */
export function toPhotoDoc(doc: OldDoc): {photo: PhotoDoc} | {skip: string} | {done: true} {
  const isPin = doc._type === 'pin'
  const isPhoto = doc._type === 'photo'
  if (!isPin && !isPhoto) return {skip: 'Not a pin or photo.'}

  // A photo with none of the old fields is already in the new shape.
  if (isPhoto && doc.fish === undefined && doc.caption === undefined && doc.kind === undefined) {
    return {done: true}
  }

  const image = isPin ? doc.photo : doc.image
  if (!image?.asset?._ref) return {skip: 'No photo attached, so there is nothing to show on the map.'}

  const title = clean(doc.title) ?? clean(doc.fish)
  const note = clean(doc.note) ?? clean(doc.caption)
  const takenAt = isPin ? doc.at : doc.takenAt
  const hasLocation = typeof doc.location?.lat === 'number' && typeof doc.location?.lng === 'number'

  const photo: PhotoDoc = {
    _id: doc._id,
    _type: 'photo',
    image,
    ...(title ? {title} : {}),
    ...(note ? {note} : {}),
    ...(takenAt ? {takenAt} : {}),
    ...(hasLocation ? {location: {_type: 'geopoint' as const, lat: doc.location!.lat!, lng: doc.location!.lng!}} : {}),
    ...(typeof doc.drone === 'boolean' ? {drone: doc.drone} : {}),
  }
  return {photo}
}

export function planMigration(docs: OldDoc[]): MigrationPlan {
  const plan: MigrationPlan = {convert: [], skipped: [], alreadyDone: 0}
  for (const doc of docs) {
    const result = toPhotoDoc(doc)
    if ('photo' in result) plan.convert.push({from: doc, to: result.photo})
    else if ('done' in result) plan.alreadyDone += 1
    else plan.skipped.push({id: doc._id, title: labelOf(doc), reason: result.skip})
  }
  return plan
}

/** Splits a list into groups of at most `size`. */
export function inBatches<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size))
  return batches
}

/** The part of a Sanity transaction this uses. */
export type TransactionLike = {
  delete: (id: string) => TransactionLike
  create: (doc: {_id: string; _type: string}) => TransactionLike
  commit: () => Promise<unknown>
}

/**
 * Replaces documents with new versions that may have a different _type. Sanity won't change a
 * document's type in place (`_type` is immutable), so each old document is deleted and its
 * replacement created with the same _id, all in one transaction: either every document in the
 * group is replaced or none is.
 */
export async function replaceDocuments(
  client: {transaction: () => TransactionLike},
  docs: {_id: string; _type: string}[],
): Promise<void> {
  let tx = client.transaction()
  for (const doc of docs) tx = tx.delete(doc._id).create(doc)
  await tx.commit()
}
