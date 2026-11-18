import type {MapData, SelectedItem} from '@/lib/sanity/types'

export function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

/** The photo or route named in a shared link (`?photo=` / `?track=`), if it still exists. */
export function sharedItem(data: MapData, params: {[key: string]: string | string[] | undefined}) {
  const photoId = first(params.photo)
  if (photoId) {
    // Links made before the content was converted use the photo's old id (the old pin's id).
    const pin = data.pins.find((item) => item._id === photoId || item.legacyId === photoId)
    if (pin) return {selected: {kind: 'pin', id: pin._id} as SelectedItem, title: pin.title, photo: pin.photo}
  }
  const trackId = first(params.track)
  if (trackId) {
    const track = data.tracks.find((item) => item._id === trackId)
    if (track) {
      return {selected: {kind: 'track', id: track._id, fly: true} as SelectedItem, title: track.title, photo: track.photo}
    }
  }
  return null
}
