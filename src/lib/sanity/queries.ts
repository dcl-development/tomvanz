import {defineQuery} from 'next-sanity'

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
    *[_type == "pin" && defined(location.lat) && defined(location.lng)] {
      _id,
      title,
      kind,
      note,
      at,
      location,
      photo,
      "isDrone": drone == true || photo.asset->originalFilename match "DJI_*"
    }
    +
    *[_type == "photo" && defined(location.lat) && defined(location.lng) && defined(image.asset)] {
      _id,
      "title": fish,
      "kind": "trip",
      "note": caption,
      "at": takenAt,
      location,
      "photo": image,
      "isDrone": drone == true || image.asset->originalFilename match "DJI_*"
    }
  ) | order(at desc)
}`)
