import {defineField, defineType} from 'sanity'
import {CatchImageInput} from '../components/CatchImageInput'
import {DroneInput} from '../components/DroneInput'
import {MapGeopointInput} from '../components/MapGeopointInput'
import {effectiveDrone} from '../../lib/drone'

export const photo = defineType({
  name: 'photo',
  title: 'Trip photo',
  type: 'document',
  fields: [
    defineField({
      name: 'fish',
      title: 'Title',
      type: 'string',
      description: 'Name of the trip.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'image',
      description: 'Upload the original photo. If it has no GPS, you will see a warning and can drop a pin on the map.',
      type: 'image',
      options: {
        accept: 'image/*',
        metadata: ['exif', 'location'],
      },
      components: {input: CatchImageInput},
      validation: (Rule) => Rule.required(),
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
            return 'This trip will not show on the map until you drop a pin.'
          }
          return true
        }),
    }),
    defineField({
      name: 'caption',
      title: 'Caption',
      type: 'string',
    }),
    defineField({
      name: 'takenAt',
      title: 'Date',
      type: 'datetime',
    }),
    defineField({
      name: 'drone',
      title: 'Drone photo',
      type: 'boolean',
      description:
        'Spotted automatically from DJI file names. Switch it on for one that has no drone file name (a screenshot, say), or off if it was spotted by mistake.',
      components: {input: DroneInput},
    }),
  ],
  preview: {
    select: {
      fish: 'fish',
      media: 'image',
      lat: 'location.lat',
      drone: 'drone',
      fileName: 'image.asset.originalFilename',
    },
    prepare({fish, media, lat, drone, fileName}) {
      const isDrone = effectiveDrone(drone, fileName)
      const where = lat == null ? 'No location — off the map' : undefined
      return {
        title: fish || 'Trip',
        subtitle: [where, isDrone ? 'Drone' : undefined].filter(Boolean).join(' · ') || undefined,
        media,
      }
    },
  },
})
