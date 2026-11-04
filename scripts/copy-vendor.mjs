import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const streamSrc = path.join(root, 'node_modules', 'streamsaver')
const streamDest = path.join(root, 'public', 'vendor', 'streamsaver')
if (fs.existsSync(streamSrc)) {
  fs.mkdirSync(streamDest, {recursive: true})
  for (const name of ['mitm.html', 'sw.js']) {
    const from = path.join(streamSrc, name)
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, path.join(streamDest, name))
    }
  }
}
