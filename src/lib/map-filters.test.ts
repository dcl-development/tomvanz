import {describe, expect, it} from 'vitest'

import {
  applyMapFilters,
  emptyMapFilters,
  filterOptions,
  filtersActive,
  resultList,
} from './map-filters'
import type {MapData} from './sanity/types'

const data: MapData = {
  name: 'test',
  pins: [
    {_id: 'a', title: 'Mount Marcy', kind: 'mountain', note: 'Highest in NY', at: '2025-07-04T10:00:00Z', location: {lat: 44.1, lng: -73.9}},
    {_id: 'b', title: 'Lake Colden', kind: 'place', at: '2024-07-03T10:00:00Z', isDrone: true, location: {lat: 44.1, lng: -73.98}},
    {_id: 'c', title: 'Undated spot', kind: 'trip', location: {lat: 44.2, lng: -73.8}},
  ],
  tracks: [
    {
      _id: 't',
      title: 'Algonquin loop',
      activity: 'hike',
      startedAt: '2025-07-03T08:00:00Z',
      route: {type: 'LineString', coordinates: '[[0,0],[1,1]]'},
    },
  ],
}

describe('applyMapFilters', () => {
  it('returns everything when no filter is set', () => {
    expect(filtersActive(emptyMapFilters)).toBe(false)
    expect(applyMapFilters(data, emptyMapFilters)).toBe(data)
  })

  it('matches the search text against titles and notes, every word required', () => {
    const byNote = applyMapFilters(data, {...emptyMapFilters, query: 'highest ny'})
    expect(byNote.pins.map((p) => p._id)).toEqual(['a'])
    expect(byNote.tracks).toEqual([])
  })

  it('filters by type across photos and routes', () => {
    const hikes = applyMapFilters(data, {...emptyMapFilters, types: ['track:hike']})
    expect(hikes.pins).toEqual([])
    expect(hikes.tracks.map((t) => t._id)).toEqual(['t'])

    const mixed = applyMapFilters(data, {...emptyMapFilters, types: ['pin:place', 'track:hike']})
    expect(mixed.pins.map((p) => p._id)).toEqual(['b'])
    expect(mixed.tracks).toHaveLength(1)
  })

  it('filters by year and drops undated items when a year is chosen', () => {
    const y2025 = applyMapFilters(data, {...emptyMapFilters, year: '2025'})
    expect(y2025.pins.map((p) => p._id)).toEqual(['a'])
    expect(y2025.tracks).toHaveLength(1)
  })
})

describe('Photos / Routes group chips', () => {
  it('Photos keeps every kind of photo and drops routes', () => {
    const photos = applyMapFilters(data, {...emptyMapFilters, types: ['pin:all']})
    expect(photos.pins).toHaveLength(3)
    expect(photos.tracks).toEqual([])
  })

  it('Routes keeps every route and drops photos', () => {
    const routes = applyMapFilters(data, {...emptyMapFilters, types: ['track:all']})
    expect(routes.pins).toEqual([])
    expect(routes.tracks).toHaveLength(1)
  })

  it('combine with specific kinds', () => {
    const mixed = applyMapFilters(data, {...emptyMapFilters, types: ['track:all', 'pin:mountain']})
    expect(mixed.pins.map((p) => p._id)).toEqual(['a'])
    expect(mixed.tracks).toHaveLength(1)
  })
})

describe('drone filter', () => {
  it('keeps only drone photos and drops routes', () => {
    const drone = applyMapFilters(data, {...emptyMapFilters, drone: true})
    expect(drone.pins.map((p) => p._id)).toEqual(['b'])
    expect(drone.tracks).toEqual([])
    expect(filtersActive({...emptyMapFilters, drone: true})).toBe(true)
  })

  it('combines with the other filters', () => {
    const none = applyMapFilters(data, {...emptyMapFilters, drone: true, year: '2025'})
    expect(none.pins).toEqual([])
    const some = applyMapFilters(data, {...emptyMapFilters, drone: true, year: '2024'})
    expect(some.pins.map((p) => p._id)).toEqual(['b'])
  })

  it('only offers the filter when some photo is a drone photo', () => {
    expect(filterOptions(data).hasDrone).toBe(true)
    expect(filterOptions({...data, pins: data.pins.map((p) => ({...p, isDrone: false}))}).hasDrone).toBe(false)
  })
})

describe('filterOptions', () => {
  it('only offers kinds and years that exist, newest year first', () => {
    const {typeOptions, years} = filterOptions(data)
    expect(typeOptions.map((o) => o.value)).toEqual([
      'pin:all',
      'track:all',
      'pin:trip',
      'pin:mountain',
      'pin:place',
      'track:hike',
    ])
    expect(years).toEqual(['2025', '2024'])
  })
})

describe('resultList icons', () => {
  it('carries the activity for routes and the kind for photos', () => {
    const items = resultList(data, 'az', () => null)
    expect(items.find((i) => i.kind === 'track')?.activity).toBe('hike')
    expect(items.find((i) => i.id === 'a')).toMatchObject({kind: 'pin', pinKind: 'mountain'})
  })
})

describe('resultList', () => {
  it('sorts newest, oldest and A–Z, with undated items last by date', () => {
    const titles = (sort: 'newest' | 'oldest' | 'az') => resultList(data, sort, () => null).map((r) => r.title)
    expect(titles('newest')).toEqual(['Mount Marcy', 'Algonquin loop', 'Lake Colden', 'Undated spot'])
    expect(titles('oldest')).toEqual(['Lake Colden', 'Algonquin loop', 'Mount Marcy', 'Undated spot'])
    expect(titles('az')).toEqual(['Algonquin loop', 'Lake Colden', 'Mount Marcy', 'Undated spot'])
  })
})
