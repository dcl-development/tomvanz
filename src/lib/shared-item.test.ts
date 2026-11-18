import {describe, expect, it} from 'vitest'

import {sharedItem} from './shared-item'
import type {MapData} from './sanity/types'

const data: MapData = {
  name: 't',
  pins: [
    {_id: 'photo-abc', legacyId: 'abc', title: 'Converted', location: {lat: 1, lng: 2}},
    {_id: 'plain', title: 'Never an old pin', location: {lat: 3, lng: 4}},
  ],
  tracks: [{_id: 't1', title: 'Loop', activity: 'hike', route: {type: 'LineString', coordinates: '[]'}}],
}

describe('sharedItem', () => {
  it('opens a photo by its id', () => {
    expect(sharedItem(data, {photo: 'plain'})?.selected).toEqual({kind: 'pin', id: 'plain'})
  })

  it("opens a converted photo from a link made with its old pin's id", () => {
    const shared = sharedItem(data, {photo: 'abc'})
    expect(shared?.selected).toEqual({kind: 'pin', id: 'photo-abc'})
    expect(shared?.title).toBe('Converted')
  })

  it('opens a route, flying to it, and returns nothing for an unknown id', () => {
    expect(sharedItem(data, {track: 't1'})?.selected).toEqual({kind: 'track', id: 't1', fly: true})
    expect(sharedItem(data, {photo: 'nope'})).toBeNull()
  })
})
