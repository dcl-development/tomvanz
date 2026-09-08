import {defineField, defineType} from 'sanity'
import {GpxInput} from '../components/GpxInput'

export const track = defineType({
  name: 'track',
  title: 'Track',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'activity',
      title: 'Activity',
      type: 'string',
      options: {
        list: [
          {title: 'Bike', value: 'bike'},
          {title: 'Hike', value: 'hike'},
          {title: 'Other', value: 'other'},
        ],
        layout: 'radio',
      },
      initialValue: 'bike',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'photo',
      title: 'Photo',
      type: 'image',
      description: 'Optional cover for the map card.',
      options: {hotspot: true},
    }),
    defineField({
      name: 'file',
      title: 'GPX',
      type: 'file',
      options: {accept: '.gpx,application/gpx+xml,application/xml,text/xml'},
      components: {input: GpxInput},
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'route',
      title: 'Route',
      type: 'object',
      hidden: true,
      fields: [
        defineField({
          name: 'type',
          type: 'string',
          initialValue: 'LineString',
        }),
        defineField({
          name: 'coordinates',
          type: 'text',
        }),
      ],
    }),
    defineField({
      name: 'startedAt',
      title: 'Date',
      type: 'datetime',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      activity: 'activity',
      media: 'photo',
    },
    prepare({title, activity, media}) {
      return {
        title: title || 'Track',
        subtitle: activity,
        media,
      }
    },
  },
})
