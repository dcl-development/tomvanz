'use client'

// Anything unexpected on a site page lands here instead of a blank screen.
export default function SiteError({
  reset,
}: {
  error: Error & {digest?: string}
  reset: () => void
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#e8e8e8] p-6 text-center text-[14px]">
      <p>Something went wrong loading this page.</p>
      <p className="max-w-sm text-black/55">It’s probably temporary. Try again in a moment.</p>
      <button type="button" onClick={reset} className="underline">
        Try again
      </button>
    </div>
  )
}
