import {describe, expect, it} from 'vitest'

import {inBatches, planMigration, toPhotoDoc, type OldDoc} from './migrate-photos'

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
