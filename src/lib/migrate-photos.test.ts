import {describe, expect, it} from 'vitest'

import {inBatches, planMigration, replaceDocuments, toPhotoDoc, type OldDoc, type TransactionLike} from './migrate-photos'

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

describe('toPhotoDoc', () => {
  it('turns an old pin into a Photo, keeping its id', () => {
    const result = toPhotoDoc(pin)
    expect(result).toEqual({
      photo: {
        _id: 'pin-1',
        _type: 'photo',
        image: image(),
        title: 'Lake George',
        note: 'Over the islands.',
        takenAt: '2025-10-11T10:00:00Z',
        location: {_type: 'geopoint', lat: 43.5, lng: -73.6},
        drone: true,
      },
    })
  })

  it('turns an old trip photo into a Photo: title from fish, note from caption', () => {
    const result = toPhotoDoc(tripPhoto)
    expect('photo' in result && result.photo).toMatchObject({
      _id: 'photo-1',
      _type: 'photo',
      title: 'McDonalds Gondola',
      note: 'Up we go',
      takenAt: '2025-01-02T10:00:00Z',
    })
    // the old field names are gone
    expect('photo' in result && result.photo).not.toHaveProperty('fish')
    expect('photo' in result && result.photo).not.toHaveProperty('caption')
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
  it('sorts documents into convert, skipped and already done, drafts included', () => {
    const draft: OldDoc = {...pin, _id: 'drafts.pin-2', title: 'A draft'}
    const noPhoto: OldDoc = {...pin, _id: 'pin-3', title: 'Campsite', photo: undefined}
    const done: OldDoc = {_id: 'new-1', _type: 'photo', image: image(), title: 'Done'}
    const plan = planMigration([pin, tripPhoto, draft, noPhoto, done])
    expect(plan.convert.map((c) => c.to._id)).toEqual(['pin-1', 'photo-1', 'drafts.pin-2'])
    expect(plan.skipped).toEqual([expect.objectContaining({id: 'pin-3', title: 'Campsite'})])
    expect(plan.alreadyDone).toBe(1)
  })

  it('is safe to run twice: converted documents plan nothing the second time', () => {
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
 * A stand-in for Sanity that enforces the rules that bit us: a document's _type is immutable
 * (createOrReplace can't change it), a document can't be created twice, and a transaction is
 * all-or-nothing, applied in order.
 */
function fakeSanity(initial: OldDoc[]) {
  const store = new Map(initial.map((d) => [d._id, structuredClone(d)]))
  type Mutation = {op: 'delete'; id: string} | {op: 'create'; doc: {_id: string; _type: string}} | {op: 'createOrReplace'; doc: {_id: string; _type: string}}
  const transaction = () => {
    const mutations: Mutation[] = []
    const tx: TransactionLike & {createOrReplace: (doc: {_id: string; _type: string}) => typeof tx} = {
      delete(id) {
        mutations.push({op: 'delete', id})
        return tx
      },
      create(doc) {
        mutations.push({op: 'create', doc})
        return tx
      },
      createOrReplace(doc) {
        mutations.push({op: 'createOrReplace', doc})
        return tx
      },
      async commit() {
        const working = new Map(store)
        for (const m of mutations) {
          if (m.op === 'delete') working.delete(m.id)
          else if (m.op === 'create') {
            if (working.has(m.doc._id)) throw new Error(`document "${m.doc._id}" already exists`)
            working.set(m.doc._id, structuredClone(m.doc) as OldDoc)
          } else {
            const existing = working.get(m.doc._id)
            if (existing && existing._type !== m.doc._type) {
              throw new Error(`document "${m.doc._id}": immutable attribute "_type" may not be modified`)
            }
            working.set(m.doc._id, structuredClone(m.doc) as OldDoc)
          }
        }
        store.clear()
        working.forEach((v, k) => store.set(k, v))
      },
    }
    return tx
  }
  return {store, transaction}
}

describe('replaceDocuments (against a stand-in that behaves like Sanity)', () => {
  it('createOrReplace cannot change a type, which is what the first version tried', async () => {
    const sanity = fakeSanity([pin])
    const converted = planMigration([pin]).convert.map((c) => c.to)
    await expect(sanity.transaction().createOrReplace(converted[0]!).commit()).rejects.toThrow('immutable attribute')
    expect(sanity.store.get('pin-1')?._type).toBe('pin')
  })

  it('deleting and re-creating with the same id converts pins and trip photos, drafts included', async () => {
    const draft: OldDoc = {...pin, _id: 'drafts.pin-1', title: 'Draft copy'}
    const sanity = fakeSanity([pin, tripPhoto, draft])
    const converted = planMigration([pin, tripPhoto, draft]).convert.map((c) => c.to)
    await replaceDocuments(sanity, converted)
    expect([...sanity.store.values()].map((d) => `${d._id}:${d._type}`).sort()).toEqual([
      'drafts.pin-1:photo',
      'photo-1:photo',
      'pin-1:photo',
    ])
    expect(sanity.store.get('photo-1')).toMatchObject({title: 'McDonalds Gondola', note: 'Up we go'})
    expect(sanity.store.get('photo-1')).not.toHaveProperty('fish')
  })

  it('is all-or-nothing: if a later step in the transaction fails, nothing is applied', async () => {
    const sanity = fakeSanity([pin, tripPhoto])
    const [first] = planMigration([pin, tripPhoto]).convert.map((c) => c.to)
    // delete + create works, but creating the same id again fails, so the whole group must roll back
    const tx = sanity.transaction().delete('pin-1').create(first!).create(first!)
    await expect(tx.commit()).rejects.toThrow('already exists')
    expect([...sanity.store.values()].map((d) => `${d._id}:${d._type}`).sort()).toEqual(['photo-1:photo', 'pin-1:pin'])
  })

  it('restoring the original documents works the other way round too', async () => {
    const sanity = fakeSanity([pin, tripPhoto])
    const converted = planMigration([pin, tripPhoto]).convert.map((c) => c.to)
    await replaceDocuments(sanity, converted)
    await replaceDocuments(sanity, [pin, tripPhoto] as {_id: string; _type: string}[])
    expect(sanity.store.get('pin-1')?._type).toBe('pin')
    expect(sanity.store.get('photo-1')).toHaveProperty('fish', 'McDonalds Gondola')
  })
})
