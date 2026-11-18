/**
 * Moves the old "pin" documents and "trip photo" documents into the one Photo shape:
 *   image · title · location · note · takenAt · drone
 *
 * Pure logic only (no Sanity calls), so it can be tested and dry-run. The Studio tool does the
 * reading and writing.
 *
 * Sanity won't change a document's type in place (`_type` is immutable, even via a delete and
 * re-create of the same id in one step), so an old pin becomes a NEW photo document with a new id,
 * created first, and the old pin is deleted only afterwards: there's never a moment when the photo
 * is missing. The new document remembers the old id (`legacyId`) so old shared links keep working.
 * Old trip photos are already `photo` documents, so they're converted in place.
 *
 * The new ids are derived from the old ones, so running it twice (e.g. after a half-finished run)
 * is harmless: it simply fills in whatever is missing. The backup file keeps the originals in full.
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
  /** The id of the old pin this came from, so links made before the conversion still open it. */
  legacyId?: string
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

const DRAFT_PREFIX = 'drafts.'

/** The published id, whether given a draft id or not. */
export const baseId = (id: string) => (id.startsWith(DRAFT_PREFIX) ? id.slice(DRAFT_PREFIX.length) : id)

/** The id of the Photo an old pin becomes. A draft stays a draft. */
export const newIdFor = (oldId: string) => `${oldId.startsWith(DRAFT_PREFIX) ? DRAFT_PREFIX : ''}photo-${baseId(oldId)}`

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
    _id: isPin ? newIdFor(doc._id) : doc._id,
    _type: 'photo',
    ...(isPin ? {legacyId: baseId(doc._id)} : {}),
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
  // Old pins (which get new ids) go first, so a trial run on the first document tests the riskier path.
  plan.convert.sort((a, b) => Number(b.from._type === 'pin') - Number(a.from._type === 'pin'))
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
  createOrReplace: (doc: {_id: string; _type: string}) => TransactionLike
  delete: (id: string) => TransactionLike
  commit: () => Promise<unknown>
}

type Connection = {transaction: () => TransactionLike}

/**
 * Converts documents in two steps, each all-or-nothing:
 *  1. create (or refresh) every new Photo;
 *  2. delete the old pins that those replaced.
 * If step 2 fails the new Photos already exist, nothing is lost, and running again finishes the job.
 */
export async function convertDocuments(
  client: Connection,
  items: {from: {_id: string}; to: {_id: string; _type: string}}[],
): Promise<void> {
  let create = client.transaction()
  for (const item of items) create = create.createOrReplace(item.to)
  await create.commit()

  const removals = items.filter((item) => item.from._id !== item.to._id)
  if (removals.length > 0) {
    let remove = client.transaction()
    for (const item of removals) remove = remove.delete(item.from._id)
    await remove.commit()
  }
}

/**
 * Puts original documents back (from a backup): recreate each original, then remove the Photo
 * that an old pin had become. Old trip photos are restored in place.
 */
export async function restoreDocuments(client: Connection, originals: {_id: string; _type: string}[]): Promise<void> {
  let create = client.transaction()
  for (const doc of originals) create = create.createOrReplace(doc)
  await create.commit()

  const removals = originals.filter((doc) => doc._type === 'pin')
  if (removals.length > 0) {
    let remove = client.transaction()
    for (const doc of removals) remove = remove.delete(newIdFor(doc._id))
    await remove.commit()
  }
}
