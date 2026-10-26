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
} from 'mediabunny'

import {formatBytes, outputFileName} from './format'
import {shouldKeepOriginal} from './keep-original'
import {audioQuality, type CompressMode, fitDimensions, videoQuality} from './modes'

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

export type EncodeResult = {
  fileName: string
  blob: Blob
  keptOriginal: boolean
}

/** Max estimated compressed size for one clip encode. */
export const MAX_OUTPUT_BYTES_IN_MEMORY = Math.floor(1.5 * 1024 ** 3)

/** Max total estimated output held in memory across done + pending clips. */
export const MAX_BATCH_ESTIMATED_OUTPUT_BYTES = 2 * 1024 ** 3

export function checkEstimatedOutputSize(
  estimatedOutputBytes: number,
): {ok: true} | {ok: false; error: string} {
  if (estimatedOutputBytes > MAX_OUTPUT_BYTES_IN_MEMORY) {
    return {
      ok: false,
      error: `This clip would be about ${formatBytes(estimatedOutputBytes)} after compression — too large for the browser to hold at once. Try Quick share, or use a shorter clip.`,
    }
  }
  return {ok: true}
}

export function checkBatchEstimatedOutputSize(
  totalEstimatedBytes: number,
): {ok: true} | {ok: false; error: string} {
  if (totalEstimatedBytes > MAX_BATCH_ESTIMATED_OUTPUT_BYTES) {
    return {
      ok: false,
      error: `These clips would use about ${formatBytes(totalEstimatedBytes)} in memory. Download or remove some finished clips first, or compress fewer at a time.`,
    }
  }
  return {ok: true}
}

function blobFromBufferTarget(target: BufferTarget): Blob {
  const buffer = target.buffer
  if (!buffer) throw new Error('No output was produced.')
  const blob = new Blob([buffer], {type: 'video/mp4'})
  target.buffer = null
  return blob
}

function keptOriginalResult(file: File): EncodeResult {
  return {fileName: file.name, blob: file, keptOriginal: true}
}

export async function compressVideoFile(
  file: File,
  mode: CompressMode,
  onProgress: (progress: EncodeProgress) => void,
  signal?: AbortSignal,
): Promise<EncodeResult> {
  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  })

  try {
    if (await shouldKeepOriginal(input, file, mode)) {
      onProgress({progress: 1, processedSeconds: 0, bytesWritten: file.size})
      return keptOriginalResult(file)
    }

    await ensureAacEncoder()

    const suggestedName = outputFileName(file.name)
    const target = new BufferTarget()
    const output = new Output({
      format: new Mp4OutputFormat(),
      target,
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

      await output.finalize()
      const blob = blobFromBufferTarget(target)
      if (blob.size >= file.size) {
        return keptOriginalResult(file)
      }
      return {fileName: suggestedName, blob, keptOriginal: false}
    } catch (error) {
      void conversion?.cancel()
      throw error
    }
  } finally {
    input.dispose()
  }
}
