import {registerAacEncoder} from '@mediabunny/aac-encoder'
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  canEncodeAudio,
  Conversion,
  ConversionCanceledError,
  Input,
  Mp4OutputFormat,
  Output,
  StreamTarget,
} from 'mediabunny'

import {audioQuality, type CompressMode, fitDimensions, videoQuality} from './modes'
import {outputFileName} from './format'

let aacEncoderReady = false

async function ensureAacEncoder() {
  if (aacEncoderReady) return
  if (!(await canEncodeAudio('aac'))) {
    registerAacEncoder()
  }
  aacEncoderReady = true
}

export type EncodeProgress = {
  progress: number
  processedSeconds: number
  bytesWritten: number
}

export type EncodeResult =
  | {kind: 'saved'; fileName: string}
  | {kind: 'blob'; fileName: string; blob: Blob}

export type OutputSink =
  | {
      kind: 'directory'
      getWritable: (name: string) => Promise<{
        writable: FileSystemWritableFileStream
        fileName: string
      }>
    }
  | {kind: 'buffer'}

const BUFFER_FALLBACK_MAX_BYTES = 600 * 1024 * 1024

export function canPickOutputDirectory(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function pickOutputDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const picker = window.showDirectoryPicker
  if (!picker) return null
  try {
    return await picker.call(window, {mode: 'readwrite'})
  } catch {
    return null
  }
}

export function createDirectorySink(
  dir: FileSystemDirectoryHandle,
): OutputSink {
  return {
    kind: 'directory',
    async getWritable(name) {
      const handle = await dir.getFileHandle(name, {create: true})
      const writable = await handle.createWritable()
      return {writable, fileName: name}
    },
  }
}

export function bufferSinkForFile(inputBytes: number): OutputSink | {error: string} {
  if (inputBytes > BUFFER_FALLBACK_MAX_BYTES) {
    return {
      error:
        'This clip is very large for this browser. Use Chrome or Edge on a computer and choose a folder when asked, or compress one clip at a time.',
    }
  }
  return {kind: 'buffer'}
}

async function createOutput(
  sink: OutputSink,
  suggestedName: string,
): Promise<{
  output: Output
  finalize: () => Promise<EncodeResult>
  trackBytes: (bytes: number) => void
}> {
  let bytesWritten = 0
  const trackBytes = (bytes: number) => {
    bytesWritten = Math.max(bytesWritten, bytes)
  }

  if (sink.kind === 'directory') {
    const {writable, fileName} = await sink.getWritable(suggestedName)
    const target = new StreamTarget(writable, {chunked: true})
    target.on('write', ({end}) => {
      trackBytes(end)
    })
    const output = new Output({
      format: new Mp4OutputFormat(),
      target,
    })
    return {
      output,
      trackBytes,
      async finalize() {
        await output.finalize()
        await writable.close()
        return {kind: 'saved', fileName}
      },
    }
  }

  const target = new BufferTarget()
  target.on('write', ({end}) => {
    trackBytes(end)
  })
  const output = new Output({
    format: new Mp4OutputFormat(),
    target,
  })
  return {
    output,
    trackBytes,
    async finalize() {
      await output.finalize()
      const buffer = target.buffer
      if (!buffer) throw new Error('No output was produced.')
      const blob = new Blob([buffer], {type: 'video/mp4'})
      return {kind: 'blob', fileName: suggestedName, blob}
    },
  }
}

export async function compressVideoFile(
  file: File,
  mode: CompressMode,
  sink: OutputSink,
  onProgress: (progress: EncodeProgress) => void,
  signal?: AbortSignal,
): Promise<EncodeResult> {
  await ensureAacEncoder()

  const suggestedName = outputFileName(file.name)
  const {output, finalize} = await createOutput(sink, suggestedName)

  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  })

  let conversion: Conversion | null = null

  try {
    conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      copy: false,
      video: async (track) => {
        const srcW = await track.getDisplayWidth()
        const srcH = await track.getDisplayHeight()
        const {width, height} = fitDimensions(srcW, srcH, mode)
        let frameRate: number | undefined
        if (mode.maxFrameRate) {
          try {
            const metrics = await track.computeFrameRateMetrics()
            const sourceRate = metrics.bestGuessFrameRate
            frameRate = Math.min(sourceRate, mode.maxFrameRate)
          } catch {
            frameRate = mode.maxFrameRate
          }
        }
        return {
          codec: 'avc',
          width,
          height,
          fit: 'contain',
          frameRate,
          quality: videoQuality(mode),
          forceTranscode: true,
        }
      },
      audio: {
        codec: 'aac',
        quality: audioQuality(mode),
        forceTranscode: true,
      },
    })

    if (!conversion.isValid) {
      const reason = conversion.discardedTracks[0]?.reason ?? 'unknown'
      throw new Error(`Could not process this video (${reason}).`)
    }

    conversion.onProgress = (progress, processedSeconds) => {
      onProgress({
        progress,
        processedSeconds,
        bytesWritten: 0,
      })
    }

    const abortHandler = () => {
      void conversion?.cancel()
    }
    signal?.addEventListener('abort', abortHandler, {once: true})

    try {
      await conversion.execute({pauseSignal: signal})
    } catch (error) {
      if (error instanceof ConversionCanceledError || signal?.aborted) {
        throw new Error('Canceled')
      }
      throw error
    } finally {
      signal?.removeEventListener('abort', abortHandler)
    }

    return await finalize()
  } finally {
    input.dispose()
  }
}
