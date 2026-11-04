/**
 * Headless Chrome tests for /droneclips: encode, keep-original skip, portrait sizing.
 * Requires: production server on PORT, ffmpeg, ffprobe, playwright chromium.
 */
import {spawnSync} from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {chromium} from 'playwright'
const port = Number(process.env.PORT || 3000)
const baseUrl = `http://127.0.0.1:${port}/droneclips`

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'droneclips-test-'))
const inputPath = path.join(tmpDir, 'test-4k.mp4')
const inputPath2 = path.join(tmpDir, 'test-4k-b.mp4')
const verticalPath = path.join(tmpDir, 'test-vertical.mp4')

function run(cmd, args) {
  const result = spawnSync(cmd, args, {encoding: 'utf8'})
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed:\n${result.stderr}`)
  }
  return result.stdout.trim()
}

function makeTestClip(outPath, {durationSec = 3, width = 3840, height = 2160, bitrate = '25M'} = {}) {
  run('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `testsrc=duration=${durationSec}:size=${width}x${height}:rate=30`,
    '-c:v',
    'libx264',
    '-b:v',
    bitrate,
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    outPath,
  ])
}

console.log('Generating test clips…')
makeTestClip(inputPath)
makeTestClip(inputPath2, {durationSec: 2})
makeTestClip(verticalPath, {width: 1080, height: 1920, bitrate: '20M'})

const inputSize = fs.statSync(inputPath).size
console.log(`High-bitrate input: ${inputPath} (${inputSize} bytes)`)

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

function fileSha256(filePath) {
  const data = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(data).digest('hex')
}

async function waitForBatchDone(page, clipCount) {
  await page.getByText(new RegExp(`All done: ${clipCount} of ${clipCount}`)).waitFor({timeout: 300_000})
}

async function waitForClipDone(page) {
  await page
    .getByText(/Ready — use Download|Already compressed, kept original/)
    .first()
    .waitFor({timeout: 300_000})
}

async function compressCurrentList(page, modeLabel, clipCount) {
  await page.getByRole('radio', {name: new RegExp(modeLabel)}).click()
  const downloadDuringCompress = page.waitForEvent('download', {timeout: 5000}).then(() => 'got-download')
  await page.getByRole('button', {name: 'Compress', exact: true}).click()
  const race = await Promise.race([
    downloadDuringCompress,
    page.getByText('%', {exact: false}).first().waitFor({timeout: 20_000}).then(() => 'progress'),
    page.getByText('Already compressed, kept original').first().waitFor({timeout: 20_000}).then(() => 'kept'),
  ])
  if (race === 'got-download') {
    throw new Error(`Unexpected auto-download during compress (${modeLabel})`)
  }
  await waitForBatchDone(page, clipCount)
  await waitForClipDone(page)
}

function listZipEntries(zipPath) {
  const out = run('unzip', ['-l', zipPath])
  const lines = out.split('\n').filter((line) => line.match(/^\s+\d+/))
  return lines.map((line) => {
    const trimmed = line.trim()
    const name = trimmed.slice(trimmed.lastIndexOf(' ') + 1)
    return name
  })
}

async function downloadZip(page, outPath) {
  const downloadDir = path.dirname(outPath)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadDir,
    eventsEnabled: true,
  })

  const downloadPromise = page.waitForEvent('download', {timeout: 180_000})
  await page.getByRole('button', {name: 'Download all (.zip)'}).click()
  try {
    const download = await downloadPromise
    await download.saveAs(outPath)
    return
  } catch {
    const deadline = Date.now() + 180_000
    while (Date.now() < deadline) {
      const zips = fs
        .readdirSync(downloadDir)
        .filter((name) => name.endsWith('.zip'))
        .map((name) => path.join(downloadDir, name))
      if (zips.length > 0) {
        fs.renameSync(zips.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0], outPath)
        return
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    throw new Error('Zip download did not start')
  }
}

async function downloadFirstClip(page, outPath) {
  const downloadPromise = page.waitForEvent('download', {timeout: 180_000})
  await page.getByRole('button', {name: 'Download'}).first().click()
  const download = await downloadPromise
  await download.saveAs(outPath)
}

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-features=PlatformHEVCDecoderSupport'],
})

const context = await browser.newContext({acceptDownloads: true})
const page = await context.newPage()

const report = {
  highBitrateCompress: null,
  roundTripKeepOriginal: null,
  verticalPortrait: null,
  folderZip: null,
}

console.log(`Opening ${baseUrl}`)
await page.goto(baseUrl, {waitUntil: 'networkidle'})
await page.getByRole('button', {name: 'Choose videos'}).waitFor({timeout: 60_000})

// (a) High-bitrate clip compresses (Medium quality, landscape 4K → 1920×1080, smaller file)
console.log('Case (a): high-bitrate 4K compresses…')
await page.setInputFiles('input[type="file"]', inputPath)
await page.waitForTimeout(1500)
await compressCurrentList(page, 'Medium quality', 1)
const compressedPath = path.join(tmpDir, 'case-a-compressed.mp4')
await downloadFirstClip(page, compressedPath)
const aDims = probeDimensions(compressedPath)
const aSize = fs.statSync(compressedPath).size
report.highBitrateCompress = {
  width: aDims.width,
  height: aDims.height,
  outBytes: aSize,
  inputBytes: inputSize,
  okDims: aDims.width === 1920 && aDims.height === 1080,
  okSmaller: aSize < inputSize * 0.6,
}
console.log(`  → ${aDims.width}x${aDims.height}, ${aSize} bytes`, report.highBitrateCompress)

// (b) Re-feed compressed output → kept original, same bytes
console.log('Case (b): re-feed compressed output (keep original)…')
await page.getByRole('button', {name: 'Clear list'}).click()
await page.setInputFiles('input[type="file"]', compressedPath)
await page.waitForTimeout(1500)
const keptVisible = page.getByText('Already compressed, kept original').first()
const progressVisible = page.getByText('%', {exact: false}).first()
const startMs = Date.now()
await page.getByRole('radio', {name: /Medium quality/}).click()
await page.getByRole('button', {name: 'Compress', exact: true}).click()
const outcome = await Promise.race([
  keptVisible.waitFor({timeout: 120_000}).then(() => 'kept'),
  progressVisible.waitFor({timeout: 120_000}).then(() => 'progress'),
])
const elapsedMs = Date.now() - startMs
await waitForBatchDone(page, 1)
const keptText = await keptVisible.textContent()
const roundTripPath = path.join(tmpDir, 'case-b-roundtrip.mp4')
await downloadFirstClip(page, roundTripPath)
const bHashIn = fileSha256(compressedPath)
const bHashOut = fileSha256(roundTripPath)
report.roundTripKeepOriginal = {
  uiOutcome: outcome,
  elapsedMs,
  keptMessage: keptText?.trim() ?? '',
  okKeptMessage: (keptText ?? '').includes('Already compressed, kept original'),
  okFast: elapsedMs < 45_000,
  okSameBytes: bHashIn === bHashOut,
  inBytes: fs.statSync(compressedPath).size,
  outBytes: fs.statSync(roundTripPath).size,
}
console.log('  →', report.roundTripKeepOriginal)

// (c) Vertical clip stays portrait at 1080×1920 max (Medium quality)
console.log('Case (c): vertical clip orientation…')
await page.getByRole('button', {name: 'Clear list'}).click()
await page.setInputFiles('input[type="file"]', verticalPath)
await page.waitForTimeout(1500)
await compressCurrentList(page, 'Medium quality', 1)
const verticalOut = path.join(tmpDir, 'case-c-vertical.mp4')
await downloadFirstClip(page, verticalOut)
const cDims = probeDimensions(verticalOut)
const cSize = fs.statSync(verticalOut).size
report.verticalPortrait = {
  width: cDims.width,
  height: cDims.height,
  outBytes: cSize,
  okDims: cDims.width === 1080 && cDims.height === 1920,
}
console.log(`  → ${cDims.width}x${cDims.height}, ${cSize} bytes`, report.verticalPortrait)

// (d) Nested folder → zip with structure (video, JPG, sidecar, DNG)
console.log('Case (d): nested folder zip export…')
const folderRoot = path.join(tmpDir, 'DCIM', '100MEDIA')
fs.mkdirSync(folderRoot, {recursive: true})
const folderClip = path.join(folderRoot, 'clip.mp4')
const folderJpg = path.join(folderRoot, 'photo.jpg')
const folderTxt = path.join(folderRoot, 'flight.txt')
const folderDng = path.join(folderRoot, 'sample.dng')
makeTestClip(folderClip, {durationSec: 2, width: 1280, height: 720, bitrate: '8M'})
run('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=green:s=800x600', '-frames:v', '1', folderJpg])
fs.writeFileSync(folderTxt, 'flight log sidecar')
fs.copyFileSync(folderJpg, folderDng)

await page.getByRole('button', {name: 'Clear list'}).click()
await page.locator('input[webkitdirectory]').setInputFiles(path.join(tmpDir, 'DCIM'))
await page.waitForTimeout(2000)
await compressCurrentList(page, 'Medium quality', 4)
const folderZipPath = path.join(tmpDir, 'case-d-folder.zip')
await downloadZip(page, folderZipPath)
const zipEntries = listZipEntries(folderZipPath)
const expected = [
  '100MEDIA/clip.mp4',
  '100MEDIA/photo.jpg',
  '100MEDIA/flight.txt',
  '100MEDIA/sample.dng',
]
report.folderZip = {
  entries: zipEntries,
  okCount: zipEntries.length === expected.length,
  okPaths: expected.every((name) => zipEntries.includes(name)),
}
console.log('  →', report.folderZip)

await browser.close()

const failures = []
if (!report.highBitrateCompress.okDims || !report.highBitrateCompress.okSmaller) failures.push('(a) high-bitrate')
if (!report.roundTripKeepOriginal.okKeptMessage || !report.roundTripKeepOriginal.okSameBytes) {
  failures.push('(b) keep-original round-trip')
}
if (!report.verticalPortrait.okDims) failures.push('(c) vertical')
if (!report.folderZip.okCount || !report.folderZip.okPaths) failures.push('(d) folder zip')

if (failures.length) {
  console.error('FAILED cases:', failures)
  console.error(JSON.stringify(report, null, 2))
  process.exit(1)
}

console.log('All droneclips tests passed.')
console.log(JSON.stringify(report, null, 2))
