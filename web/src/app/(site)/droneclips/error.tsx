'use client'

export default function DroneClipsError({
  reset,
}: {
  error: Error & {digest?: string}
  reset: () => void
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#e8e8e8] p-6 text-center text-[14px]">
      <p>Couldn’t open the clip tool.</p>
      <p className="max-w-sm text-black/55">Try Chrome or Edge on a computer, then reload this page.</p>
      <button type="button" onClick={reset} className="underline">
        Try again
      </button>
    </div>
  )
}
