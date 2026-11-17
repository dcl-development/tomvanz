'use client'

import {useEffect, useRef, useState} from 'react'
import {CloseIcon} from './CloseIcon'
import {urlFor} from '@/lib/sanity/image'
import type {PinDoc} from '@/lib/sanity/types'

type Props = {
  pins: PinDoc[]
  onIndexChange: (index: number) => void
  onOpen: (id: string) => void
  onClose: () => void
}

function formatDate(value?: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'})
}

/**
 * A swipeable row of small floating cards for photos that sit on top of each other.
 * Tapping a card opens it as the normal full card.
 */
export function PileStrip({pins, onIndexChange, onOpen, onClose}: Props) {
  const scroller = useRef<HTMLDivElement | null>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    onIndexChange(0)
  }, [onIndexChange, pins])

  const onScroll = () => {
    const node = scroller.current
    if (!node) return
    const first = node.firstElementChild as HTMLElement | null
    if (!first) return
    const step = first.offsetWidth + 12
    const next = Math.min(pins.length - 1, Math.max(0, Math.round(node.scrollLeft / step)))
    if (next !== index) {
      setIndex(next)
      onIndexChange(next)
    }
  }

  return (
    <div className="tv-strip pointer-events-none absolute inset-x-0 bottom-[calc(16px+env(safe-area-inset-bottom))] z-20 md:bottom-6 md:left-1/2 md:right-auto md:w-[640px] md:-translate-x-1/2">
      <div className="mb-2 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/80 py-1 pl-3.5 pr-1 text-[12px] font-semibold text-white shadow-lg backdrop-blur-md">
          <span>
            {index + 1} of {pins.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-6 w-6 items-center justify-center rounded-full text-white/80 hover:bg-white/15"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="pointer-events-auto flex snap-x snap-mandatory gap-3 overflow-x-auto px-[calc(50%-110px)] pb-2 [mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pins.map((pin, i) => {
          const date = formatDate(pin.at)
          const title = pin.title?.trim() ?? ''
          const caption = title || date
          return (
            <button
              key={pin._id}
              type="button"
              onClick={() => onOpen(pin._id)}
              aria-label={`Open ${title || date || 'photo'}`}
              className={`relative h-[150px] w-[220px] shrink-0 snap-center overflow-hidden rounded-2xl bg-neutral-800 text-left shadow-[0_10px_30px_rgba(0,0,0,0.35)] ring-1 ring-white/20 transition-transform duration-200 active:scale-[0.98] ${
                i === index ? 'scale-100' : 'scale-[0.93] opacity-90'
              }`}
            >
              {pin.photo?.asset ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urlFor(pin.photo).width(480).height(330).fit('crop').url()}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
              {caption ? (
                <>
                  <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                    <p className="truncate text-[15px] font-bold leading-tight tracking-tight [text-shadow:0_1px_8px_rgba(0,0,0,0.4)]">
                      {caption}
                    </p>
                    {title && date ? <p className="mt-0.5 text-[11px] text-white/75">{date}</p> : null}
                  </div>
                </>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
