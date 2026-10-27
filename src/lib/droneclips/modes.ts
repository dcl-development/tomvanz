import {Quality} from 'mediabunny'

export type CompressModeId = 'quick' | 'best'

export type CompressMode = {
  id: CompressModeId
  label: string
  /** Short line on the mode button. */
  description: string
  /** Smaller note under the button. */
  finePrint: string
  /** Rough fraction of source file size after compression (for estimates). */
  sizeFraction: number
  maxWidth: number
  maxHeight: number
  maxFrameRate: number | null
  videoBitrate: number
  audioBitrate: number
}

export const COMPRESS_MODES: CompressMode[] = [
  {
    id: 'quick',
    label: 'Quick share',
    description: 'Smallest files — sends fastest.',
    finePrint: '720p for fast sending in iMessage (and quick Instagram stories).',
    sizeFraction: 0.06,
    maxWidth: 1280,
    maxHeight: 720,
    maxFrameRate: 30,
    videoBitrate: 2_000_000,
    audioBitrate: 96_000,
  },
  {
    id: 'best',
    label: 'Best quality',
    description: 'Sharper picture, still much smaller than the original.',
    finePrint:
      "1080p using Instagram's recommended upload settings, so it holds up best after Instagram processes it.",
    sizeFraction: 0.15,
    maxWidth: 1920,
    maxHeight: 1080,
    maxFrameRate: 30,
    videoBitrate: 5_500_000,
    audioBitrate: 128_000,
  },
]

export const DEFAULT_MODE_ID: CompressModeId = 'best'

export function getMode(id: CompressModeId): CompressMode {
  const mode = COMPRESS_MODES.find((m) => m.id === id)
  if (!mode) return COMPRESS_MODES.find((m) => m.id === DEFAULT_MODE_ID)!
  return mode
}

export function modeTargetBitrateBps(mode: CompressMode): number {
  return mode.videoBitrate + mode.audioBitrate
}

export function fitDimensions(
  sourceWidth: number,
  sourceHeight: number,
  mode: CompressMode,
): {width: number; height: number} {
  const portrait = sourceHeight > sourceWidth
  const maxW = portrait ? mode.maxHeight : mode.maxWidth
  const maxH = portrait ? mode.maxWidth : mode.maxHeight
  const scale = Math.min(1, maxW / sourceWidth, maxH / sourceHeight)
  let width = Math.floor(sourceWidth * scale)
  let height = Math.floor(sourceHeight * scale)
  width = Math.max(2, width & ~1)
  height = Math.max(2, height & ~1)
  return {width, height}
}

export function videoQuality(mode: CompressMode): Quality {
  return new Quality({bitrate: mode.videoBitrate})
}

export function audioQuality(mode: CompressMode): Quality {
  return new Quality({bitrate: mode.audioBitrate})
}

export function estimateOutputBytes(inputBytes: number, mode: CompressMode): number {
  return Math.max(256_000, Math.round(inputBytes * mode.sizeFraction))
}
