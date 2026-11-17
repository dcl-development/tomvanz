import {describe, expect, it} from 'vitest'

import {PILE_FIT_MAX_ZOOM, PILE_MAX_ZOOM, pileTolerancePx} from './pile'

describe('pileTolerancePx', () => {
  it('is generous when zoomed out', () => {
    expect(pileTolerancePx(3)).toBe(20)
    expect(pileTolerancePx(PILE_MAX_ZOOM - 0.1)).toBe(20)
  })

  it('only groups practically stacked photos once zoomed in', () => {
    expect(pileTolerancePx(PILE_MAX_ZOOM)).toBe(8)
    expect(pileTolerancePx(17)).toBe(8)
  })

  it('never zooms a pile in past the point where piles stop', () => {
    expect(PILE_FIT_MAX_ZOOM).toBeGreaterThanOrEqual(PILE_MAX_ZOOM)
  })
})
