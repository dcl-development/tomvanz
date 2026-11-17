'use client'

import {useEffect, useRef, useState} from 'react'
import {createRoot, type Root} from 'react-dom/client'
import {LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, Popup} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@/lib/maplibre-worker'
import {InfoCard} from './InfoCard'
import {urlFor} from '@/lib/sanity/image'
import {trackColor} from '@/lib/track-color'
import type {LayerFilters} from './MapLayers'
import {lineCoordinates, type MapData, type PinDoc, PinKind, SelectedItem} from '@/lib/sanity/types'
import type {StyleSpecification} from 'maplibre-gl'

const ESRI_ATTRIBUTION =
  'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'esri-world-imagery': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: ESRI_ATTRIBUTION,
    },
  },
  layers: [
    {
      id: 'esri-world-imagery',
      type: 'raster',
      source: 'esri-world-imagery',
    },
  ],
}

type Props = {
  data: MapData
  filters: LayerFilters
  threeD: boolean
  selected: SelectedItem | null
  /** A pin to outline on the map without selecting it (the card being viewed in the pile strip). */
  highlightId: string | null
  onSelect: (item: SelectedItem | null) => void
  /** Called with the ids of a pile of photos that zooming can't pull apart. */
  onPile: (ids: string[]) => void
  onMapError: () => void
}

function pinSvg(kind: PinKind) {
  const halo = 'stroke="white" stroke-width="2"'
  if (kind === 'trip') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.2" fill="#111" ${halo}/></svg>`
  }
  if (kind === 'mountain') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 16 16"><path d="M8 2.5 L14 13.5 H2 Z" fill="#111" ${halo}/></svg>`
  }
  if (kind === 'park') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.2" fill="none" stroke="#111" stroke-width="2.4"/><circle cx="8" cy="8" r="6.4" fill="none" stroke="white" stroke-width="1.5"/></svg>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 16 16"><rect x="3.5" y="3.5" width="9" height="9" fill="#111" ${halo}/></svg>`
}

function selectionPoint(data: MapData, selected: SelectedItem): [number, number] | null {
  if (selected.kind === 'pin') {
    const pin = data.pins.find((item) => item._id === selected.id)
    return pin ? [pin.location.lng, pin.location.lat] : null
  }
  if (selected.lng != null && selected.lat != null) {
    return [selected.lng, selected.lat]
  }
  const track = data.tracks.find((item) => item._id === selected.id)
  if (!track) return null
  return lineCoordinates(track.route)[0] ?? null
}

const MARKER_PX = 30

const DEM_SOURCE_ID = 'terrain-dem'
const TILT_PITCH = 62
const TERRAIN_EXAGGERATION = 1.4

/** Turn 3D terrain on or off. The elevation source is only added the first time it's needed. */
function applyThreeD(map: MapLibreMap, on: boolean) {
  if (on) {
    if (!map.getSource(DEM_SOURCE_ID)) {
      map.addSource(DEM_SOURCE_ID, {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 15,
        attribution: 'Terrain: Mapzen, Tilezen, USGS, NASA SRTM and others',
      })
    }
    map.setMaxPitch(80)
    map.setTerrain({source: DEM_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION})
    map.setSky({
      'sky-color': '#8fb8e8',
      'horizon-color': '#dbe9f6',
      'fog-color': '#e8eef4',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.7,
      'fog-ground-blend': 0.2,
    })
    map.easeTo({pitch: TILT_PITCH, duration: 900})
  } else {
    map.easeTo({pitch: 0, bearing: 0, duration: 700})
    map.once('moveend', () => {
      map.setTerrain(null)
      map.setMaxPitch(60)
    })
  }
}

/**
 * Pins whose thumbnails overlap the one that was tapped (including that pin). Only direct
 * neighbours count, so a long chain of overlapping photos doesn't turn into one giant pile.
 */
function overlappingPins(map: MapLibreMap, pins: PinDoc[], origin: PinDoc): PinDoc[] {
  const here = map.project([origin.location.lng, origin.location.lat])
  return pins.filter((pin) => {
    if (pin._id === origin._id) return true
    const pt = map.project([pin.location.lng, pin.location.lat])
    return Math.abs(pt.x - here.x) < MARKER_PX && Math.abs(pt.y - here.y) < MARKER_PX
  })
}

/**
 * Gently zoom in so a pile of overlapping pins spreads out, leaving room for the card strip.
 * Does nothing when zooming wouldn't help (same spot, or already zoomed in).
 */
