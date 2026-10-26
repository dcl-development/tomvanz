/**
 * Headless browser test for /droneclips: manual download, batch flow, retry, heap metrics.
 * Requires: server on PORT, ffmpeg, ffprobe, playwright chromium.
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
const inputPath2 = path.join(tmpDir, 'test-4k-b.mp4')

function run(cmd, args) {
  const result = spawnSync(cmd, args, {encoding: 'utf8'})
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed:\n${result.stderr}`)
  }
  return result.stdout.trim()
}

function makeTestClip(outPath, durationSec = 3) {
  run('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `testsrc=duration=${durationSec}:size=3840x2160:rate=30`,
    '-c:v',
    'libx264',
    '-b:v',
    '25M',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    outPath,
  ])
}

console.log('Generating 4K H.264 test clips…')
makeTestClip(inputPath)
makeTestClip(inputPath2, 2)

const inputSize = fs.statSync(inputPath).size
console.log(`Input A: ${inputPath} (${inputSize} bytes)`)

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

async function getJsHeapUsed(cdp) {
  const {metrics} = await cdp.send('Performance.getMetrics')
  const heap = metrics.find((m) => m.name === 'JSHeapUsedSize')
  return heap ? Number(heap.value) : null
}

async function collectGarbage(cdp) {
  try {
    await cdp.send('HeapProfiler.collectGarbage')
  } catch {
    /* optional */
  }
}

async function logHeap(label, cdp, memoryLog) {
  const bytes = await getJsHeapUsed(cdp)
  const entry = {label, jsHeapUsedBytes: bytes}
  memoryLog.push(entry)
  console.log(`  [heap] ${label}: ${bytes != null ? `${Math.round(bytes / 1024 / 1024)} MiB` : 'n/a'}`)
  return bytes
}

async function waitForCompressIdle(page, clipCount) {
  await page.getByText(new RegExp(`All done: ${clipCount} of ${clipCount}`)).waitFor({timeout: 300_000})
}

async function encodeModeNoAutoDownload(page, modeLabel, clipCount, cdp, memoryLog) {
  await page.getByRole('radio', {name: new RegExp(modeLabel)}).click()
  const downloadDuringCompress = page.waitForEvent('download', {timeout: 5000}).then(() => 'got-download')
  await page.getByRole('button', {name: 'Compress'}).click()
  const race = await Promise.race([
    downloadDuringCompress,
    page.getByText('%', {exact: false}).first().waitFor({timeout: 15_000}).then(() => 'progress'),
  ])
  if (race === 'got-download') {
    throw new Error(`Unexpected auto-download during compress (${modeLabel})`)
  }
  await waitForCompressIdle(page, clipCount)
  await logHeap(`after compress (${modeLabel})`, cdp, memoryLog)
  await page.getByText('Ready — use Download', {exact: false}).first().waitFor({timeout: 30_000})
}

async function downloadSelected(page, expectedCount, downloadDir, prefix) {
  const btn = page.getByRole('button', {name: new RegExp(`Download selected \\(${expectedCount}\\)`)})
  await btn.waitFor({state: 'visible', timeout: 30_000})
  const downloadWaits = Array.from({length: expectedCount}, () =>
    page.waitForEvent('download', {timeout: 180_000}),
  )
  await btn.click()
  const downloads = await Promise.all(downloadWaits)
  const paths = []
  for (let i = 0; i < downloads.length; i++) {
    const outPath = path.join(downloadDir, `${prefix}-${i + 1}.mp4`)
    await downloads[i].saveAs(outPath)
    paths.push(outPath)
  }
  return paths
}

