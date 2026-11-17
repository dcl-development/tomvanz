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
      S.documentTypeListItem('track').title('Tracks'),
      S.listItem()
        .title('Pins')
        .id('pins')
        .schemaType('pin')
        .child(
          S.documentList()
            .title('Pins')
            .filter('_type in ["pin", "photo"]')
            .apiVersion('2026-01-01'),
        ),
      S.listItem()
        .title('Drone photos')
        .id('dronePhotos')
        .schemaType('pin')
        .child(
          S.documentList()
            .title('Drone photos')
            .filter(
              '(_type == "pin" && (drone == true || photo.asset->originalFilename match "DJI_*")) || (_type == "photo" && (drone == true || image.asset->originalFilename match "DJI_*"))',
            )
            .apiVersion('2026-01-01'),
        ),
    ])
