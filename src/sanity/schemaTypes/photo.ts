import {defineField, defineType} from 'sanity'
import {CatchImageInput} from '../components/CatchImageInput'
import {DroneInput} from '../components/DroneInput'
import {MapGeopointInput} from '../components/MapGeopointInput'
import {effectiveDrone} from '../../lib/drone'

/** One kind of thing on the map besides routes: a photo, placed by its location. */
export const photo = defineType({
  name: 'photo',
  title: 'Photo',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
    }),
    defineField({
      name: 'image',
      title: 'Photo',
      description:
        'Upload the original photo. Its GPS position and date are picked up automatically; if it has no GPS you can drop a pin on the map.',
      type: 'image',
      options: {
        accept: 'image/*',
        metadata: ['exif', 'location'],
      },
      components: {input: CatchImageInput},
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'drone',
      title: 'Drone photo',
      type: 'boolean',
      components: {input: DroneInput},
    }),
    defineField({
      name: 'location',
      title: 'Location',
      type: 'geopoint',
      description: 'Required for the map. If the photo has no GPS, drop a pin.',
      components: {input: MapGeopointInput},
      validation: (Rule) =>
        Rule.custom((value) => {
          if (value?.lat == null || value?.lng == null) {
            return 'This photo will not show on the map until you drop a pin.'
          }
          return true
        }),
    }),
    defineField({
      name: 'note',
      title: 'Note',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'takenAt',
      title: 'Date taken',
      type: 'datetime',
    }),
    // Set by the conversion: the id of the old pin this came from (so old shared links still work).
    defineField({name: 'legacyId', title: 'Old id', type: 'string', hidden: true, readOnly: true}),
  ],
  preview: {
    select: {
      title: 'title',
      media: 'image',
      lat: 'location.lat',
      drone: 'drone',
      fileName: 'image.asset.originalFilename',
    },
    prepare({title, media, lat, drone, fileName}) {
      const isDrone = effectiveDrone(drone, fileName)
      const where = lat == null ? 'No location, off the map' : undefined
      return {
        title: title || fileName || 'Photo',
        subtitle: [where, isDrone ? 'Drone' : undefined].filter(Boolean).join(' · ') || undefined,
        media,
      }
    },
  },
})
