import type {StructureResolver} from 'sanity/structure'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Tom Vanz')
    .items([
      S.documentTypeListItem('track').title('Routes'),
      S.documentTypeListItem('photo').title('Photos'),
    ])
