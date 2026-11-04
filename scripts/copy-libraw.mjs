import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcDir = path.join(root, 'node_modules', 'libraw-wasm', 'dist')
const destDir = path.join(root, 'public', 'vendor', 'libraw-wasm')

if (!fs.existsSync(srcDir)) {
  console.warn('copy-libraw: libraw-wasm not installed, skipping')
  process.exit(0)
}

fs.mkdirSync(destDir, {recursive: true})
for (const name of fs.readdirSync(srcDir)) {
  fs.copyFileSync(path.join(srcDir, name), path.join(destDir, name))
}
console.log('copy-libraw: synced libraw-wasm to public/vendor/libraw-wasm')

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
  console.log('copy-libraw: synced streamsaver mitm to public/vendor/streamsaver')
}
