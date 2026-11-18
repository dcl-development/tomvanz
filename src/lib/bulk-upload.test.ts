import {readFileSync} from 'node:fs'
import {describe, expect, it} from 'vitest'

import {isPhotoFile, photoFromUpload, readPhotoMeta, runPool} from './bulk-upload'

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url)))

describe('readPhotoMeta', () => {
  it('reads GPS and the time taken from a photo that has them', async () => {
    const meta = await readPhotoMeta(fixture('drone-gps.jpg'))
    expect(meta.lat).toBeCloseTo(44.1128, 3)
    expect(meta.lng).toBeCloseTo(-73.9239, 3) // west is negative
    expect(meta.takenAt).toMatch(/^2026-10-1[01]T/)
  })

  it('returns nothing (and does not throw) for a photo without GPS or dates', async () => {
    expect(await readPhotoMeta(fixture('no-gps.jpg'))).toEqual({})
  })

  it('returns nothing for data that is not an image at all', async () => {
    expect(await readPhotoMeta(new Uint8Array([1, 2, 3, 4]))).toEqual({})
  })
})

describe('isPhotoFile', () => {
  it('accepts photos by type or extension and rejects other files', () => {
    expect(isPhotoFile({name: 'DJI_0336.JPG', type: 'image/jpeg'})).toBe(true)
    expect(isPhotoFile({name: 'IMG_1.HEIC', type: ''})).toBe(true)
    expect(isPhotoFile({name: 'clip.mp4', type: 'video/mp4'})).toBe(false)
    expect(isPhotoFile({name: 'DJI_0336.SRT', type: ''})).toBe(false)
  })
})

describe('photoFromUpload', () => {
  it('builds a Photo with the image, location and date when known', () => {
    const doc = photoFromUpload('image-abc-800x600-jpg', {lat: 44.1, lng: -73.9, takenAt: '2026-10-11T10:00:00.000Z'})
    expect(doc).toEqual({
      _type: 'photo',
      image: {_type: 'image', asset: {_type: 'reference', _ref: 'image-abc-800x600-jpg'}},
      location: {_type: 'geopoint', lat: 44.1, lng: -73.9},
      takenAt: '2026-10-11T10:00:00.000Z',
    })
  })

  it('leaves out location and date when the photo had none, and never sets a title', () => {
    const doc = photoFromUpload('image-abc-800x600-jpg', {})
    expect(doc).not.toHaveProperty('location')
    expect(doc).not.toHaveProperty('takenAt')
    expect(doc).not.toHaveProperty('title')
  })
})

describe('runPool', () => {
  it('runs everything but never more than the limit at once', async () => {
    let running = 0
    let peak = 0
    const done: number[] = []
    await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      running -= 1
      done.push(n)
    })
    expect(done.sort()).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(peak).toBeLessThanOrEqual(3)
  })
})
