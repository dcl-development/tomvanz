import {setWorkerUrl} from 'maplibre-gl'

// Next/Turbopack does not emit the worker's sibling shared chunk. Serve both
// from /public/maplibre (copied on predev/prebuild) so tiles can paint.
setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')