async function testRetryAfterCancel(page, downloadDir) {
  await page.getByRole('button', {name: 'Clear list'}).click()
  await page.setInputFiles('input[type="file"]', inputPath)
  await page.getByRole('button', {name: 'Compress'}).click()
  await page.getByText('%', {exact: false}).first().waitFor({timeout: 30_000}).catch(() => {})
  await page.getByRole('button', {name: 'Cancel'}).click({timeout: 5000}).catch(() => {})
  await page.getByRole('button', {name: 'Try again'}).waitFor({timeout: 30_000})
  const downloadDuringRetry = page.waitForEvent('download', {timeout: 5000}).then(() => true).catch(() => false)
  await page.getByRole('button', {name: 'Try again'}).click()
  await page.getByText('Ready — use Download', {exact: false}).waitFor({timeout: 180_000})
  if (await downloadDuringRetry) {
    throw new Error('Unexpected auto-download on retry')
  }
  const downloadPromise = page.waitForEvent('download', {timeout: 180_000})
  await page.getByRole('button', {name: 'Download'}).first().click()
  const download = await downloadPromise
  const outPath = path.join(downloadDir, 'retry-after-cancel.mp4')
  await download.saveAs(outPath)
  return outPath
}

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-features=PlatformHEVCDecoderSupport', '--js-flags=--expose-gc'],
})

const context = await browser.newContext({acceptDownloads: true})
const page = await context.newPage()
const cdp = await context.newCDPSession(page)
await cdp.send('Performance.enable')

const memoryLog = []

console.log(`Opening ${baseUrl}`)
await page.goto(baseUrl, {waitUntil: 'networkidle'})
await page.getByRole('button', {name: 'Choose videos'}).waitFor({timeout: 60_000})

await logHeap('baseline (empty list)', cdp, memoryLog)

await page.setInputFiles('input[type="file"]', [inputPath, inputPath2])
await page.waitForTimeout(2000)

const results = []

for (const {label, expectW, expectH, maxSizeRatio, clipCount} of [
  {label: 'Quick share', expectW: 1280, expectH: 720, maxSizeRatio: 0.5, clipCount: 2},
  {label: 'Best quality', expectW: 1920, expectH: 1080, maxSizeRatio: 0.6, clipCount: 2},
]) {
  console.log(`Testing mode: ${label} (${clipCount} clips, no auto-download)`)
  await encodeModeNoAutoDownload(page, label, clipCount, cdp, memoryLog)
  const outPaths = await downloadSelected(page, clipCount, tmpDir, label.replace(/\s+/g, '-'))
  for (const outPath of outPaths) {
    const {width, height} = probeDimensions(outPath)
    const outSize = fs.statSync(outPath).size
    const okDims = width === expectW && height === expectH
    const okSmaller = outSize < inputSize * maxSizeRatio
    results.push({
      mode: label,
      file: path.basename(outPath),
      width,
      height,
      outSize,
      okDims,
      okSmaller,
    })
    console.log(
      `  → ${path.basename(outPath)} ${width}x${height}, ${outSize} bytes (dims ${okDims ? 'OK' : 'FAIL'}, size ${okSmaller ? 'OK' : 'FAIL'})`,
    )
  }
  await collectGarbage(cdp)
  await logHeap(`after GC (${label})`, cdp, memoryLog)
  await page.getByRole('button', {name: 'Clear list'}).click()
  await page.waitForTimeout(500)
  await collectGarbage(cdp)
  await logHeap(`after clear (${label})`, cdp, memoryLog)
  const baseline = memoryLog.find((e) => e.label === 'baseline (empty list)')?.jsHeapUsedBytes
  const afterClear = memoryLog[memoryLog.length - 1]?.jsHeapUsedBytes
  if (baseline != null && afterClear != null && afterClear > baseline * 1.35) {
    console.warn(
      `  WARN: heap after clear (${Math.round(afterClear / 1024 / 1024)} MiB) > 1.35× baseline (${Math.round(baseline / 1024 / 1024)} MiB)`,
    )
  }
  await page.setInputFiles('input[type="file"]', [inputPath, inputPath2])
  await page.waitForTimeout(1000)
}

console.log('Testing retry after cancel…')
const retryPath = await testRetryAfterCancel(page, tmpDir)
const retrySize = fs.statSync(retryPath).size
if (retrySize < 1024) throw new Error('Retry download was empty')
console.log(`  → retry OK (${retrySize} bytes)`)

await browser.close()

const failed = results.filter((r) => !r.okDims || !r.okSmaller)
if (failed.length) {
  console.error('FAILED', failed)
  process.exit(1)
}

console.log('All mode tests passed.')
console.log('MEMORY_LOG_JSON=' + JSON.stringify(memoryLog))
console.log(JSON.stringify({results, memoryLog}, null, 2))
