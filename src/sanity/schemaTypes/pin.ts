import {defineField, defineType} from 'sanity'
import {CatchImageInput} from '../components/CatchImageInput'
import {DroneInput} from '../components/DroneInput'
import {MapGeopointInput} from '../components/MapGeopointInput'
import {effectiveDrone} from '../../lib/drone'

export const pin = defineType({
  name: 'pin',
  title: 'Pin',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Optional. Bulk-uploaded photos start without one.',
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
        'Spotted automatically from DJI file names. Switch it on for one that has no drone file name (a screenshot, say), or off if it was spotted by mistake.',
      components: {input: DroneInput},
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
      const isDrone = effectiveDrone(drone, fileName)
      return {
        title: title || fileName || 'Photo',
        subtitle: isDrone ? `${kind} · Drone` : kind,
        media,
      }
    },
  },
})
