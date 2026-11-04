import {normalizeZipPath} from './file-kind'

export type IngestedFile = {
  file: File
  relativePath: string
}

function fromFileList(fileList: FileList | File[]): IngestedFile[] {
  const files = Array.from(fileList)
  if (files.length === 0) return []

  return files.map((file) => {
    const fromWebkit = (file as File & {webkitRelativePath?: string}).webkitRelativePath
    const relativePath = normalizeZipPath(fromWebkit && fromWebkit.length > 0 ? fromWebkit : file.name)
    return {file, relativePath}
  })
}

function readDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    reader.readEntries(resolve, reject)
  })
}

async function readAllDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = []
  for (;;) {
    const batch = await readDirectoryEntries(reader)
    if (batch.length === 0) break
    all.push(...batch)
  }
  return all
}

async function traverseEntry(entry: FileSystemEntry, prefix: string, out: IngestedFile[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      ;(entry as FileSystemFileEntry).file(resolve, reject)
    })
    const relativePath = normalizeZipPath(prefix ? `${prefix}/${file.name}` : file.name)
    out.push({file, relativePath})
    return
  }

  if (entry.isDirectory) {
    const dir = entry as FileSystemDirectoryEntry
    const reader = dir.createReader()
    const children = await readAllDirectoryEntries(reader)
    const nextPrefix = prefix ? `${prefix}/${dir.name}` : dir.name
    for (const child of children) {
      await traverseEntry(child, nextPrefix, out)
    }
  }
}

export async function ingestFromDataTransfer(dataTransfer: DataTransfer): Promise<IngestedFile[]> {
  const items = dataTransfer.items
  if (items && items.length > 0) {
    const entries: FileSystemEntry[] = []
    for (let i = 0; i < items.length; i++) {
      const entry = items[i]?.webkitGetAsEntry?.()
      if (entry) entries.push(entry)
    }
    if (entries.length > 0) {
      const out: IngestedFile[] = []
      for (const entry of entries) {
        await traverseEntry(entry, '', out)
      }
      return out
    }
  }
  return fromFileList(dataTransfer.files)
}

export function ingestFromFileList(fileList: FileList | File[]): IngestedFile[] {
  return fromFileList(fileList)
}
