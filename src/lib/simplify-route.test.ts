import {describe, expect, it} from 'vitest'

import {
  douglasPeucker,
  haversineMeters,
  lineLengthMeters,
  removeConsecutiveDuplicates,
  roundCoordinates,
  simplifyRouteForDisplay,
} from './simplify-route'

describe('haversineMeters', () => {
  it('is zero for identical points', () => {
    expect(haversineMeters([-73.9, 44.1], [-73.9, 44.1])).toBe(0)
  })

  it('matches a known short segment (~111 m per 0.001° lat)', () => {
    const d = haversineMeters([-73.9, 44.1], [-73.9, 44.101])
    expect(d).toBeGreaterThan(100)
    expect(d).toBeLessThan(125)
  })
})

describe('removeConsecutiveDuplicates', () => {
  it('collapses runs of identical points', () => {
    expect(
      removeConsecutiveDuplicates([
        [1, 2],
        [1, 2],
        [3, 4],
        [3, 4],
        [3, 4],
        [5, 6],
      ]),
    ).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ])
  })
})

describe('douglasPeucker', () => {
  it('keeps endpoints and drops a point within tolerance', () => {
    const zigzag: [number, number][] = [
      [-74, 40],
      [-74, 40.00001],
      [-73.999, 40],
    ]
    const out = douglasPeucker(zigzag, 50)
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual(zigzag[0])
    expect(out[1]).toEqual(zigzag[2])
  })
})

describe('roundCoordinates', () => {
  it('rounds to five decimal places', () => {
    expect(roundCoordinates([[1.23456789, -2.987654321]])).toEqual([[1.23457, -2.98765]])
  })
})

describe('lineLengthMeters', () => {
  it('sums segment lengths', () => {
    const coords: [number, number][] = [
      [-73.9, 44.1],
      [-73.9, 44.101],
      [-73.899, 44.101],
    ]
    const total = lineLengthMeters(coords)
    const direct = haversineMeters(coords[0]!, coords[2]!)
    expect(total).toBeGreaterThan(direct)
    expect(total).toBeLessThan(direct * 1.5)
  })
})

describe('simplifyRouteForDisplay', () => {
  it('reduces dense collinear noise but keeps shape', () => {
    const dense: [number, number][] = []
    for (let i = 0; i < 100; i += 1) {
      dense.push([-74 + i * 0.0001, 40 + i * 0.00005])
    }
    const out = simplifyRouteForDisplay(dense)
    expect(out.length).toBeLessThan(dense.length)
    expect(out.length).toBeGreaterThanOrEqual(2)
    expect(out[0]).toEqual(roundCoordinates([dense[0]!])[0])
    expect(out[out.length - 1]).toEqual(roundCoordinates([dense[dense.length - 1]!])[0])
  })
})