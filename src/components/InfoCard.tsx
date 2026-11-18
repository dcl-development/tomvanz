'use client'

import {useEffect, useMemo, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {CloseIcon} from './CloseIcon'
import {ElevationChart} from './ElevationChart'
import {PinShape} from './shapes'
import {formatMiles, lineMiles} from '@/lib/geo'
import {urlFor} from '@/lib/sanity/image'
import {lineCoordinates, type MapData, type PinKind, type SelectedItem} from '@/lib/sanity/types'
import {trackColor} from '@/lib/track-color'

type Props = {
  data: MapData
  selected: SelectedItem
  onClose: () => void
}

type CardModel = {
  title: string
  eyebrow: string
  stats: string[]
  body: string | null
  imageUrl: string | null
  fullUrl: string | null
  imageAlt: string
  accent: string
  kind: PinKind | null
  dashed: boolean
}

function formatDate(value?: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'})
}

function kindLabel(kind: PinKind) {
  if (kind === 'trip') return 'Trip'
  if (kind === 'mountain') return 'Mountain'
  if (kind === 'park') return 'Park'
  return 'Place'
}

function activityLabel(activity: string) {
  if (activity === 'bike') return 'Bike'
  if (activity === 'hike') return 'Hike'
  return 'Track'
}

function cardModel(data: MapData, selected: SelectedItem): CardModel | null {
  if (selected.kind === 'track') {
    const track = data.tracks.find((item) => item._id === selected.id)
    if (!track) return null
    const when = formatDate(track.startedAt)
    const miles = lineMiles(lineCoordinates(track.route))
    const stats = [when, miles ? formatMiles(miles) : null].filter((item): item is string =>
      Boolean(item),
    )
    return {
      title: track.title,
      eyebrow: activityLabel(track.activity),
      stats,
      body: null,
      imageUrl: track.photo?.asset
        ? urlFor(track.photo).width(1000).height(750).fit('crop').url()
        : null,
      fullUrl: track.photo?.asset ? urlFor(track.photo).width(2400).fit('max').url() : null,
      imageAlt: track.title,
      accent: trackColor(track.activity),
      kind: null,
      dashed: track.activity === 'hike',
    }
  }

  const pin = data.pins.find((item) => item._id === selected.id)
  if (!pin) return null
  const when = formatDate(pin.at)
  return {
    title: pin.title,
    eyebrow: kindLabel(pin.kind),
    stats: when ? [when] : [],
    body: pin.note ?? null,
    imageUrl: pin.photo?.asset
      ? urlFor(pin.photo).width(1000).height(750).fit('crop').url()
      : null,
    fullUrl: pin.photo?.asset ? urlFor(pin.photo).width(2400).fit('max').url() : null,
    imageAlt: pin.title,
    accent: '#111',
    kind: pin.kind,
    dashed: false,
  }
}

function Lightbox({url, alt, onClose}: {url: string; alt: string; onClose: () => void}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <div
      role="dialog"
      aria-label={alt}
      onClick={onClose}
      className="tv-lightbox fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="max-h-full max-w-full rounded-lg object-contain" />
      <button
        type="button"
        aria-label="Close photo"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25"
      >
        <CloseIcon className="h-[18px] w-[18px]" />
      </button>
    </div>,
    document.body,
  )
}

/**
 * Colours the card's pointer (the little arrow down to its photo on the map) to match the
 * bottom of the card: white when there's a details section, dark when the photo runs to the edge.
 */
function PointerColor({light}: {light: boolean}) {
  const ref = useRef<HTMLSpanElement | null>(null)
  useEffect(() => {
    ref.current?.closest<HTMLElement>('.tv-popup')?.style.setProperty('--tip', light ? '#ffffff' : '#0c0c0c')
  }, [light])
  return <span ref={ref} hidden />
}

