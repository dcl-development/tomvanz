import {createClient} from 'next-sanity'
import {apiVersion, dataset, projectId} from './env'

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  // Fail fast: pages guard Sanity reads themselves (see load.ts) and retry once.
  maxRetries: 1,
})
