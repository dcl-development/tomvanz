import {defineQuery} from 'next-sanity'

export const mapQuery = defineQuery(`{
  "name": coalesce(*[_type == "siteSettings"][0].name, "Tom Vanz"),
  "photos": *[_type == "photo" && defined(location.lat) && defined(location.lng) && defined(image.asset)] | order(takenAt desc) {
    _id,
    fish,
    caption,
    takenAt,
    location,
    image
  },
  "tracks": *[_type == "track" && defined(route.coordinates)] | order(startedAt desc) {
    _id,
    title,
    activity,
    startedAt,
    route
  },
  "pins": *[_type == "pin" && defined(location.lat) && defined(location.lng)] | order(at desc) {
    _id,
    title,
    kind,
    note,
    at,
    location,
    photo
  }
}`)
