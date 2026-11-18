import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {schemaTypes} from './src/sanity/schemaTypes'
import {structure} from './src/sanity/structure'
import {BulkUploadTool} from './src/sanity/components/BulkUploadTool'

// A small upload arrow for the tool's menu entry.
const UploadIcon = () => (
  <svg viewBox="0 0 25 25" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.5 17V6M8 10.5l4.5-4.5 4.5 4.5M5 19.5h15" />
  </svg>
)

export default defineConfig({
  name: 'tomvanz',
  title: 'Tom Vanz',
  projectId: 'lee2r8sa',
  dataset: 'production',
  basePath: '/studio',
  releases: {enabled: false},
  scheduledDrafts: {enabled: false},
  tasks: {enabled: false},
  plugins: [structureTool({structure})],
  tools: (prev) => [...prev, {name: 'bulk-upload', title: 'Bulk upload', icon: UploadIcon, component: BulkUploadTool}],
  schema: {types: schemaTypes},
})
