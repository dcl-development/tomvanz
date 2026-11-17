/** Zoom level from which photos are tapped one at a time rather than as piles. */
export const PILE_MAX_ZOOM = 14

/** How close (in screen pixels) two photos must be for a tap to treat them as one pile. */
const LOOSE_PX = 20
const STACKED_PX = 8

/**
 * Zoomed out, photos whose thumbnails substantially overlap count as a pile. Zoomed in
 * past PILE_MAX_ZOOM, only photos stacked practically on the same spot do; everything
 * else is selected directly so you never have to keep tapping your way down.
 */
export function pileTolerancePx(zoom: number): number {
  return zoom >= PILE_MAX_ZOOM ? STACKED_PX : LOOSE_PX
}

/** The most the map will zoom in to spread a pile out. */
export const PILE_FIT_MAX_ZOOM = 15
