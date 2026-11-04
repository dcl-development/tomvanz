import {canEncodeVideo, Quality, type VideoCodec} from 'mediabunny'

export type CompressModeId = 'low' | 'medium' | 'high'

export type CompressMode = {
  id: CompressModeId
  label: string
  /** Short line on the mode button. */
  description: string
  /** Smaller note under the button. */
  finePrint: string
  /** Rough fraction of source file size after compression (Low/Medium estimates). */
  sizeFraction: number
  /** When true, output matches source display size (High). */
  preserveResolution: boolean
  maxWidth: number
  maxHeight: number
  maxFrameRate: number | null
  videoBitrate: number
  audioBitrate: number
}

export const HIGH_BITS_PER_PIXEL_PER_FRAME_HEVC = 0.1
export const HIGH_H264_BITRATE_FACTOR = 1.5

export const COMPRESS_MODES: CompressMode[] = [
  {
    id: 'low',
    label: 'Low quality',
    description: 'For texting or quick sharing — smallest files.',
    finePrint: '720p, 2 Mbps video. DNG: full-res JPEG (~90) when decodable and smaller; otherwise unchanged.',
    sizeFraction: 0.06,
    preserveResolution: false,
    maxWidth: 1280,
    maxHeight: 720,
    maxFrameRate: 30,
    videoBitrate: 2_000_000,
    audioBitrate: 96_000,
  },
  {
    id: 'medium',
    label: 'Medium quality',
    description: 'For sharing and posting — sharp 1080p.',
    finePrint:
      '1080p, 5.5 Mbps video. DNG: full-res JPEG (~90) when decodable and smaller; otherwise unchanged.',
    sizeFraction: 0.15,
    preserveResolution: false,
    maxWidth: 1920,
    maxHeight: 1080,
    maxFrameRate: 30,
    videoBitrate: 5_500_000,
    audioBitrate: 128_000,
  },
  {
    id: 'high',
    label: 'High quality',
    description: 'Full resolution for storing or archiving — closest to the original.',
    finePrint: 'Same resolution as your clip; HEVC when your browser supports it. DNG files are kept unchanged.',
    sizeFraction: 0.45,
    preserveResolution: true,
    maxWidth: Number.MAX_SAFE_INTEGER,
    maxHeight: Number.MAX_SAFE_INTEGER,
    maxFrameRate: null,
    videoBitrate: 0,
    audioBitrate: 128_000,
  },
]

export const DEFAULT_MODE_ID: CompressModeId = 'medium'

export type HighEncodePlan = {
  codec: Extract<VideoCodec, 'hevc' | 'avc'>
  videoBitrateBps: number
  totalBitrateBps: number
}

export function getMode(id: CompressModeId): CompressMode {
  const mode = COMPRESS_MODES.find((m) => m.id === id)
  if (!mode) return COMPRESS_MODES.find((m) => m.id === DEFAULT_MODE_ID)!
  return mode
}

export function evenDimensions(width: number, height: number): {width: number; height: number} {
  let w = Math.max(2, Math.floor(width))
  let h = Math.max(2, Math.floor(height))
  w = w & ~1
  h = h & ~1
  return {width: w, height: h}
}

export function highTargetVideoBitrateBps(
  width: number,
  height: number,
  frameRate: number,
  codec: Extract<VideoCodec, 'hevc' | 'avc'>,
  sourceVideoBitrateBps?: number | null,
): number {
  const bppf =
    codec === 'hevc'
      ? HIGH_BITS_PER_PIXEL_PER_FRAME_HEVC
      : HIGH_BITS_PER_PIXEL_PER_FRAME_HEVC * HIGH_H264_BITRATE_FACTOR
  let bps = Math.round(width * height * frameRate * bppf)
  if (sourceVideoBitrateBps != null && sourceVideoBitrateBps > 0) {
    bps = Math.min(bps, sourceVideoBitrateBps)
  }
  return bps
}

export async function planHighVideoEncode(
  width: number,
  height: number,
  frameRate: number,
  sourceVideoBitrateBps: number | null,
  mode: CompressMode,
): Promise<HighEncodePlan> {
  const {width: w, height: h} = evenDimensions(width, height)
  const rate = frameRate > 0 ? frameRate : 30

  let codec: Extract<VideoCodec, 'hevc' | 'avc'> = 'avc'
  const hevcBitrate = highTargetVideoBitrateBps(w, h, rate, 'hevc', sourceVideoBitrateBps)
  const hevcQuality = new Quality({bitrate: hevcBitrate})
  if (await canEncodeVideo('hevc', {width: w, height: h, frameRate: rate, quality: hevcQuality})) {
    codec = 'hevc'
  }

  const videoBitrateBps = highTargetVideoBitrateBps(w, h, rate, codec, sourceVideoBitrateBps)
  return {
    codec,
    videoBitrateBps,
    totalBitrateBps: videoBitrateBps + mode.audioBitrate,
  }
}

export function modeTargetBitrateBps(mode: CompressMode, highPlan?: HighEncodePlan | null): number {
  if (mode.id === 'high') {
    return highPlan?.totalBitrateBps ?? mode.audioBitrate
  }
  return mode.videoBitrate + mode.audioBitrate
}

export function fitDimensions(
  sourceWidth: number,
  sourceHeight: number,
  mode: CompressMode,
): {width: number; height: number} {
  if (mode.preserveResolution) {
    return evenDimensions(sourceWidth, sourceHeight)
  }
  const portrait = sourceHeight > sourceWidth
  const maxW = portrait ? mode.maxHeight : mode.maxWidth
  const maxH = portrait ? mode.maxWidth : mode.maxHeight
  const scale = Math.min(1, maxW / sourceWidth, maxH / sourceHeight)
  return evenDimensions(sourceWidth * scale, sourceHeight * scale)
}

export function videoQuality(mode: CompressMode, videoBitrateBps?: number): Quality {
  const bitrate = mode.id === 'high' ? (videoBitrateBps ?? mode.videoBitrate) : mode.videoBitrate
  return new Quality({bitrate})
}

export function audioQuality(mode: CompressMode): Quality {
  return new Quality({bitrate: mode.audioBitrate})
}

export function estimateOutputBytes(inputBytes: number, mode: CompressMode): number {
  return Math.max(256_000, Math.round(inputBytes * mode.sizeFraction))
}

export function estimateOutputBytesFromBitrate(
  durationSec: number,
  totalBitrateBps: number,
  inputBytes: number,
): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return Math.max(256_000, Math.round(inputBytes * 0.45))
  }
  return Math.max(256_000, Math.round((totalBitrateBps * durationSec) / 8))
}
