import {ALL_FORMATS, BlobSource, Input} from 'mediabunny'

import {
  gatherClipMediaFacts,
  shouldKeepOriginalFromFacts,
  type ClipMediaFacts,
} from './keep-original'
import type {CompressMode, HighEncodePlan} from './modes'
import {
  estimateOutputBytes,
  estimateOutputBytesFromBitrate,
  fitDimensions,
  getMode,
  planHighVideoEncode,
} from './modes'

export type FileProbe = {
  durationSec: number | null
  displayWidth: number | null
  displayHeight: number | null
  frameRate: number | null
  hasAudio: boolean
  estimatedOutputBytes: number
  outputWidth: number | null
  outputHeight: number | null
  mediaFacts: ClipMediaFacts | null
  highEncodePlan: HighEncodePlan | null
}

async function readVideoFrameRate(
  video: {computeFrameRateMetrics: () => Promise<{bestGuessFrameRate: number}>},
): Promise<number> {
  try {
    const metrics = await video.computeFrameRateMetrics()
    if (metrics.bestGuessFrameRate > 0) return metrics.bestGuessFrameRate
  } catch {
    /* fall through */
  }
  return 30
}

export function estimatedBytesForProbe(
  fileSize: number,
  probe: Pick<FileProbe, 'durationSec' | 'mediaFacts' | 'highEncodePlan'>,
  mode: CompressMode,
): number {
  const facts = probe.mediaFacts
  if (facts && shouldKeepOriginalFromFacts(facts, mode, probe.highEncodePlan)) {
    return fileSize
  }
  if (mode.id === 'high' && probe.highEncodePlan && facts?.durationSec) {
    return estimateOutputBytesFromBitrate(facts.durationSec, probe.highEncodePlan.totalBitrateBps, fileSize)
  }
  if (mode.id === 'high' && probe.highEncodePlan && probe.durationSec) {
    return estimateOutputBytesFromBitrate(probe.durationSec, probe.highEncodePlan.totalBitrateBps, fileSize)
  }
  return estimateOutputBytes(fileSize, mode)
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
    let frameRate: number | null = null
    let highEncodePlan: HighEncodePlan | null = null

    const mediaFacts = await gatherClipMediaFacts(input, file)

    if (video) {
      displayWidth = await video.getDisplayWidth()
      displayHeight = await video.getDisplayHeight()
      const fitted = fitDimensions(displayWidth, displayHeight, mode)
      outputWidth = fitted.width
      outputHeight = fitted.height
      frameRate = await readVideoFrameRate(video)
      if (mediaFacts) {
        highEncodePlan = await planHighVideoEncode(
          displayWidth,
          displayHeight,
          frameRate,
          mediaFacts.videoBitrateBps,
          getMode('high'),
        )
      }
    }

    const probeBase = {
      durationSec,
      displayWidth,
      displayHeight,
      frameRate,
      hasAudio: audioTracks.length > 0,
      outputWidth,
      outputHeight,
      mediaFacts,
      highEncodePlan,
    }

    return {
      ...probeBase,
      estimatedOutputBytes: estimatedBytesForProbe(file.size, probeBase, mode),
    }
  } finally {
    input.dispose()
  }
}
