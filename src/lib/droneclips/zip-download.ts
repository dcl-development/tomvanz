import {BlobReader, BlobWriter, ZipWriter} from '@zip.js/zip.js'

export type ZipEntryInput = {
  relativePath: string
  blob: Blob
}

export type ZipBuildProgress = {
  entriesDone: number
  entriesTotal: number
  bytesWritten: number
}

type ZipWritable = {
  writable: WritableStream<Uint8Array>
  close: () => Promise<void>
}

function canUseSavePicker(): boolean {
  if (typeof window === 'undefined') return false
  if (navigator.webdriver) return false
  return typeof window.showSaveFilePicker === 'function'
}

async function addEntriesToZip(
  zipWriter: ZipWriter<unknown>,
  entries: ZipEntryInput[],
  onProgress?: (progress: ZipBuildProgress) => void,
): Promise<void> {
  let bytesWritten = 0
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const path = entry.relativePath.replace(/\\/g, '/')
    await zipWriter.add(path, new BlobReader(entry.blob), {
      level: 0,
      compressionMethod: 0,
      lastModDate: new Date(entry.blob instanceof File ? entry.blob.lastModified : Date.now()),
    })
    bytesWritten += entry.blob.size
    onProgress?.({
      entriesDone: i + 1,
      entriesTotal: entries.length,
      bytesWritten,
    })
  }
}

async function writeZipToWritable(
  target: ZipWritable,
  entries: ZipEntryInput[],
  onProgress?: (progress: ZipBuildProgress) => void,
): Promise<void> {
  const zipWriter = new ZipWriter(target.writable, {useCompressionStream: false})
  try {
    await addEntriesToZip(zipWriter, entries, onProgress)
    await zipWriter.close()
    await target.close()
  } catch (error) {
    try {
      await zipWriter.close()
    } catch {
      /* ignore */
    }
    throw error
  }
}

async function openSavePickerWritable(suggestedName: string): Promise<ZipWritable> {
  const picker = window.showSaveFilePicker!
  const handle = await Promise.race([
    picker({
      suggestedName,
      types: [{description: 'Zip archive', accept: {'application/zip': ['.zip']}}],
    }),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('save_picker_timeout')), 750)
    }),
  ])
  const writable = await handle.createWritable()
  return {
    writable: writable as unknown as WritableStream<Uint8Array>,
    close: async () => {
      await writable.close()
    },
  }
}

async function openStreamSaverWritable(suggestedName: string): Promise<ZipWritable> {
  const streamSaver = (await import('streamsaver')).default
  streamSaver.mitm = `${window.location.origin}/vendor/streamsaver/mitm.html`
  const fileStream = streamSaver.createWriteStream(suggestedName)
  return {
    writable: fileStream,
    close: async () => {},
  }
}

async function downloadZipBlobFallback(
  entries: ZipEntryInput[],
  suggestedName: string,
  onProgress?: (progress: ZipBuildProgress) => void,
): Promise<void> {
  const blobWriter = new BlobWriter('application/zip')
  const zipWriter = new ZipWriter(blobWriter, {useCompressionStream: false})
  await addEntriesToZip(zipWriter, entries, onProgress)
  await zipWriter.close()
  const blob = await blobWriter.getData()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = suggestedName
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function streamZipToDisk(
  entries: ZipEntryInput[],
  suggestedName: string,
  onProgress?: (progress: ZipBuildProgress) => void,
): Promise<void> {
  if (entries.length === 0) return
  if (typeof window === 'undefined') {
    throw new Error('Zip export is only available in the browser.')
  }

  if (navigator.webdriver) {
    await downloadZipBlobFallback(entries, suggestedName, onProgress)
    return
  }

  if (canUseSavePicker()) {
    try {
      await writeZipToWritable(await openSavePickerWritable(suggestedName), entries, onProgress)
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
    }
  }

  try {
    await writeZipToWritable(await openStreamSaverWritable(suggestedName), entries, onProgress)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    await downloadZipBlobFallback(entries, suggestedName, onProgress)
  }
}

export function defaultZipNameFromPaths(paths: string[]): string {
  if (paths.length === 0) return 'droneclips.zip'
  const first = paths[0].replace(/\\/g, '/')
  const top = first.includes('/') ? first.split('/')[0] : 'droneclips'
  const safe = top.replace(/[^\w.-]+/g, '_').slice(0, 60) || 'droneclips'
  return `${safe}.zip`
}
