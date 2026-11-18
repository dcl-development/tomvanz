import {describe, expect, it} from 'vitest'

import {
  baseId,
  convertDocuments,
  inBatches,
  newIdFor,
  planMigration,
  restoreDocuments,
  toPhotoDoc,
  type OldDoc,
  type TransactionLike,
} from './migrate-photos'

const image = (ref = 'image-abc-800x600-jpg') => ({_type: 'image', asset: {_type: 'reference', _ref: ref}})

const pin: OldDoc = {
  _id: 'pin-1',
  _type: 'pin',
  _createdAt: '2026-11-01T10:00:00Z',
  title: 'Lake George',
  kind: 'place',
  photo: image(),
  note: 'Over the islands.',
  at: '2025-10-11T10:00:00Z',
  location: {_type: 'geopoint', lat: 43.5, lng: -73.6},
  drone: true,
}

const tripPhoto: OldDoc = {
  _id: 'photo-1',
  _type: 'photo',
  _createdAt: '2026-09-01T10:00:00Z',
  fish: 'McDonalds Gondola',
  caption: 'Up we go',
  image: image('image-def-800x600-jpg'),
  takenAt: '2025-01-02T10:00:00Z',
  location: {_type: 'geopoint', lat: 44, lng: -72},
}

describe('ids', () => {
  it('an old pin gets a new id derived from its own, and a draft stays a draft', () => {
    expect(newIdFor('abc-123')).toBe('photo-abc-123')
    expect(newIdFor('drafts.abc-123')).toBe('drafts.photo-abc-123')
    expect(baseId('drafts.abc-123')).toBe('abc-123')
    expect(baseId('abc-123')).toBe('abc-123')
  })
})

describe('toPhotoDoc', () => {
  it("turns an old pin into a new Photo that remembers the pin's id", () => {
    expect(toPhotoDoc(pin)).toEqual({
      photo: {
        _id: 'photo-pin-1',
        _type: 'photo',
        legacyId: 'pin-1',
        image: image(),
        title: 'Lake George',
        note: 'Over the islands.',
        takenAt: '2025-10-11T10:00:00Z',
        location: {_type: 'geopoint', lat: 43.5, lng: -73.6},
        drone: true,
      },
    })
  })

  it('turns an old trip photo into a Photo in place: title from fish, note from caption', () => {
    const result = toPhotoDoc(tripPhoto)
    const photo = 'photo' in result ? result.photo : null
    expect(photo).toMatchObject({_id: 'photo-1', _type: 'photo', title: 'McDonalds Gondola', note: 'Up we go', takenAt: '2025-01-02T10:00:00Z'})
    expect(photo).not.toHaveProperty('fish')
    expect(photo).not.toHaveProperty('caption')
    expect(photo).not.toHaveProperty('legacyId')
  })

  it('drops the old kind, blank titles and empty notes, and keeps a crop or hotspot', () => {
    const withCrop: OldDoc = {
      ...pin,
      title: '   ',
      note: '',
      photo: {...image(), hotspot: {x: 0.4, y: 0.6, height: 0.5, width: 0.5}, crop: {top: 0.1, bottom: 0.1, left: 0, right: 0}},
    }
    const result = toPhotoDoc(withCrop)
    const photo = 'photo' in result ? result.photo : null
    expect(photo).not.toHaveProperty('kind')
    expect(photo).not.toHaveProperty('title')
    expect(photo).not.toHaveProperty('note')
    expect(photo?.image).toHaveProperty('hotspot')
    expect(photo?.image).toHaveProperty('crop')
  })

  it('leaves out the location when the pin has none, rather than inventing one', () => {
    const result = toPhotoDoc({...pin, location: undefined})
    expect('photo' in result && result.photo).not.toHaveProperty('location')
  })

  it('skips a pin with no photo, and anything that is not a pin or photo', () => {
    expect(toPhotoDoc({...pin, photo: undefined})).toHaveProperty('skip')
    expect(toPhotoDoc({_id: 'x', _type: 'track'})).toHaveProperty('skip')
  })

  it('treats a photo already in the new shape as done', () => {
    expect(toPhotoDoc({_id: 'p', _type: 'photo', image: image(), title: 'Already new'})).toEqual({done: true})
  })
})

describe('planMigration', () => {
  it('sorts documents into convert, skipped and already done, drafts included, old pins first', () => {
    const draft: OldDoc = {...pin, _id: 'drafts.pin-2', title: 'A draft'}
    const noPhoto: OldDoc = {...pin, _id: 'pin-3', title: 'Campsite', photo: undefined}
    const done: OldDoc = {_id: 'new-1', _type: 'photo', image: image(), title: 'Done'}
    const plan = planMigration([tripPhoto, pin, draft, noPhoto, done])
    expect(plan.convert.map((c) => c.to._id)).toEqual(['photo-pin-1', 'drafts.photo-pin-2', 'photo-1'])
    expect(plan.skipped).toEqual([expect.objectContaining({id: 'pin-3', title: 'Campsite'})])
    expect(plan.alreadyDone).toBe(1)
  })

  it('is safe to run twice: once converted (and the old pins gone) nothing is planned', () => {
    const first = planMigration([pin, tripPhoto])
    const converted = first.convert.map((c) => c.to as unknown as OldDoc)
    const second = planMigration(converted)
    expect(second.convert).toEqual([])
    expect(second.alreadyDone).toBe(2)
  })
})

