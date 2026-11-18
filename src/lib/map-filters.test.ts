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
    {_id: 'a', title: 'Mount Marcy', note: 'Highest in NY', at: '2025-07-04T10:00:00Z', location: {lat: 44.1, lng: -73.9}},
    {_id: 'b', title: 'Lake Colden', at: '2024-07-03T10:00:00Z', isDrone: true, location: {lat: 44.1, lng: -73.98}},
    {_id: 'c', title: 'Undated spot', location: {lat: 44.2, lng: -73.8}},
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

  it('filters by route kind, which drops photos', () => {
    const hikes = applyMapFilters(data, {...emptyMapFilters, types: ['track:hike']})
    expect(hikes.pins).toEqual([])
    expect(hikes.tracks.map((t) => t._id)).toEqual(['t'])

    const bikes = applyMapFilters(data, {...emptyMapFilters, types: ['track:bike']})
    expect(bikes.tracks).toEqual([])
  })

  it('also searches the word drone for drone photos', () => {
    const drone = applyMapFilters(data, {...emptyMapFilters, query: 'drone'})
    expect(drone.pins.map((p) => p._id)).toEqual(['b'])
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

  it('Photos and a specific kind of route combine', () => {
    const mixed = applyMapFilters(data, {...emptyMapFilters, types: ['pin:all', 'track:hike']})
    expect(mixed.pins).toHaveLength(3)
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
    const some = applyMapFilters(data, {...emptyMapFilters, drone: true, query: 'drone'})
    expect(some.pins.map((p) => p._id)).toEqual(['b'])
    const none = applyMapFilters(data, {...emptyMapFilters, drone: true, query: 'nothing matches this'})
    expect(none.pins).toEqual([])
  })

  it('only offers the filter when some photo is a drone photo', () => {
    expect(filterOptions(data).hasDrone).toBe(true)
    expect(filterOptions({...data, pins: data.pins.map((p) => ({...p, isDrone: false}))}).hasDrone).toBe(false)
  })
})

describe('filterOptions', () => {
  it('only offers route kinds that exist', () => {
    const {typeOptions} = filterOptions(data)
    expect(typeOptions.map((o) => o.value)).toEqual([
      'pin:all',
      'track:all',
      'track:hike',
    ])
  })
})

describe('resultList icons', () => {
  it('carries the activity for routes, and labels photos Photo or Drone', () => {
    const items = resultList(data, () => null)
    expect(items.find((i) => i.kind === 'track')?.activity).toBe('hike')
    expect(items.find((i) => i.id === 'a')).toMatchObject({kind: 'pin', label: 'Photo'})
    expect(items.find((i) => i.id === 'b')).toMatchObject({kind: 'pin', label: 'Drone'})
  })
})

describe('resultList', () => {
  it('lists dated items newest first, with undated ones last', () => {
    const titles = resultList(data, () => null).map((r) => r.title)
    expect(titles).toEqual(['Mount Marcy', 'Algonquin loop', 'Lake Colden', 'Undated spot'])
  })
})