function zoomIntoPile(map: MapLibreMap, group: PinDoc[]) {
  const bounds = new LngLatBounds()
  for (const pin of group) bounds.extend([pin.location.lng, pin.location.lat])
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  if (Math.abs(ne.lng - sw.lng) < 1e-5 && Math.abs(ne.lat - sw.lat) < 1e-5) return
  const camera = map.cameraForBounds(bounds, {
    padding: {top: 96, bottom: 210, left: 96, right: 96},
    maxZoom: 18,
  })
  if (!camera || camera.zoom == null || camera.zoom <= map.getZoom() + 0.3) return
  map.easeTo({center: camera.center, zoom: camera.zoom, duration: 650})
}

/** Bring a selected pin or track into view. Tapped tracks stay put; ones picked from a list or link fly to it. */
function focusSelection(
  map: MapLibreMap,
  data: MapData,
  selected: SelectedItem,
  popupMode: boolean,
  duration: number,
) {
  if (selected.kind === 'track') {
    if (!selected.fly) return
    const track = data.tracks.find((item) => item._id === selected.id)
    if (!track) return
    const bounds = new LngLatBounds()
    for (const [lng, lat] of lineCoordinates(track.route)) bounds.extend([lng, lat])
    if (bounds.isEmpty()) return
    map.fitBounds(bounds, {
      // The card opens above the route's start, so leave it room (it's taller for routes with an elevation chart).
      padding: popupMode
        ? {top: Math.min(500, Math.round(map.getContainer().clientHeight * 0.7)), bottom: 60, left: 70, right: 70}
        : {top: 90, bottom: 360, left: 40, right: 40},
      maxZoom: 15,
      duration,
    })
    return
  }
  const point = selectionPoint(data, selected)
  if (!point) return
  map.easeTo({
    center: point,
    offset: [0, popupMode ? 110 : -40],
    zoom: Math.max(map.getZoom(), 11),
    duration,
  })
}

function hitLayerIds(map: MapLibreMap): string[] {
  return (map.getStyle()?.layers ?? [])
    .map((layer) => layer.id)
    .filter((id) => id.startsWith('track-hit-'))
}

