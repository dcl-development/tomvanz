interface FileSystemWritableFileStream extends WritableStream {
  close(): Promise<void>
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>
}

interface FileSystemDirectoryHandle {
  getFileHandle(name: string, options?: {create?: boolean}): Promise<FileSystemFileHandle>
}

interface Window {
  showDirectoryPicker?(options?: {mode?: 'read' | 'readwrite'}): Promise<FileSystemDirectoryHandle>
}
