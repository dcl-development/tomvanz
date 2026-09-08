'use client'

export default function ErrorState({
  reset,
}: {
  error: Error & {digest?: string}
  reset: () => void
}) {
  return (
    <div className="flex h-dvh flex-col bg-white">
      <header className="flex h-12 shrink-0 items-center border-b border-black/10 px-4 md:h-14 md:px-5">
        <p className="text-[18px] tracking-tight md:text-[20px]">Tom Vanz</p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-[#e8e8e8] text-[14px]">
        <p>Couldn’t load the map.</p>
        <button type="button" onClick={reset} className="underline">
          Try again
        </button>
      </div>
    </div>
  )
}