export function MapCanvas({data, filters, threeD, selected, highlightId, onSelect, onPile, onMapError}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Map<string, Marker>>(new Map())
  const onSelectRef = useRef(onSelect)
  const onPileRef = useRef(onPile)
  const activeIdRef = useRef<string | null>(null)
  /** True once the map's style has loaded; unlike map.loaded() it stays true while tiles download. */
  const readyRef = useRef(false)
  const selectedRef = useRef(selected)
  const popupModeRef = useRef(true)
  const onMapErrorRef = useRef(onMapError)
  const dataRef = useRef(data)
  const filtersRef = useRef(filters)
  const threeDRef = useRef(threeD)
  const [popupMode, setPopupMode] = useState(() => window.matchMedia('(min-width: 768px)').matches)

  useEffect(() => {
    selectedRef.current = selected
    onSelectRef.current = onSelect
    onPileRef.current = onPile
    onMapErrorRef.current = onMapError
    dataRef.current = data
    filtersRef.current = filters
    threeDRef.current = threeD
  }, [selected, onSelect, onPile, onMapError, data, filters, threeD])

  const pinCtx = (): PinRenderCtx => ({
    data: dataRef.current,
    filters: filtersRef.current,
    onSelect: onSelectRef.current,
    onPile: onPileRef.current,
    getActiveId: () => activeIdRef.current,
  })

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const update = () => {
      popupModeRef.current = mq.matches
      setPopupMode(mq.matches)
    }
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const node = rootRef.current
    if (!node) return

    let map: MapLibreMap
    try {
      map = new MapLibreMap({
        container: node,
        style: STYLE,
        center: [0, 20],
        zoom: 1.4,
        attributionControl: {compact: true},
      })
    } catch {
      onMapErrorRef.current()
      return
    }

    mapRef.current = map
    map.addControl(new NavigationControl({showCompass: false}), 'bottom-right')
    map.on('error', (event) => {
      // A missing elevation tile just leaves the terrain flat; it shouldn't take down the map.
      if ((event as {sourceId?: string}).sourceId === DEM_SOURCE_ID) return
      onMapErrorRef.current()
    })
    map.on('click', (event) => {
      const layers = hitLayerIds(map)
      if (layers.length) {
        const hit = map.queryRenderedFeatures(event.point, {layers})[0]
        const id = hit?.properties?.id
        if (typeof id === 'string' && id) {
          onSelectRef.current({
            kind: 'track',
            id,
            lng: event.lngLat.lng,
            lat: event.lngLat.lat,
          })
          return
        }
      }
      onSelectRef.current(null)
    })
    map.on('mousemove', (event) => {
      const layers = hitLayerIds(map)
      if (!layers.length) {
        map.getCanvas().style.cursor = ''
        return
      }
      const hovering = map.queryRenderedFeatures(event.point, {layers}).length > 0
      map.getCanvas().style.cursor = hovering ? 'pointer' : ''
    })
    map.on('load', () => {
      readyRef.current = true
      syncMap(map, dataRef.current, filtersRef.current, pinCtx(), markersRef)
      if (selectedRef.current) {
        focusSelection(map, dataRef.current, selectedRef.current, popupModeRef.current, 0)
      }
      if (threeDRef.current) applyThreeD(map, true)
      // Start with the credits collapsed to a small (i) button; they still open on tap.
      const attrib = node.querySelector('.maplibregl-ctrl-attrib')
      attrib?.classList.remove('maplibregl-compact-show')
      attrib?.removeAttribute('open')
    })
    map.on('moveend', () => renderPins(map, pinCtx(), markersRef, false))

    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = new Map()
      readyRef.current = false
      map.remove()
      mapRef.current = null
    }
  }, [])

  const firstThreeD = useRef(true)
  useEffect(() => {
    if (firstThreeD.current) {
      firstThreeD.current = false
      return
    }
    const map = mapRef.current
    if (!map || !readyRef.current) return
    applyThreeD(map, threeD)
  }, [threeD])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    syncMap(map, data, filters, pinCtx(), markersRef)
  }, [data, filters])

  useEffect(() => {
    activeIdRef.current = selected?.kind === 'pin' ? selected.id : highlightId
    markersRef.current.forEach((marker) => {
      const el = marker.getElement()
      el.dataset.active = el.dataset.id === activeIdRef.current ? 'true' : 'false'
    })
  }, [selected, highlightId, data, filters])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const style = map.getStyle()
    for (const layer of style?.layers ?? []) {
      if (!layer.id.startsWith('track-line-')) continue
      const id = layer.id.slice('track-line-'.length)
      const on = selected?.kind === 'track' && selected.id === id
      map.setPaintProperty(layer.id, 'line-width', on ? 4.5 : 2.5)
    }
  }, [selected, data, filters])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current || !selected) return
    focusSelection(map, data, selected, popupMode, 500)
  }, [selected, popupMode, data])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !popupMode || !selected) return
    const lngLat = selectionPoint(data, selected)
    if (!lngLat) return

    const node = document.createElement('div')
    const root: Root = createRoot(node)
    root.render(
      <InfoCard
        data={data}
        selected={selected}
        onClose={() => onSelectRef.current(null)}
        placement="popup"
      />,
    )

    const popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      maxWidth: '320px',
      className: 'tv-popup',
      anchor: 'bottom',
      focusAfterOpen: false,
    })
      .setLngLat(lngLat)
      .setDOMContent(node)
      .addTo(map)

    return () => {
      popup.remove()
      queueMicrotask(() => root.unmount())
    }
  }, [selected, data, popupMode])

  return <div ref={rootRef} className="isolate h-full w-full" />
}

function clearTrackLayers(map: MapLibreMap) {
  const style = map.getStyle()
  if (!style?.layers) return
  for (const layer of [...style.layers]) {
    if (
      layer.id.startsWith('track-line-') ||
      layer.id.startsWith('track-casing-') ||
      layer.id.startsWith('track-hit-')
    ) {
      if (map.getLayer(layer.id)) map.removeLayer(layer.id)
    }
  }
  const sources = style.sources ? Object.keys(style.sources) : []
  for (const id of sources) {
    if (id.startsWith('track-src-')) {
      if (map.getSource(id)) map.removeSource(id)
    }
  }
}

function syncMap(
  map: MapLibreMap,
  data: MapData,
  filters: LayerFilters,
  ctx: PinRenderCtx,
  markersRef: {current: Map<string, Marker>},
) {
  clearTrackLayers(map)

  const bounds = new LngLatBounds()
  let hasPoint = false

  if (filters.tracks) {
    for (const track of data.tracks) {
      const coords = lineCoordinates(track.route)
      if (coords.length < 2) continue
      const color = trackColor(track.activity)
      const sourceId = `track-src-${track._id}`
      const layerId = `track-line-${track._id}`
      const hitId = `track-hit-${track._id}`
      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {id: track._id},
          geometry: {type: 'LineString', coordinates: coords},
        },
      })
      const casingId = `track-casing-${track._id}`
      map.addLayer({
        id: casingId,
        type: 'line',
        source: sourceId,
        layout: {'line-join': 'round', 'line-cap': 'round'},
        paint: {
          'line-color': '#ffffff',
          'line-width': 6,
          'line-opacity': 0.88,
        },
      })
      map.addLayer({
        id: hitId,
        type: 'line',
        source: sourceId,
        layout: {'line-join': 'round', 'line-cap': 'round'},
        paint: {
          'line-color': color,
          'line-width': 18,
          'line-opacity': 0,
        },
      })
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {'line-join': 'round', 'line-cap': 'round'},
        paint: {
          'line-color': color,
          'line-width': 2.5,
          'line-dasharray': track.activity === 'hike' ? [2, 1.4] : [1, 0],
        },
      })
      for (const [lng, lat] of coords) {
        bounds.extend([lng, lat])
        hasPoint = true
      }
    }
  }

  if (filters.pins) {
    for (const pin of data.pins) {
      bounds.extend([pin.location.lng, pin.location.lat])
      hasPoint = true
    }
  }

  if (hasPoint) {
    map.fitBounds(bounds, {padding: 72, maxZoom: 12, duration: 0})
  } else {
    map.jumpTo({center: [0, 20], zoom: 1.4})
  }
  renderPins(map, ctx, markersRef, true)
}

