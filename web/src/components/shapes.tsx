import type {PinKind} from '@/lib/sanity/types'

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

export function CatchShape({className}: ShapeProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <circle cx="8" cy="8" r="5" fill="currentColor" stroke="white" strokeWidth="2" />
    </svg>
  )
}

export function MountainShape({className}: ShapeProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <path d="M8 3 L13 13 H3 Z" fill="currentColor" stroke="white" strokeWidth="1.5" />
    </svg>
  )
}

export function ParkShape({className}: ShapeProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  )
}

export function PlaceShape({className}: ShapeProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <rect x="4" y="4" width="8" height="8" fill="currentColor" stroke="white" strokeWidth="1.5" />
    </svg>
  )
}

export function PinShape({kind, className}: {kind: PinKind; className?: string}) {
  if (kind === 'trip') return <CatchShape className={className} />
  if (kind === 'mountain') return <MountainShape className={className} />
  if (kind === 'park') return <ParkShape className={className} />
  return <PlaceShape className={className} />
}
