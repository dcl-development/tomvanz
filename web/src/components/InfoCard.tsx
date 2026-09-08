'use client'

import {PinShape} from './shapes'
import {urlFor} from '@/lib/sanity/image'
import type {MapData, PinKind, SelectedItem} from '@/lib/sanity/types'

type Props = {
  data: MapData
  selected: SelectedItem
  onClose: () => void
}

function formatDate(value?: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'})
}

function kindLabel(kind: PinKind) {
  if (kind === 'catch') return 'Catch'
  if (kind === 'mountain') return 'Mountain'
  if (kind === 'park') return 'Park'
  return 'Place'
}

function activityLabel(activity: string) {
  if (activity === 'bike') return 'Bike'
  if (activity === 'hike') return 'Hike'
  return 'Track'
}

export function InfoCard({data, selected, onClose}: Props) {
  let title = ''
  let meta: string | null = null
  let body: string | null = null
  let imageUrl: string | null = null
  let kind: PinKind | null = null

  if (selected.kind === 'photo') {
    const photo = data.photos.find((item) => item._id === selected.id)
    if (!photo) return null
    title = photo.fish
    meta = formatDate(photo.takenAt)
    body = photo.caption ?? null
    imageUrl = photo.image ? urlFor(photo.image).width(800).height(800).fit('max').url() : null
  }

  if (selected.kind === 'track') {
    const track = data.tracks.find((item) => item._id === selected.id)
    if (!track) return null
    title = track.title
    const when = formatDate(track.startedAt)
    meta = when ? `${activityLabel(track.activity)} · ${when}` : activityLabel(track.activity)
  }

  if (selected.kind === 'pin') {
    const pin = data.pins.find((item) => item._id === selected.id)
    if (!pin) return null
    title = pin.title
    kind = pin.kind
    const when = formatDate(pin.at)
    meta = when ? `${kindLabel(pin.kind)} · ${when}` : kindLabel(pin.kind)
    body = pin.note ?? null
    imageUrl = pin.photo ? urlFor(pin.photo).width(800).height(800).fit('max').url() : null
  }

  return (
    <aside className="absolute inset-x-3 bottom-3 z-20 max-h-[70vh] overflow-auto rounded-lg bg-white p-4 shadow-lg ring-1 ring-black/10 md:inset-x-auto md:top-20 md:right-5 md:bottom-auto md:w-[320px]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {kind ? <PinShape kind={kind} className="h-4 w-4 text-black" /> : null}
          <h2 className="text-[17px] leading-tight">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[13px] text-black/50 hover:text-black"
        >
          Close
        </button>
      </div>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="mb-3 max-h-64 w-full rounded object-cover" />
      ) : null}
      {meta ? <p className="text-[13px] text-black/55">{meta}</p> : null}
      {body ? <p className="mt-2 text-[14px] leading-snug text-black/80">{body}</p> : null}
    </aside>
  )
}