type PinRenderCtx = {
  data: MapData
  filters: LayerFilters
  onSelect: (item: SelectedItem | null) => void
  onPile: (ids: string[]) => void
  getActiveId: () => string | null
}

/**
 * Draws a thumbnail marker for every pin in (or near) the current view, and drops the rest.
 * Keeps the page light however many photos there are; the look and stacking are unchanged.
 */
function renderPins(
  map: MapLibreMap,
  ctx: PinRenderCtx,
  markersRef: {current: Map<string, Marker>},
  force: boolean,
) {
  if (force) {
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = new Map()
  }
  if (!ctx.filters.pins) {
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = new Map()
    return
  }

  const view = map.getBounds()
  const padLng = (view.getEast() - view.getWest()) * 0.25
  const padLat = (view.getNorth() - view.getSouth()) * 0.25
  const west = view.getWest() - padLng
  const east = view.getEast() + padLng
  const south = view.getSouth() - padLat
  const north = view.getNorth() + padLat

  const wanted = new Set<string>()
  ctx.data.pins.forEach((pin, index) => {
    const {lng, lat} = pin.location
    if (lng < west || lng > east || lat < south || lat > north) return
    wanted.add(pin._id)
    if (markersRef.current.has(pin._id)) return

    const thumb = pin.photo?.asset ? urlFor(pin.photo).width(80).height(80).fit('crop').url() : ''
    const el = document.createElement('button')
    el.type = 'button'
    el.dataset.kind = 'pin'
    el.dataset.id = pin._id
    el.dataset.active = ctx.getActiveId() === pin._id ? 'true' : 'false'
    el.setAttribute('aria-label', pin.title)
    // Later pins sit on top, exactly as when every marker was added in order.
    el.style.zIndex = String(index)
    // The button only positions the marker; the visible photo sits in an inner layer so the
    // active photo can scale up without MapLibre's position transform being scaled with it.
    const inner = document.createElement('span')
    inner.className = 'tv-pin'
    el.style.padding = '0'
    el.style.border = '0'
    el.style.background = 'transparent'
    if (thumb) {
      el.style.width = '28px'
      el.style.height = '28px'
      inner.style.width = '100%'
      inner.style.height = '100%'
      inner.style.boxSizing = 'border-box'
      inner.style.border = '1px solid white'
      inner.style.borderRadius = '2px'
      inner.style.boxShadow = '0 1px 4px rgba(0,0,0,0.28)'
      inner.style.backgroundImage = `url(${thumb})`
      inner.style.backgroundSize = 'cover'
      inner.style.backgroundPosition = 'center'
      inner.style.backgroundColor = '#111'
    } else {
      inner.innerHTML = pinSvg(pin.kind)
      el.style.lineHeight = '0'
    }
    el.appendChild(inner)
    el.style.cursor = 'pointer'
    el.addEventListener('click', (event) => {
      event.stopPropagation()
      const group = overlappingPins(map, ctx.data.pins, pin)
      if (group.length > 1) {
        // A pile: show its photos as swipeable cards (the tapped one first), and spread them out if we can.
        const rest = group.filter((item) => item._id !== pin._id)
        ctx.onPile([pin._id, ...rest.map((item) => item._id)])
        zoomIntoPile(map, group)
        return
      }
      ctx.onSelect({kind: 'pin', id: pin._id})
    })
    markersRef.current.set(
      pin._id,
      new Marker({element: el, anchor: 'center'}).setLngLat([lng, lat]).addTo(map),
    )
  })

  markersRef.current.forEach((marker, id) => {
    if (wanted.has(id)) return
    marker.remove()
    markersRef.current.delete(id)
  })
}
