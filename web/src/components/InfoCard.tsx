'use client'

import {PinShape} from './shapes'
import {formatMiles, lineMiles} from '@/lib/geo'
import {urlFor} from '@/lib/sanity/image'
import {lineCoordinates, type MapData, type PinKind, type SelectedItem} from '@/lib/sanity/types'
import {trackColor} from '@/lib/track-color'

type Props = {
  data: MapData
  selected: SelectedItem
  onClose: () => void
  placement: 'sheet' | 'popup'
}

type CardModel = {
  title: string
  eyebrow: string
  stats: string[]
  body: string | null
  imageUrl: string | null
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
  if (selected.kind === 'photo') {
    const photo = data.photos.find((item) => item._id === selected.id)
    if (!photo) return null
    const when = formatDate(photo.takenAt)
    return {
      title: photo.fish,
      eyebrow: 'Trip',
      stats: when ? [when] : [],
      body: photo.caption ?? null,
      imageUrl: photo.image?.asset
        ? urlFor(photo.image).width(900).height(560).fit('crop').url()
        : null,
      imageAlt: photo.fish,
      accent: '#111',
      kind: 'trip',
      dashed: false,
    }
  }

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
        ? urlFor(track.photo).width(900).height(560).fit('crop').url()
        : null,
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
      ? urlFor(pin.photo).width(900).height(560).fit('crop').url()
      : null,
    imageAlt: pin.title,
    accent: '#111',
    kind: pin.kind,
    dashed: false,
  }
}

export function InfoCard({data, selected, onClose, placement}: Props) {
  const card = cardModel(data, selected)
  if (!card) return null

  const frame =
    placement === 'sheet'
      ? 'tv-card absolute inset-x-0 bottom-0 z-20 max-h-[58vh] overflow-auto rounded-t-2xl bg-white shadow-[0_-8px_32px_rgba(0,0,0,0.18)]'
      : 'tv-card w-[300px] overflow-hidden rounded-2xl bg-white shadow-[0_12px_40px_rgba(0,0,0,0.22)]'

  return (
    <article className={frame}>
      {placement === 'sheet' ? (
        <div className="flex justify-center bg-white pt-2">
          <div className="h-1 w-10 rounded-full bg-black/15" />
        </div>
      ) : null}

      <div className="relative aspect-[16/10] overflow-hidden bg-neutral-200">
        {card.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.imageUrl} alt={card.imageAlt} className="h-full w-full object-cover" />
        ) : (
          <div
            className="absolute inset-0"
            style={{background: `linear-gradient(160deg, ${card.accent} 0%, #1a1a1a 78%)`}}
          >
            <svg
              viewBox="0 0 300 188"
              className="absolute inset-0 h-full w-full opacity-40"
              aria-hidden
            >
              <path
                d="M18 140 C70 40, 120 150, 170 70 S250 40, 286 110"
                fill="none"
                stroke="white"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={card.dashed ? '14 12' : undefined}
              />
            </svg>
            {card.kind ? (
              <PinShape kind={card.kind} className="absolute bottom-3 left-3 h-7 w-7 text-white" />
            ) : null}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[18px] leading-none text-black shadow-sm"
        >
          ×
        </button>
      </div>

      <div className="px-4 pb-4 pt-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/40">{card.eyebrow}</p>
        <h2 className="mt-1 text-[22px] font-bold leading-tight tracking-tight">{card.title}</h2>
        {card.stats.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {card.stats.map((stat) => (
              <span
                key={stat}
                className="rounded-full bg-black/[0.06] px-2.5 py-1 text-[12px] text-black/70"
              >
                {stat}
              </span>
            ))}
          </div>
        ) : null}
        {card.body ? (
          <p className="mt-3 text-[14px] leading-snug text-black/70">{card.body}</p>
        ) : null}
      </div>
    </article>
  )
}
