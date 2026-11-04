import {replaceZipPathExtension, zipEntryBaseName} from './file-kind'

const JPEG_QUALITY = 0.9

let worker: Worker | null = null
let workerJob = 0

type WorkerSuccess = {
  ok: true
  meta: {width: number; height: number; thumb_width?: number; thumb_height?: number}
  image: {width: number; height: number; colors: number; bits: number; data: Uint8Array | Uint16Array}
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker('/droneclips/dng-worker.mjs', {type: 'module'})
  }
  return worker
}

type WorkerFailure = {ok: false; error: string}

type WorkerReply =
  | ({id: string} & WorkerSuccess)
  | ({id: string} & WorkerFailure)

function decodeDngInWorker(buffer: ArrayBuffer): Promise<WorkerSuccess> {
  const id = `dng-${++workerJob}`
  const w = getWorker()
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<WorkerReply>) => {
      if (event.data.id !== id) return
      w.removeEventListener('message', onMessage)
      if (!event.data.ok) {
        reject(new Error(event.data.error))
        return
      }
      const {id: _replyId, ...success} = event.data
      resolve(success)
    }
    w.addEventListener('message', onMessage)
    w.postMessage({id, buffer}, [buffer])
  })
}

function rgbInterleavedToRgba(
  data: Uint8Array | Uint16Array,
  width: number,
  height: number,
  colors: number,
  bits: number,
): Uint8ClampedArray | null {
  const pixels = width * height
  const rgba = new Uint8ClampedArray(pixels * 4)
  const scale = bits > 8 ? 255 / ((1 << bits) - 1) : 1

  if (colors === 3) {
    for (let i = 0; i < pixels; i++) {
      const src = i * 3
      const dst = i * 4
      rgba[dst] = Math.min(255, Math.round(Number(data[src]) * scale))
      rgba[dst + 1] = Math.min(255, Math.round(Number(data[src + 1]) * scale))
      rgba[dst + 2] = Math.min(255, Math.round(Number(data[src + 2]) * scale))
      rgba[dst + 3] = 255
    }
    return rgba
  }

  if (colors === 4) {
    for (let i = 0; i < pixels; i++) {
      const src = i * 4
      const dst = i * 4
      rgba[dst] = Math.min(255, Math.round(Number(data[src]) * scale))
      rgba[dst + 1] = Math.min(255, Math.round(Number(data[src + 1]) * scale))
      rgba[dst + 2] = Math.min(255, Math.round(Number(data[src + 2]) * scale))
      rgba[dst + 3] = Math.min(255, Math.round(Number(data[src + 3]) * scale))
    }
    return rgba
  }

  return null
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
  })
}

function looksLikeEmbeddedPreview(
  meta: {width: number; height: number; thumb_width?: number; thumb_height?: number},
  imageWidth: number,
  imageHeight: number,
): boolean {
  if (imageWidth >= meta.width && imageHeight >= meta.height) return false
  if (meta.thumb_width && meta.thumb_height) {
    if (imageWidth === meta.thumb_width && imageHeight === meta.thumb_height) return true
  }
  return imageWidth < meta.width * 0.5 || imageHeight < meta.height * 0.5
}

export type DngConvertResult = {
  blob: Blob
  zipRelativePath: string
  downloadFileName: string
}

/**
 * Decode full-resolution DNG via libraw-wasm (Web Worker) and emit JPEG when smaller than source.
 */
export async function tryConvertDngToJpeg(file: File, relativePath: string): Promise<DngConvertResult | null> {
  if (typeof window === 'undefined') return null

  try {
    const buffer = await file.arrayBuffer()
    const decoded = await decodeDngInWorker(buffer)
    const {meta, image} = decoded

    if (looksLikeEmbeddedPreview(meta, image.width, image.height)) {
      return null
    }

    const rgba = rgbInterleavedToRgba(image.data, image.width, image.height, image.colors, image.bits)
    if (!rgba) return null

    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), image.width, image.height), 0, 0)

    const jpegBlob = await canvasToJpegBlob(canvas, JPEG_QUALITY)
    if (!jpegBlob || jpegBlob.size >= file.size) return null

    const downloadFileName = zipEntryBaseName(relativePath).replace(/\.dng$/i, '.jpg')
    const zipRelativePath = replaceZipPathExtension(relativePath, '.jpg')

    return {
      blob: jpegBlob,
      zipRelativePath,
      downloadFileName,
    }
  } catch {
    return null
  }
}
