import {ALL_FORMATS, BlobSource, Input} from 'mediabunny'

import {gatherClipMediaFacts, shouldKeepOriginalFromFacts, type ClipMediaFacts} from './keep-original'
import type {CompressMode} from './modes'
import {estimateOutputBytes, fitDimensions} from './modes'

export type FileProbe = {
  durationSec: number | null
  displayWidth: number | null
  displayHeight: number | null
  hasAudio: boolean
  estimatedOutputBytes: number
  outputWidth: number | null
  outputHeight: number | null
  mediaFacts: ClipMediaFacts | null
}

export async function probeVideoFile(file: File, mode: CompressMode): Promise<FileProbe> {
  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  })

  try {
    const [videoTracks, audioTracks] = await Promise.all([
      input.getVideoTracks(),
      input.getAudioTracks(),
    ])
    const video = videoTracks[0]
    let durationSec: number | null = null
    try {
      durationSec = await input.computeDuration()
    } catch {
      durationSec = await input.getDurationFromMetadata()
    }

    let displayWidth: number | null = null
    let displayHeight: number | null = null
    let outputWidth: number | null = null
    let outputHeight: number | null = null

    const mediaFacts = await gatherClipMediaFacts(input, file)

    if (video) {
      displayWidth = await video.getDisplayWidth()
      displayHeight = await video.getDisplayHeight()
      const fitted = fitDimensions(displayWidth, displayHeight, mode)
      outputWidth = fitted.width
      outputHeight = fitted.height
    }

    const keepOriginal = mediaFacts ? shouldKeepOriginalFromFacts(mediaFacts, mode) : false

    return {
      durationSec,
      displayWidth,
      displayHeight,
      hasAudio: audioTracks.length > 0,
      estimatedOutputBytes: keepOriginal ? file.size : estimateOutputBytes(file.size, mode),
      outputWidth,
      outputHeight,
      mediaFacts,
    }
  } finally {
    input.dispose()
  }
}
