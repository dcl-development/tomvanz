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
  "pins": *[_type == "photo" && defined(location.lat) && defined(location.lng) && defined(image.asset)] | order(takenAt desc, _id asc) {
    _id,
    legacyId,
    "title": coalesce(title, ""),
    note,
    "at": takenAt,
    location,
    "photo": image,
    "isDrone": coalesce(drone, image.asset->originalFilename match "DJI_*", false)
  }
}`)
