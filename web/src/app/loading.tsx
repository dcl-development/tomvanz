export default function Loading() {
  return (
    <div className="flex h-dvh flex-col bg-white">
      <header className="flex h-12 shrink-0 items-center border-b border-black/10 px-4 md:h-14 md:px-5">
        <p className="text-[18px] tracking-tight md:text-[20px]">Tom Vanz</p>
      </header>
      <div className="flex min-h-0 flex-1 items-center justify-center bg-[#e8e8e8] text-[14px] text-black/50">
        Loading map
      </div>
    </div>
  )
}
