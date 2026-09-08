import {defineField, defineType} from 'sanity'
import {CatchImageInput} from '../components/CatchImageInput'
import {MapGeopointInput} from '../components/MapGeopointInput'

export const photo = defineType({
  name: 'photo',
  title: 'Catch photo',
  type: 'document',
  fields: [
    defineField({
      name: 'fish',
      title: 'Fish',
      type: 'string',
      description: 'What he caught.',
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
            return 'This catch will not show on the map until you drop a pin.'
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
  ],
  preview: {
    select: {
      fish: 'fish',
      media: 'image',
      lat: 'location.lat',
    },
    prepare({fish, media, lat}) {
      return {
        title: fish || 'Catch',
        subtitle: lat == null ? 'No location — off the map' : undefined,
        media,
      }
    },
  },
})
