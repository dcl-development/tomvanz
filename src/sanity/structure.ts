import type {StructureResolver} from 'sanity/structure'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Tom Vanz')
    .items([
      S.listItem()
        .title('Site')
        .id('siteSettings')
        .child(S.document().schemaType('siteSettings').documentId('siteSettings').title('Site')),
      S.divider(),
      S.documentTypeListItem('track').title('Routes'),
      // Photos, including old pins that haven't been converted yet.
      S.listItem()
        .title('Photos')
        .id('photos')
        .schemaType('photo')
        .child(
          S.documentList()
            .title('Photos')
            .filter('_type in ["photo", "pin"]')
            .apiVersion('2026-01-01'),
        ),
      S.listItem()
        .title('Drone')
        .id('dronePhotos')
        .schemaType('photo')
        .child(
          S.documentList()
            .title('Drone')
            .filter(
              '(_type == "pin" && coalesce(drone, photo.asset->originalFilename match "DJI_*", false)) || (_type == "photo" && coalesce(drone, image.asset->originalFilename match "DJI_*", false))',
            )
            .apiVersion('2026-01-01'),
        ),
    ])
