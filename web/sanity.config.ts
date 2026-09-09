import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {schemaTypes} from './src/sanity/schemaTypes'
import {structure} from './src/sanity/structure'

export default defineConfig({
  name: 'tomvanz',
  title: 'Tom Vanz',
  projectId: 'lee2r8sa',
  dataset: 'production',
  basePath: '/studio',
  plugins: [structureTool({structure})],
  schema: {types: schemaTypes},
  document: {
    newDocumentOptions: (prev) => prev.filter((item) => item.templateId !== 'photo'),
  },
})
