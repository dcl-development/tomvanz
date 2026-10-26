/**
 * Headless browser encode test for /droneclips (both modes).
 * Requires: dev server on PORT, ffmpeg, ffprobe, playwright chromium.
 */
import {spawnSync} from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.PORT || 3000)
const baseUrl = `http://127.0.0.1:${port}/droneclips`

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'droneclips-test-'))
const inputPath = path.join(tmpDir, 'test-4k.mp4')

function run(cmd, args) {
  const result = spawnSync(cmd, args, {encoding: 'utf8'})
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed:\n${result.stderr}`)
  }
  return result.stdout.trim()
}

console.log('Generating 4K H.264 test clip…')
run('ffmpeg', [
  '-y',
  '-f',
  'lavfi',
  '-i',
  'testsrc=duration=3:size=3840x2160:rate=30',
  '-c:v',
  'libx264',
  '-b:v',
  '25M',
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
  inputPath,
])

const inputSize = fs.statSync(inputPath).size
console.log(`Input: ${inputPath} (${inputSize} bytes)`)

function probeDimensions(filePath) {
  const out = run('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height',
    '-of',
    'csv=p=0:s=x',
    filePath,
  ])
  const [w, h] = out.split('x').map((n) => Number(n))
  return {width: w, height: h}
}

async function encodeMode(page, modeLabel, downloadDir) {
  await page.getByRole('button', {name: modeLabel}).click()
  await page.getByRole('button', {name: 'Compress'}).click()
  await page
    .getByRole('button', {name: 'Download'})
    .or(page.getByText('Saved as'))
    .first()
    .waitFor({timeout: 180_000})
  const outPath = path.join(downloadDir, `${modeLabel.replace(/\s+/g, '-')}.mp4`)
  const downloadBtn = page.getByRole('button', {name: 'Download'}).first()
  if (await downloadBtn.isVisible().catch(() => false)) {
    const downloadPromise = page.waitForEvent('download', {timeout: 30_000})
    await downloadBtn.click()
    const download = await downloadPromise
    await download.saveAs(outPath)
    return outPath
  }
  throw new Error(`No download for mode ${modeLabel}`)
}

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-features=PlatformHEVCDecoderSupport'],
})

const context = await browser.newContext({acceptDownloads: true})
const page = await context.newPage()

console.log(`Opening ${baseUrl}`)
await page.goto(baseUrl, {waitUntil: 'networkidle'})
await page.getByRole('button', {name: 'Choose videos'}).waitFor({timeout: 60_000})
await page.setInputFiles('input[type="file"]', inputPath)

const results = []

for (const {label, expectW, expectH, maxSizeRatio} of [
  {label: 'Quick share', expectW: 1280, expectH: 720, maxSizeRatio: 0.5},
  {label: 'Best quality', expectW: 1920, expectH: 1080, maxSizeRatio: 0.6},
]) {
  console.log(`Testing mode: ${label}`)
  const outPath = await encodeMode(page, label, tmpDir)
  const {width, height} = probeDimensions(outPath)
  const outSize = fs.statSync(outPath).size
  const okDims = width === expectW && height === expectH
  const okSmaller = outSize < inputSize * maxSizeRatio
  results.push({
    mode: label,
    width,
    height,
    outSize,
    okDims,
    okSmaller,
  })
  console.log(
    `  → ${width}x${height}, ${outSize} bytes (dims ${okDims ? 'OK' : 'FAIL'}, size ${okSmaller ? 'OK' : 'FAIL'})`,
  )
  await page.getByRole('button', {name: 'Clear list'}).click()
  await page.setInputFiles('input[type="file"]', inputPath)
}

await browser.close()

const failed = results.filter((r) => !r.okDims || !r.okSmaller)
if (failed.length) {
  console.error('FAILED', failed)
  process.exit(1)
}

console.log('All mode tests passed.')
console.log(JSON.stringify(results, null, 2))
