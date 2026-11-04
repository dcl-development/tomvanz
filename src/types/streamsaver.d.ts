declare module 'streamsaver' {
  const streamSaver: {
    mitm: string
    createWriteStream: (filename: string, options?: {size?: number}) => WritableStream<Uint8Array>
  }
  export default streamSaver
}

interface Window {
  showSaveFilePicker?: (options?: {
    suggestedName?: string
    types?: {description: string; accept: Record<string, string[]>}[]
  }) => Promise<FileSystemFileHandle>
}
