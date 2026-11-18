'use client'

type Props = {
  threeD: boolean
  onChange: (next: boolean) => void
}

/** The 3D toggle, top right (the same height as the Search button on the left). */
export function ThreeDButton({threeD, onChange}: Props) {
  return (
    <button
      type="button"
      onClick={() => onChange(!threeD)}
      aria-pressed={threeD}
      aria-label={threeD ? 'Switch to flat map' : 'Switch to 3D terrain'}
      className={`absolute right-3 top-3 z-10 flex h-[44px] min-w-[56px] items-center justify-center rounded-full px-4 text-[13px] font-semibold shadow-sm ring-1 ring-black/10 transition md:right-4 md:top-4 ${
        threeD ? 'bg-black text-white' : 'bg-white/90 text-black'
      }`}
    >
      3D
    </button>
  )
}
