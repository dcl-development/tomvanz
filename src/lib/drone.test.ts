import {describe, expect, it} from 'vitest'

import {effectiveDrone, isDroneFileName} from './drone'

describe('isDroneFileName', () => {
  it('recognises DJI photo names, whatever the capitalisation', () => {
    expect(isDroneFileName('DJI_0336.JPG')).toBe(true)
    expect(isDroneFileName('dji_0336.jpg')).toBe(true)
    expect(isDroneFileName('dji_fly_20261011_110952_91_photo_optimized.jpg')).toBe(true)
  })

  it('does not match phone photos, screenshots or missing names', () => {
    expect(isDroneFileName('IMG_3952.jpeg')).toBe(false)
    expect(isDroneFileName('Screenshot 2026-11-01 at 9.41.12 AM.png')).toBe(false)
    expect(isDroneFileName('my_DJI_0336.jpg')).toBe(false)
    expect(isDroneFileName(null)).toBe(false)
    expect(isDroneFileName(undefined)).toBe(false)
  })
})

describe('effectiveDrone', () => {
  it('follows the file name when nothing was set by hand', () => {
    expect(effectiveDrone(undefined, 'DJI_0336.JPG')).toBe(true)
    expect(effectiveDrone(null, 'IMG_1.jpeg')).toBe(false)
  })

  it('lets a hand-set value win in both directions', () => {
    expect(effectiveDrone(true, 'Screenshot.png')).toBe(true)
    expect(effectiveDrone(false, 'DJI_0336.JPG')).toBe(false)
  })
})
