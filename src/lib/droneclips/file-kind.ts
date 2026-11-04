export type FileKind = 'video' | 'photo' | 'raw' | 'other'

const VIDEO_EXT = /\.(mov|mp4|m4v|webm)$/i
const PHOTO_EXT = /\.(jpe?g|heic|heif|png)$/i
const RAW_EXT = /\.dng$/i

export function classifyFile(file: File): FileKind {
  const name = file.name
  if (file.type.startsWith('video/') || VIDEO_EXT.test(name)) return 'video'
  if (RAW_EXT.test(name)) return 'raw'
  if (file.type.startsWith('image/') || PHOTO_EXT.test(name)) return 'photo'
  return 'other'
}

export function isVideoKind(kind: FileKind): boolean {
  return kind === 'video'
}

export function normalizeZipPath(relativePath: string): string {
  const cleaned = relativePath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '')
  return cleaned || 'file'
}

export function zipEntryBaseName(relativePath: string): string {
  const parts = normalizeZipPath(relativePath).split('/')
  return parts[parts.length - 1] ?? relativePath
}

export function replaceZipPathExtension(relativePath: string, newExt: string): string {
  const normalized = normalizeZipPath(relativePath)
  const dot = normalized.lastIndexOf('.')
  const base = dot > normalized.lastIndexOf('/') ? normalized.slice(0, dot) : normalized
  const ext = newExt.startsWith('.') ? newExt : `.${newExt}`
  return `${base}${ext}`
}
