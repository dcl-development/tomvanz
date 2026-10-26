'use client'

import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react'

import {
  checkBatchEstimatedOutputSize,
  checkEstimatedOutputSize,
  compressVideoFile,
  type EncodeResult,
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

type QueueStatus =
  | 'waiting'
  | 'probing'
  | 'ready'
  | 'compressing'
  | 'done'
  | 'error'
  | 'canceled'

type QueueItem = {
  id: string
  file: File
  probe: FileProbe | null
  probeError: string | null
  status: QueueStatus
  progress: number
  message: string | null
  downloadFileName: string | null
  canDownload: boolean
}

type BatchSummary = {
  done: number
  failed: number
  total: number
} | null

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** One object URL per download; revoked shortly after the click so nothing persists per clip. */
function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.append(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 250)
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
  const [batchSummary, setBatchSummary] = useState<BatchSummary>(null)
  const [batchWarning, setBatchWarning] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const cancelRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const downloadBlobsRef = useRef<Map<string, EncodeResult>>(new Map())
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const mode = getMode(modeId)

  const totalInputBytes = useMemo(
    () => items.reduce((sum, item) => sum + item.file.size, 0),
    [items],
  )

  const estimatedTotalOutput = useMemo(
    () => estimateOutputBytes(totalInputBytes, mode),
    [totalInputBytes, mode],
  )

  const hasPendingClips = useMemo(() => items.some((item) => item.status !== 'done'), [items])

  const doneItems = useMemo(() => items.filter((item) => item.status === 'done' && item.canDownload), [items])

  const selectedDoneCount = useMemo(
    () => doneItems.filter((item) => selectedIds.has(item.id)).length,
    [doneItems, selectedIds],
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
      setBatchSummary(null)
      setBatchWarning(null)
      const next: QueueItem[] = files.map((file) => ({
        id: newId(),
        file,
        probe: null,
        probeError: null,
        status: 'probing',
        progress: 0,
        message: null,
        downloadFileName: null,
        canDownload: false,
      }))
      setItems((prev) => [...prev, ...next])
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

  const removeClip = useCallback(
    (id: string) => {
      if (busy) return
      downloadBlobsRef.current.delete(id)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setItems((prev) => prev.filter((item) => item.id !== id))
    },
    [busy],
  )

  const clearQueue = useCallback(() => {
    if (busy) return
    downloadBlobsRef.current.clear()
    setSelectedIds(new Set())
    setBatchSummary(null)
    setBatchWarning(null)
    setItems([])
  }, [busy])

  const cancelCompress = useCallback(() => {
    cancelRef.current?.abort()
  }, [])

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAllDone = useCallback(() => {
    setSelectedIds(new Set(doneItems.map((item) => item.id)))
  }, [doneItems])

  const selectNoneDone = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const downloadSelected = useCallback(async () => {
    const ordered = doneItems.filter((item) => selectedIds.has(item.id))
    for (const item of ordered) {
      const saved = downloadBlobsRef.current.get(item.id)
      if (!saved) continue
      triggerDownload(saved.blob, saved.fileName)
      await new Promise((resolve) => window.setTimeout(resolve, 400))
    }
  }, [doneItems, selectedIds])

  const encodeClip = useCallback(
    async (itemId: string, signal: AbortSignal) => {
      const item = itemsRef.current.find((entry) => entry.id === itemId)
      if (!item || item.status === 'done') return 'skipped' as const

      const estimated = estimateOutputBytes(item.file.size, mode)
      const sizeCheck = checkEstimatedOutputSize(estimated)
      if (!sizeCheck.ok) {
        updateItem(itemId, {
          status: 'error',
          progress: 0,
          message: sizeCheck.error,
          canDownload: false,
        })
        return 'error' as const
      }

      downloadBlobsRef.current.delete(itemId)
      updateItem(itemId, {
        status: 'compressing',
        progress: 0,
        message: null,
        downloadFileName: null,
        canDownload: false,
      })

      try {
        const result = await compressVideoFile(
          item.file,
          mode,
          ({progress}) => {
            updateItem(itemId, {progress: Math.round(progress * 100)})
          },
          signal,
        )

        downloadBlobsRef.current.set(itemId, result)
        setSelectedIds((prev) => new Set(prev).add(itemId))
        updateItem(itemId, {
          status: 'done',
          progress: 100,
          downloadFileName: result.fileName,
          canDownload: true,
          message: 'Ready — use Download when you want a copy on disk.',
        })
        return 'done' as const
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Something went wrong.'
        if (message === 'Canceled') {
          updateItem(itemId, {status: 'canceled', progress: 0, message: 'Canceled', canDownload: false})
          throw error
        }
        updateItem(itemId, {status: 'error', progress: 0, message, canDownload: false})
        return 'error' as const
      }
    },
    [mode, updateItem],
  )

  const runCompress = useCallback(async () => {
    if (busy) return
    const queue = itemsRef.current.filter((item) => item.status !== 'done')
    if (queue.length === 0) return

    const doneBytes = itemsRef.current
      .filter((item) => item.status === 'done')
      .reduce((sum, item) => {
        const blob = downloadBlobsRef.current.get(item.id)?.blob
        return sum + (blob?.size ?? estimateOutputBytes(item.file.size, mode))
      }, 0)
    const pendingEstimate = queue.reduce(
      (sum, item) => sum + estimateOutputBytes(item.file.size, mode),
      0,
    )
    const batchCheck = checkBatchEstimatedOutputSize(doneBytes + pendingEstimate)
    if (!batchCheck.ok) {
      setBatchWarning(batchCheck.error)
      return
    }
    setBatchWarning(null)
    setBatchSummary(null)

    setBusy(true)
    const abort = new AbortController()
    cancelRef.current = abort

    let done = 0
    let failed = 0
    const total = queue.length

    try {
      for (const item of queue) {
        if (abort.signal.aborted) break
        const latest = itemsRef.current.find((entry) => entry.id === item.id)
        if (!latest || latest.status === 'done') continue
        try {
          const outcome = await encodeClip(item.id, abort.signal)
          if (outcome === 'done') done += 1
          else if (outcome === 'error') failed += 1
        } catch (error) {
          if (error instanceof Error && error.message === 'Canceled') break
        }
      }
    } finally {
      setBusy(false)
      cancelRef.current = null
      const stillPending = itemsRef.current.filter((item) => item.status !== 'done' && item.status !== 'error' && item.status !== 'canceled')
      if (!abort.signal.aborted && stillPending.length === 0) {
        const finalDone = itemsRef.current.filter((i) => i.status === 'done').length
        const finalFailed = itemsRef.current.filter((i) => i.status === 'error' || i.status === 'canceled').length
        if (finalFailed === 0) {
          setBatchSummary({done: finalDone, failed: 0, total: finalDone})
        } else {
          setBatchSummary({done: finalDone, failed: finalFailed, total: finalDone + finalFailed})
        }
      } else if (!abort.signal.aborted) {
        setBatchSummary({done, failed, total})
      }
    }
  }, [busy, encodeClip, mode])

  const retryClip = useCallback(
    async (itemId: string) => {
      if (busy) return
      const item = itemsRef.current.find((entry) => entry.id === itemId)
      if (!item || item.status === 'done' || item.status === 'compressing') return

      setBusy(true)
      const abort = new AbortController()
      cancelRef.current = abort
      try {
        await encodeClip(itemId, abort.signal)
      } finally {
        setBusy(false)
        cancelRef.current = null
      }
    },
    [busy, encodeClip],
  )

  const canCompress = support?.supported && hasPendingClips && !busy

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

        {batchWarning ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-[14px] leading-snug text-amber-950" role="alert">
            {batchWarning}
          </p>
        ) : null}

        {batchSummary && !busy ? (
          <p className="mt-4 rounded-xl bg-black/[0.06] px-4 py-3 text-[14px] font-bold text-black">
            {batchSummary.failed === 0
              ? `All done: ${batchSummary.done} of ${batchSummary.total}`
              : `Done: ${batchSummary.done} of ${batchSummary.total}, ${batchSummary.failed} failed`}
          </p>
        ) : null}

        {items.length > 0 ? (
          <div className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-black/40">
                {items.length} clip{items.length === 1 ? '' : 's'}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {doneItems.length > 0 && !busy ? (
                  <>
                    <button
                      type="button"
                      className="text-[13px] text-black/45 underline-offset-2 hover:text-black/70 hover:underline"
                      onClick={selectAllDone}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="text-[13px] text-black/45 underline-offset-2 hover:text-black/70 hover:underline"
                      onClick={selectNoneDone}
                    >
                      Select none
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-black px-4 py-2 text-[13px] font-bold text-white disabled:opacity-40"
                      disabled={selectedDoneCount === 0}
                      onClick={() => void downloadSelected()}
                    >
                      Download selected ({selectedDoneCount})
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className="text-[13px] text-black/45 underline-offset-2 hover:text-black/70 hover:underline"
                  onClick={clearQueue}
                  disabled={busy}
                >
                  Clear list
                </button>
              </div>
            </div>
            <ul className="mt-3 space-y-3">
              {items.map((item) => (
                <li key={item.id} className="rounded-xl bg-black/[0.04] px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    {item.status === 'done' && item.canDownload ? (
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 accent-black"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelected(item.id)}
                        disabled={busy}
                        aria-label={`Select ${item.file.name} for download`}
                      />
                    ) : (
                      <span className="mt-1 inline-block h-4 w-4 shrink-0" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
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
                      {item.status === 'done' && item.canDownload ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="rounded-full bg-black px-4 py-2 text-[13px] font-bold text-white disabled:opacity-40"
                            onClick={() => {
                              const saved = downloadBlobsRef.current.get(item.id)
                              if (saved) triggerDownload(saved.blob, saved.fileName)
                            }}
                          >
                            Download
                          </button>
                          {item.downloadFileName ? (
                            <span className="text-[12px] text-black/55">{item.downloadFileName}</span>
                          ) : null}
                        </div>
                      ) : null}
                      {(item.status === 'error' || item.status === 'canceled') && !busy ? (
                        <button
                          type="button"
                          className="mt-2 text-[13px] font-bold text-black underline underline-offset-2"
                          onClick={() => void retryClip(item.id)}
                        >
                          Try again
                        </button>
                      ) : null}
                    </div>
                    {!busy ? (
                      <button
                        type="button"
                        className="shrink-0 text-[12px] text-black/40 hover:text-black/70"
                        onClick={() => removeClip(item.id)}
                        aria-label={`Remove ${item.file.name}`}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
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

        <p className="mt-10 text-[12px] leading-snug text-black/45">
          Clips compress one at a time and stay in memory until you download or clear the list. Nothing is written to
          disk until you choose Download.
        </p>
      </div>
    </div>
  )
}
