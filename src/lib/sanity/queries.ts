import {defineQuery} from 'next-sanity'

/**
 * Photos live in two shapes while the content moves to one Photo type, and this reads both:
 *  - the old "pin" documents (title / photo / at / note), and
 *  - "photo" documents, in the new shape (title / image / takenAt / note) or the old
 *    "trip photo" shape (fish / image / takenAt / caption), via coalesce().
 * Once the migration has been run and the old shapes are gone, this can be simplified.
 */
export const mapQuery = defineQuery(`{
  "name": coalesce(*[_type == "siteSettings"][0].name, "Tom Vanz"),
  "tracks": *[_type == "track" && defined(route.coordinates)] | order(startedAt desc) {
    _id,
    title,
    activity,
    startedAt,
    route,
    photo
  },
  "pins": (
    *[_type == "pin" && defined(location.lat) && defined(location.lng) && defined(photo.asset)] {
      _id,
      title,
      note,
      at,
      location,
      photo,
      "isDrone": coalesce(drone, photo.asset->originalFilename match "DJI_*", false)
    }
    +
    *[_type == "photo" && defined(location.lat) && defined(location.lng) && defined(image.asset)] {
      _id,
      "title": coalesce(title, fish, ""),
      "note": coalesce(note, caption),
      "at": takenAt,
      location,
      "photo": image,
      "isDrone": coalesce(drone, image.asset->originalFilename match "DJI_*", false)
    }
  ) | order(at desc)
}`)
