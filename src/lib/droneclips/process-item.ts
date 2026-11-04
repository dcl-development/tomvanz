import {compressVideoFile} from './encode'
import {normalizeZipPath, type FileKind} from './file-kind'
import type {CompressMode} from './modes'
import type {FileProbe} from './probe'

export type ProcessAction = 'compressed' | 'kept' | 'copied'

export type ItemProcessResult = {
  fileName: string
  blob: Blob
  keptOriginal: boolean
  action: ProcessAction
  zipRelativePath: string
  inputBytes: number
  outputBytes: number
}

export type ProcessProgress = {
  progress: number
}

function passthrough(file: File, relativePath: string, action: 'copied' | 'kept'): ItemProcessResult {
  return {
    fileName: file.name,
    blob: file,
    keptOriginal: true,
    action,
    zipRelativePath: normalizeZipPath(relativePath),
    inputBytes: file.size,
    outputBytes: file.size,
  }
}

export async function processQueueItem(
  file: File,
  relativePath: string,
  kind: FileKind,
  mode: CompressMode,
  _probe: FileProbe | null,
  onProgress: (progress: ProcessProgress) => void,
  signal?: AbortSignal,
): Promise<ItemProcessResult> {
  const path = normalizeZipPath(relativePath)

  if (kind === 'other' || kind === 'photo' || kind === 'raw') {
    const action = kind === 'photo' || kind === 'other' ? 'copied' : 'kept'
    onProgress({progress: 100})
    return passthrough(file, path, action)
  }

  const videoResult = await compressVideoFile(
    file,
    mode,
    ({progress}) => onProgress({progress: Math.round(progress * 100)}),
    signal,
  )

  const action: ProcessAction = videoResult.keptOriginal ? 'kept' : 'compressed'
  return {
    fileName: videoResult.fileName,
    blob: videoResult.blob,
    keptOriginal: videoResult.keptOriginal,
    action,
    zipRelativePath: path,
    inputBytes: file.size,
    outputBytes: videoResult.blob.size,
  }
}
