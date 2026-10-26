'use client'

import {useCallback, useMemo, useRef, useState, useSyncExternalStore} from 'react'

import {
  bufferSinkForFile,
  canPickOutputDirectory,
  compressVideoFile,
  createDirectorySink,
  pickOutputDirectory,
  type EncodeResult,
  type OutputSink,
} from '@/lib/droneclips/encode'
import {formatBytes} from '@/lib/droneclips/format'
import {
  COMPRESS_MODES,
  DEFAULT_MODE_ID,
  estimateOutputBytes,
  getMode,
  type CompressModeId,
} from '@/lib/droneclips/modes'
import {probeVideoFile, type FileProbe} from '@/lib/droneclips/probe'
import type {WebCodecsSupport} from '@/lib/droneclips/support'

type QueueItem = {
  id: string
  file: File
  probe: FileProbe | null
  probeError: string | null
  status: 'waiting' | 'probing' | 'ready' | 'compressing' | 'done' | 'error' | 'canceled'
  progress: number
  message: string | null
  result: EncodeResult | null
  downloadUrl: string | null
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function triggerDownload(url: string, fileName: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.append(a)
  a.click()
  a.remove()
}

const SUPPORT_OK: WebCodecsSupport = {supported: true, reason: null}
const SUPPORT_MISSING: WebCodecsSupport = {
  supported: false,
  reason:
    'This browser cannot compress video here. Try the latest Chrome, Edge, or Safari on a laptop or desktop.',
}

function readSupport(): WebCodecsSupport {
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') {
    return SUPPORT_MISSING
  }
  return SUPPORT_OK
}

