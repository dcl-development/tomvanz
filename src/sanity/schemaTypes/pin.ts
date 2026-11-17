import {defineField, defineType} from 'sanity'
import {CatchImageInput} from '../components/CatchImageInput'
import {MapGeopointInput} from '../components/MapGeopointInput'

export const pin = defineType({
  name: 'pin',
  title: 'Pin',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      options: {
        list: [
          {title: 'Trip', value: 'trip'},
          {title: 'Mountain', value: 'mountain'},
          {title: 'Park', value: 'park'},
          {title: 'Place', value: 'place'},
        ],
        layout: 'radio',
      },
      initialValue: 'place',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'location',
      title: 'Location',
      type: 'geopoint',
      components: {input: MapGeopointInput},
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'photo',
      title: 'Photo',
      type: 'image',
      description: 'Optional. If it has GPS, the pin drops itself.',
      options: {
        accept: 'image/*',
        hotspot: true,
        metadata: ['exif', 'location'],
      },
      components: {input: CatchImageInput},
    }),
    defineField({
      name: 'note',
      title: 'Note',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'at',
      title: 'Date',
      type: 'datetime',
    }),
    defineField({
      name: 'drone',
      title: 'Drone photo',
      type: 'boolean',
      description:
        'Drone photos are spotted automatically from their DJI file names. Turn this on for one that was renamed along the way.',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      kind: 'kind',
      media: 'photo',
      drone: 'drone',
      fileName: 'photo.asset.originalFilename',
    },
    prepare({title, kind, media, drone, fileName}) {
      const isDrone = drone === true || /^DJI_/i.test(fileName ?? '')
      return {
        title: title || 'Pin',
        subtitle: isDrone ? `${kind} · Drone` : kind,
        media,
      }
    },
  },
})
