import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {schemaTypes} from './schemaTypes'
import {structure} from './structure'

export default defineConfig({
  name: 'tomvanz',
  title: 'Tom Vanz',
  projectId: 'lee2r8sa',
  dataset: 'production',
  plugins: [structureTool({structure})],
  schema: {types: schemaTypes},
})