export function InfoCard({data, selected, onClose}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const track = selected.kind === 'track' ? data.tracks.find((item) => item._id === selected.id) : undefined
  const routeCoords = useMemo(() => (track ? lineCoordinates(track.route) : null), [track])
  const card = cardModel(data, selected)
  if (!card) return null

  const share = async () => {
    const url = new URL('/map', window.location.origin)
    url.searchParams.set(selected.kind === 'pin' ? 'photo' : 'track', selected.id)
    try {
      if (navigator.share) {
        await navigator.share({title: card.title, url: url.toString()})
        return
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(url.toString())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked: nothing more we can do */
    }
  }

  const frame =
    'tv-card w-[min(340px,calc(100vw-24px))] max-h-[var(--card-max,520px)] overflow-y-auto overflow-x-hidden rounded-[22px] bg-white shadow-[0_24px_64px_rgba(0,0,0,0.3)] ring-1 ring-black/5'

  // An untitled photo leads with its date instead of leaving a blank headline.
  const untitled = card.title.trim() === ''
  const headline = untitled ? (card.stats[0] ?? '') : card.title
  const chips = untitled ? card.stats.slice(1) : card.stats
  const hasRoute = Boolean(routeCoords && routeCoords.length >= 2)
  const hasDetails = chips.length > 0 || Boolean(card.body) || hasRoute
  const hasCaption = Boolean(headline) || Boolean(card.eyebrow)

  return (
    <article className={frame}>
      <PointerColor light={hasDetails} />
      <div className="relative aspect-[4/3] overflow-hidden bg-neutral-200">
        {card.imageUrl ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label="View photo full size"
            className="block h-full w-full cursor-zoom-in"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={card.imageUrl}
              alt={card.imageAlt}
              className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
            />
          </button>
        ) : (
          <div
            className="absolute inset-0"
            style={{background: `linear-gradient(160deg, ${card.accent} 0%, #1a1a1a 78%)`}}
          >
            <svg viewBox="0 0 300 225" className="absolute inset-0 h-full w-full opacity-30" aria-hidden>
              <path
                d="M18 160 C70 50, 120 170, 170 80 S250 50, 286 130"
                fill="none"
                stroke="white"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={card.dashed ? '14 12' : undefined}
              />
            </svg>
          </div>
        )}

        {hasCaption ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
        ) : null}


        <button
          type="button"
          onClick={share}
          aria-label="Share link"
          className="absolute left-3 top-3 flex h-9 items-center gap-1.5 rounded-full bg-black/35 px-3 text-[12px] font-semibold text-white backdrop-blur-md transition hover:bg-black/50 active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3v12M12 3l-4 4M12 3l4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
          </svg>
          {copied ? 'Link copied' : 'Share'}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition hover:bg-black/50 active:scale-95"
        >
          <CloseIcon className="h-4 w-4" />
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
            {card.kind ? <PinShape kind={card.kind} className="h-3.5 w-3.5 text-white" /> : null}
            {card.eyebrow}
          </p>
          {headline ? (
            <h2 className="mt-1 text-[24px] font-bold leading-[1.1] tracking-tight [text-shadow:0_1px_12px_rgba(0,0,0,0.35)]">
              {headline}
            </h2>
          ) : null}
        </div>
      </div>

      {hasDetails ? (
        <div className="px-4 pb-4 pt-3.5">
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((stat) => (
                <span
                  key={stat}
                  className="rounded-full bg-black/[0.06] px-3 py-1 text-[12px] font-medium text-black/70"
                >
                  {stat}
                </span>
              ))}
            </div>
          ) : null}
          {card.body ? (
            <p className={`${chips.length ? 'mt-3' : ''} text-[14px] leading-relaxed text-black/70`}>
              {card.body}
            </p>
          ) : null}
          {hasRoute && routeCoords ? <ElevationChart coords={routeCoords} color={card.accent} /> : null}
        </div>
      ) : null}

      {expanded && card.fullUrl ? (
        <Lightbox url={card.fullUrl} alt={card.imageAlt} onClose={() => setExpanded(false)} />
      ) : null}
    </article>
  )
}
