import type {StructureResolver} from 'sanity/structure'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Tom Vanz')
    .items([
      S.documentTypeListItem('track').title('Routes'),
      S.documentTypeListItem('photo').title('Photos'),
      S.listItem()
        .title('Drone')
        .id('dronePhotos')
        .schemaType('photo')
        .child(
          S.documentList()
            .title('Drone')
            .filter('_type == "photo" && coalesce(drone, image.asset->originalFilename match "DJI_*", false)')
            .apiVersion('2026-01-01'),
        ),
    ])
