import {
  Input,
  Mp4InputFormat,
  QuickTimeInputFormat,
  type InputFormat,
  type VideoCodec,
} from 'mediabunny'

import type {CompressMode} from './modes'
import {modeTargetBitrateBps} from './modes'

/** Allow this much headroom above the mode target before skipping re-encode. */
export const KEEP_ORIGINAL_BITRATE_FACTOR = 1.15

const KEEP_VIDEO_CODECS: ReadonlySet<VideoCodec> = new Set(['avc', 'hevc'])

export type ClipMediaFacts = {
  displayWidth: number
  displayHeight: number
  videoCodec: VideoCodec
  isMp4OrMov: boolean
  totalBitrateBps: number
  durationSec: number
}

export function modeDisplayLimits(
  mode: CompressMode,
  displayWidth: number,
  displayHeight: number,
): {maxWidth: number; maxHeight: number} {
  const portrait = displayHeight > displayWidth
  if (portrait) {
    return {maxWidth: mode.maxHeight, maxHeight: mode.maxWidth}
  }
  return {maxWidth: mode.maxWidth, maxHeight: mode.maxHeight}
}

export function fitsModeResolutionBox(
  displayWidth: number,
  displayHeight: number,
  mode: CompressMode,
): boolean {
  const {maxWidth, maxHeight} = modeDisplayLimits(mode, displayWidth, displayHeight)
  return displayWidth <= maxWidth && displayHeight <= maxHeight
}

export function isMp4OrMovContainer(format: InputFormat): boolean {
  return format instanceof Mp4InputFormat || format instanceof QuickTimeInputFormat
}

export function shouldKeepOriginalFromFacts(facts: ClipMediaFacts, mode: CompressMode): boolean {
  if (!facts.isMp4OrMov || !KEEP_VIDEO_CODECS.has(facts.videoCodec)) {
    return false
  }
  if (!fitsModeResolutionBox(facts.displayWidth, facts.displayHeight, mode)) {
    return false
  }
  const ceiling = modeTargetBitrateBps(mode) * KEEP_ORIGINAL_BITRATE_FACTOR
  return facts.totalBitrateBps <= ceiling
}

async function readDurationSec(input: Input): Promise<number | null> {
  try {
    const duration = await input.computeDuration()
    if (Number.isFinite(duration) && duration > 0) return duration
  } catch {
    /* fall through */
  }
  try {
    const duration = await input.getDurationFromMetadata()
    if (duration != null && Number.isFinite(duration) && duration > 0) return duration
  } catch {
    /* fall through */
  }
  return null
}

async function readTrackBitrateBps(
  track: {getAverageBitrate: () => Promise<number | null>; computePacketStats: (n?: number) => Promise<{averageBitrate: number}>},
): Promise<number | null> {
  const fromMeta = await track.getAverageBitrate()
  if (fromMeta != null && fromMeta > 0) return fromMeta
  try {
    const stats = await track.computePacketStats(60)
    if (stats.averageBitrate > 0) return stats.averageBitrate
  } catch {
    /* fall through */
  }
  return null
}

export async function gatherClipMediaFacts(input: Input, file: File): Promise<ClipMediaFacts | null> {
  const [format, videoTracks, audioTracks] = await Promise.all([
    input.getFormat(),
    input.getVideoTracks(),
    input.getAudioTracks(),
  ])
  const video = videoTracks[0]
  if (!video) return null

  const [displayWidth, displayHeight, videoCodec] = await Promise.all([
    video.getDisplayWidth(),
    video.getDisplayHeight(),
    video.getCodec(),
  ])
  if (!videoCodec) return null

  let totalBitrateBps = 0
  let hasBitrate = false

  const videoBps = await readTrackBitrateBps(video)
  if (videoBps != null) {
    totalBitrateBps += videoBps
    hasBitrate = true
  }

  for (const audio of audioTracks) {
    const audioBps = await readTrackBitrateBps(audio)
    if (audioBps != null) {
      totalBitrateBps += audioBps
      hasBitrate = true
    }
  }

  if (!hasBitrate) {
    const durationSec = await readDurationSec(input)
    if (durationSec == null) return null
    totalBitrateBps = Math.round((file.size * 8) / durationSec)
    return {
      displayWidth,
      displayHeight,
      videoCodec,
      isMp4OrMov: isMp4OrMovContainer(format),
      totalBitrateBps,
      durationSec,
    }
  }

  const durationSec = (await readDurationSec(input)) ?? 0

  return {
    displayWidth,
    displayHeight,
    videoCodec,
    isMp4OrMov: isMp4OrMovContainer(format),
    totalBitrateBps,
    durationSec,
  }
}

export async function shouldKeepOriginal(input: Input, file: File, mode: CompressMode): Promise<boolean> {
  const facts = await gatherClipMediaFacts(input, file)
  if (!facts) return false
  return shouldKeepOriginalFromFacts(facts, mode)
}
