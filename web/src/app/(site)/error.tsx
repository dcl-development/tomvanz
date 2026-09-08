'use client'

export default function ErrorState({
  reset,
}: {
  error: Error & {digest?: string}
  reset: () => void
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#e8e8e8] text-[14px]">
      <p>Couldn’t load the map.</p>
      <button type="button" onClick={reset} className="underline">
        Try again
      </button>
    </div>
  )
}