export function DroneClipsApp() {
  const support = useSyncExternalStore(() => () => {}, readSupport, () => SUPPORT_OK)
  const [modeId, setModeId] = useState<CompressModeId>(DEFAULT_MODE_ID)
  const [items, setItems] = useState<QueueItem[]>([])
  const [busy, setBusy] = useState(false)
  const [batchError, setBatchError] = useState<string | null>(null)
  const cancelRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const mode = getMode(modeId)

  const totalInputBytes = useMemo(
    () => items.reduce((sum, item) => sum + item.file.size, 0),
    [items],
  )

  const estimatedTotalOutput = useMemo(
    () => estimateOutputBytes(totalInputBytes, mode),
    [totalInputBytes, mode],
  )

  const updateItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? {...item, ...patch} : item)))
  }, [])

  const probeItem = useCallback(
    async (id: string, file: File, probeMode = mode) => {
      updateItem(id, {status: 'probing', probeError: null})
      try {
        const probe = await probeVideoFile(file, probeMode)
        updateItem(id, {probe, status: 'ready', probeError: null})
      } catch {
        updateItem(id, {
          status: 'ready',
          probe: {
            durationSec: null,
            displayWidth: null,
            displayHeight: null,
            hasAudio: false,
            estimatedOutputBytes: estimateOutputBytes(file.size, probeMode),
            outputWidth: null,
            outputHeight: null,
          },
          probeError: null,
        })
      }
    },
    [mode, updateItem],
  )

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) => f.type.startsWith('video/') || /\.(mov|mp4|m4v)$/i.test(f.name))
      if (files.length === 0) return
      const next: QueueItem[] = files.map((file) => ({
        id: newId(),
        file,
        probe: null,
        probeError: null,
        status: 'probing',
        progress: 0,
        message: null,
        result: null,
        downloadUrl: null,
      }))
      setItems((prev) => [...prev, ...next])
      setBatchError(null)
      for (const item of next) {
        void probeItem(item.id, item.file, mode)
      }
    },
    [mode, probeItem],
  )

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files)
    },
    [addFiles],
  )

  const revokeDownloads = useCallback((list: QueueItem[]) => {
    for (const item of list) {
      if (item.downloadUrl) URL.revokeObjectURL(item.downloadUrl)
    }
  }, [])

  const clearQueue = useCallback(() => {
    if (busy) return
    setItems((prev) => {
      revokeDownloads(prev)
      return []
    })
    setBatchError(null)
  }, [busy, revokeDownloads])

  const cancelCompress = useCallback(() => {
    cancelRef.current?.abort()
  }, [])

  const runCompress = useCallback(async () => {
    if (items.length === 0 || busy) return
    setBatchError(null)
    setBusy(true)
    const abort = new AbortController()
    cancelRef.current = abort

    let sink: OutputSink | null = null
    const multi = items.length > 1
    if (multi && canPickOutputDirectory()) {
      const dir = await pickOutputDirectory()
      if (dir) sink = createDirectorySink(dir)
    }
    if (multi && canPickOutputDirectory() && !sink) {
      setBatchError('Choose a folder to save your clips, then try again.')
      setBusy(false)
      cancelRef.current = null
      return
    }

    if (!sink && multi) {
      setBatchError(
        'For several clips at once, use Chrome or Edge on a computer so you can pick a folder. Or add one clip at a time.',
      )
      setBusy(false)
      cancelRef.current = null
      return
    }

    try {
      for (const item of items) {
        if (abort.signal.aborted) break
        if (item.status === 'done') continue

        let fileSink: OutputSink | {error: string}
        if (sink) {
          fileSink = sink
        } else {
          fileSink = bufferSinkForFile(item.file.size)
          if ('error' in fileSink) {
            updateItem(item.id, {status: 'error', message: fileSink.error})
            continue
          }
        }

        updateItem(item.id, {status: 'compressing', progress: 0, message: null})

        try {
          const result = await compressVideoFile(
            item.file,
            mode,
            fileSink,
            ({progress}) => {
              updateItem(item.id, {progress: Math.round(progress * 100)})
            },
            abort.signal,
          )

          let downloadUrl: string | null = null
          if (result.kind === 'blob') {
            downloadUrl = URL.createObjectURL(result.blob)
            triggerDownload(downloadUrl, result.fileName)
          }

          updateItem(item.id, {
            status: 'done',
            progress: 100,
            result,
            downloadUrl,
            message: result.kind === 'saved' ? `Saved as ${result.fileName}` : 'Ready to download',
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Something went wrong.'
          if (message === 'Canceled') {
            updateItem(item.id, {status: 'canceled', message: 'Canceled'})
          } else {
            updateItem(item.id, {status: 'error', message})
          }
          if (message === 'Canceled') break
        }
      }
    } finally {
      setBusy(false)
      cancelRef.current = null
    }
  }, [busy, items, mode, updateItem])

  const downloadAll = useCallback(() => {
    const ready = items.filter((item) => item.result?.kind === 'blob' && item.downloadUrl)
    ready.forEach((item, index) => {
      window.setTimeout(() => {
        if (item.downloadUrl && item.result?.kind === 'blob') {
          triggerDownload(item.downloadUrl, item.result.fileName)
        }
      }, index * 400)
    })
  }, [items])

  const hasBlobDownloads = items.some((item) => item.result?.kind === 'blob' && item.downloadUrl)
  const canCompress = support?.supported && items.length > 0 && !busy

  if (!support.supported) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#e8e8e8] p-6 text-center">
        <p className="max-w-md text-[17px] font-bold text-black">This page needs a newer browser</p>
        <p className="max-w-md text-[15px] leading-snug text-black/65">{support.reason}</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-[#e8e8e8]">
      <div className="mx-auto max-w-xl px-4 py-6 pb-10 md:py-8">
        <h1 className="text-[26px] font-bold tracking-tight text-black">Drone clips</h1>
        <p className="mt-2 text-[15px] leading-snug text-black/65">
          Shrink drone videos so they are easier to text or post. Your files stay on this device — nothing is uploaded.
        </p>

        <div
          className="mt-6 rounded-2xl border-2 border-dashed border-black/15 bg-white px-4 py-10 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <p className="text-[16px] font-bold text-black">Drop videos here</p>
          <p className="mt-1 text-[14px] text-black/55">or</p>
          <button
            type="button"
            className="mt-3 rounded-full bg-black px-6 py-3 text-[15px] font-bold text-white"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            Choose videos
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="video/*,.mov,.mp4,.m4v"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {items.length > 0 ? (
          <div className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-black/40">
                {items.length} clip{items.length === 1 ? '' : 's'}
              </p>
              <button
                type="button"
                className="text-[13px] text-black/45 underline-offset-2 hover:text-black/70 hover:underline"
                onClick={clearQueue}
                disabled={busy}
              >
                Clear list
              </button>
            </div>
            <ul className="mt-3 space-y-3">
              {items.map((item) => (
                <li key={item.id} className="rounded-xl bg-black/[0.04] px-3 py-2.5">
                  <p className="truncate text-[14px] font-bold text-black">{item.file.name}</p>
                  <p className="text-[12px] text-black/50">
                    {formatBytes(item.file.size)}
                    {` → about ${formatBytes(estimateOutputBytes(item.file.size, mode))}`}
                  </p>
                  {item.status === 'compressing' ? (
                    <div className="mt-2">
                      <div className="h-2 overflow-hidden rounded-full bg-black/10">
                        <div
                          className="h-full rounded-full bg-black transition-[width] duration-300"
                          style={{width: `${item.progress}%`}}
                        />
                      </div>
                      <p className="mt-1 text-[12px] text-black/55">{item.progress}%</p>
                    </div>
                  ) : null}
                  {item.message ? (
                    <p className="mt-1 text-[12px] text-black/60">{item.message}</p>
                  ) : null}
                  {item.result?.kind === 'blob' && item.downloadUrl ? (
                    <button
                      type="button"
                      className="mt-2 rounded-full bg-black px-4 py-2 text-[13px] font-bold text-white"
                      onClick={() => {
                        if (item.downloadUrl && item.result?.kind === 'blob') {
                          triggerDownload(item.downloadUrl, item.result.fileName)
                        }
                      }}
                    >
                      Download
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <fieldset className="mt-8 border-0 p-0" disabled={busy}>
          <legend
            id="compress-mode-legend"
            className="text-[13px] font-bold uppercase tracking-[0.12em] text-black/40"
          >
            How should we shrink them?
          </legend>
          <div
            role="radiogroup"
            aria-labelledby="compress-mode-legend"
            className="mt-3 rounded-2xl border-2 border-black/12 bg-white p-2 shadow-sm"
          >
            {COMPRESS_MODES.map((option, index) => {
              const selected = option.id === modeId
              const est = estimateOutputBytes(totalInputBytes || 0, option)
              const estLabel =
                totalInputBytes > 0
                  ? `About ${formatBytes(est)} total`
                  : 'Add clips to see an estimated size'
              return (
                <div key={option.id} className={index > 0 ? 'mt-2 border-t border-black/8 pt-2' : ''}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setModeId(option.id)}
                    className={`w-full cursor-pointer rounded-xl px-3.5 py-3.5 text-left transition-[background-color,border-color,box-shadow,transform] active:scale-[0.99] sm:px-4 sm:py-4 ${
                      selected
                        ? 'border-2 border-black bg-black text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                        : 'border-2 border-black/15 bg-white text-black hover:border-black/35 hover:bg-black/[0.02]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                          selected
                            ? 'border-white bg-white'
                            : 'border-black/30 bg-transparent'
                        }`}
                      >
                        {selected ? <span className="h-2 w-2 rounded-full bg-black" /> : null}
                      </span>
                      <span className="text-[17px] font-bold leading-tight">{option.label}</span>
                    </span>
                    <span
                      className={`mt-1.5 block pl-6 text-[14px] leading-snug sm:pl-6 ${
                        selected ? 'text-white/85' : 'text-black/60'
                      }`}
                    >
                      {option.description}
                    </span>
                    <span
                      className={`mt-2 block pl-6 text-[13px] font-bold sm:pl-6 ${
                        selected ? 'text-white/90' : 'text-black/70'
                      }`}
                    >
                      {estLabel}
                    </span>
                    <p
                      className={`mt-2.5 border-t pt-2.5 pl-6 text-[12px] leading-snug sm:pl-6 ${
                        selected
                          ? 'border-white/20 text-white/70'
                          : 'border-black/8 text-black/50'
                      }`}
                    >
                      {option.finePrint}
                    </p>
                  </button>
                </div>
              )
            })}
          </div>
        </fieldset>

        {batchError ? (
          <p className="mt-4 rounded-xl bg-amber-100 px-3 py-2 text-[13px] leading-snug text-amber-950">
            {batchError}
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {busy ? (
            <button
              type="button"
              className="flex-1 rounded-full border-2 border-black/20 bg-white py-4 text-[16px] font-bold text-black"
              onClick={cancelCompress}
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              className="flex-1 rounded-full bg-black py-4 text-[16px] font-bold text-white disabled:opacity-40"
              disabled={!canCompress}
              onClick={() => void runCompress()}
            >
              Compress
            </button>
          )}
        </div>

        {totalInputBytes > 0 ? (
          <p className="mt-3 text-center text-[13px] text-black/50">
            {formatBytes(totalInputBytes)} selected → about {formatBytes(estimatedTotalOutput)} with{' '}
            {mode.label.toLowerCase()}
          </p>
        ) : null}

        {hasBlobDownloads && items.filter((i) => i.status === 'done').length > 1 ? (
          <button
            type="button"
            className="mt-4 w-full rounded-full border-2 border-black/15 bg-white py-3 text-[15px] font-bold text-black"
            onClick={downloadAll}
          >
            Download all again
          </button>
        ) : null}

        <p className="mt-10 text-[12px] leading-snug text-black/45">
          Clips are processed one at a time on your computer. Large batches work best in Chrome or Edge when you can pick
          a folder to save into.
        </p>
      </div>
    </div>
  )
}
