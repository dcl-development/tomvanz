type ShapeProps = {
  className?: string
}

export function PhotoShape({className}: ShapeProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <rect x="3" y="3" width="10" height="10" fill="currentColor" stroke="white" strokeWidth="1.5" />
    </svg>
  )
}

export function TrackShape({className}: ShapeProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <path
        d="M2 12 C5 4, 11 12, 14 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
