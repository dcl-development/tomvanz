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
    ])