describe('inBatches', () => {
  it('splits into groups of at most the size', () => {
    expect(inBatches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(inBatches([], 3)).toEqual([])
  })
})

/**
 * A stand-in for Sanity that enforces the rules that bit us on the real thing:
 *  - a document's _type is immutable, even when the document is deleted and re-created with the
 *    same id inside one transaction;
 *  - a document can't be created twice;
 *  - a transaction is all-or-nothing, applied in order.
 * It also records a snapshot after every committed transaction.
 */
function fakeSanity(initial: OldDoc[], options: {failCommitNumber?: number} = {}) {
  const store = new Map(initial.map((d) => [d._id, structuredClone(d)]))
  const snapshots: string[][] = []
  let commits = 0
  const snapshot = () => [...store.values()].map((d) => `${d._id}:${d._type}`).sort()
  const transaction = () => {
    type Mutation = {op: 'delete'; id: string} | {op: 'create' | 'createOrReplace'; doc: {_id: string; _type: string}}
    const mutations: Mutation[] = []
    const tx = {
      delete(id: string) {
        mutations.push({op: 'delete', id})
        return tx
      },
      create(doc: {_id: string; _type: string}) {
        mutations.push({op: 'create', doc})
        return tx
      },
      createOrReplace(doc: {_id: string; _type: string}) {
        mutations.push({op: 'createOrReplace', doc})
        return tx
      },
      async commit() {
        commits += 1
        if (options.failCommitNumber === commits) throw new Error('server rejected the transaction')
        const originalTypes = new Map([...store].map(([id, d]) => [id, d._type]))
        const working = new Map(store)
        for (const m of mutations) {
          if (m.op === 'delete') {
            working.delete(m.id)
            continue
          }
          const originalType = originalTypes.get(m.doc._id)
          if (originalType && originalType !== m.doc._type) {
            throw new Error(`document "${m.doc._id}": immutable attribute "_type" may not be modified`)
          }
          if (m.op === 'create' && working.has(m.doc._id)) throw new Error(`document "${m.doc._id}" already exists`)
          working.set(m.doc._id, structuredClone(m.doc) as OldDoc)
        }
        store.clear()
        working.forEach((v, k) => store.set(k, v))
        snapshots.push(snapshot())
      },
    }
    return tx as typeof tx & TransactionLike
  }
  return {store, transaction, snapshots, snapshot}
}

const planFor = (docs: OldDoc[]) => planMigration(docs).convert

describe('against a stand-in that behaves like the real Sanity', () => {
  it('reproduces both failures from the real dataset: createOrReplace and delete + create both change the type', async () => {
    const sanity = fakeSanity([pin])
    const [item] = planFor([pin])
    const sameId = {...item!.to, _id: 'pin-1'}
    await expect(sanity.transaction().createOrReplace(sameId).commit()).rejects.toThrow('immutable attribute')
    await expect(sanity.transaction().delete('pin-1').create(sameId).commit()).rejects.toThrow('immutable attribute')
    expect(sanity.store.get('pin-1')?._type).toBe('pin')
  })

  it('converts pins to new Photos (drafts stay drafts) and trip photos in place, removing the old pins', async () => {
    const draft: OldDoc = {...pin, _id: 'drafts.pin-1', title: 'Draft copy'}
    const sanity = fakeSanity([pin, draft, tripPhoto])
    await convertDocuments(sanity, planFor([pin, draft, tripPhoto]))
    expect(sanity.snapshot()).toEqual(['drafts.photo-pin-1:photo', 'photo-1:photo', 'photo-pin-1:photo'])
    expect(sanity.store.get('photo-pin-1')).toMatchObject({title: 'Lake George', legacyId: 'pin-1'})
    expect(sanity.store.get('photo-1')).toMatchObject({title: 'McDonalds Gondola', note: 'Up we go'})
    expect(sanity.store.get('photo-1')).not.toHaveProperty('fish')
  })

  it('never leaves a gap: the new Photo exists before the old pin is removed', async () => {
    const sanity = fakeSanity([pin])
    await convertDocuments(sanity, planFor([pin]))
    // first committed step: both exist; second: only the new one
    expect(sanity.snapshots).toEqual([['photo-pin-1:photo', 'pin-1:pin'], ['photo-pin-1:photo']])
  })

  it('if removing the old pins fails, nothing is lost, and running again finishes the job with no duplicates', async () => {
    const sanity = fakeSanity([pin, tripPhoto], {failCommitNumber: 2})
    await expect(convertDocuments(sanity, planFor([pin, tripPhoto]))).rejects.toThrow('server rejected')
    // the new Photo exists alongside the old pin; the pin is still there
    expect(sanity.snapshot()).toEqual(['photo-1:photo', 'photo-pin-1:photo', 'pin-1:pin'])

    // run again from a fresh scan of what's there now
    await convertDocuments(sanity, planFor([...sanity.store.values()]))
    expect(sanity.snapshot()).toEqual(['photo-1:photo', 'photo-pin-1:photo'])
  })

  it('restoring puts the originals back: pins return and their new Photos go, trip photos are restored in place', async () => {
    const sanity = fakeSanity([pin, tripPhoto])
    await convertDocuments(sanity, planFor([pin, tripPhoto]))
    await restoreDocuments(sanity, [pin, tripPhoto] as {_id: string; _type: string}[])
    expect(sanity.snapshot()).toEqual(['photo-1:photo', 'pin-1:pin'])
    expect(sanity.store.get('pin-1')).toMatchObject({title: 'Lake George', kind: 'place'})
    expect(sanity.store.get('photo-1')).toHaveProperty('fish', 'McDonalds Gondola')
  })
})
