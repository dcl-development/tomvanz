'use client'

import {useEffect, useRef} from 'react'
import {LngLatBounds, Map as MapLibreMap, Marker, NavigationControl} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@/lib/maplibre-worker'
import {urlFor} from '@/lib/sanity/image'
import {trackColor} from '@/lib/track-color'
import type {LayerFilters} from './HeaderBar'
import type {MapData, PinKind, SelectedItem} from '@/lib/sanity/types'

const STYLE = 'https://tiles.openfreemap.org/styles/positron'

type Props = {
  data: MapData
  filters: LayerFilters
  selected: SelectedItem | null
  onSelect: (item: SelectedItem) => void
  onMapError: () => void
}

function pinSvg(kind: PinKind) {
  const halo = 'stroke="white" stroke-width="2"'
  if (kind === 'catch') {
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

export function MapCanvas({data, filters, selected, onSelect, onMapError}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const onSelectRef = useRef(onSelect)
  const onMapErrorRef = useRef(onMapError)
  const dataRef = useRef(data)
  const filtersRef = useRef(filters)

  useEffect(() => {
    onSelectRef.current = onSelect
    onMapErrorRef.current = onMapError
    dataRef.current = data
    filtersRef.current = filters
  }, [onSelect, onMapError, data, filters])

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
    map.on('error', () => onMapErrorRef.current())
    map.on('load', () => {
      syncMap(map, dataRef.current, filtersRef.current, onSelectRef.current, markersRef)
    })

    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.loaded()) return
    syncMap(map, data, filters, onSelect, markersRef)
  }, [data, filters, onSelect])

  useEffect(() => {
    markersRef.current.forEach((marker) => {
      const id = marker.getElement().dataset.id
      const kind = marker.getElement().dataset.kind
      const isOn =
        selected && id === selected.id && kind === selected.kind
      marker.getElement().style.transform = isOn
        ? `${marker.getElement().style.transform}`
        : marker.getElement().style.transform
      marker.getElement().dataset.active = isOn ? 'true' : 'false'
    })
  }, [selected])

  return <div ref={rootRef} className="h-full w-full" />
}

function clearTrackLayers(map: MapLibreMap) {
  const style = map.getStyle()
  if (!style?.layers) return
  for (const layer of [...style.layers]) {
    if (layer.id.startsWith('track-line-')) {
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
  onSelect: (item: SelectedItem) => void,
  markersRef: {current: Marker[]},
) {
  markersRef.current.forEach((marker) => marker.remove())
  markersRef.current = []
  clearTrackLayers(map)

  const bounds = new LngLatBounds()
  let hasPoint = false

  if (filters.tracks) {
    for (const track of data.tracks) {
      const coords = track.route?.coordinates
      if (!coords || coords.length < 2) continue
      const color = trackColor(track._id)
      const sourceId = `track-src-${track._id}`
      const layerId = `track-line-${track._id}`
      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {type: 'LineString', coordinates: coords},
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

      const start = coords[0]
      const el = document.createElement('button')
      el.type = 'button'
      el.dataset.kind = 'track'
      el.dataset.id = track._id
      el.setAttribute('aria-label', track.title)
      el.style.width = '16px'
      el.style.height = '16px'
      el.style.borderRadius = '999px'
      el.style.background = color
      el.style.border = '2px solid white'
      el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.25)'
      el.style.cursor = 'pointer'
      el.style.padding = '0'
      el.addEventListener('click', (event) => {
        event.stopPropagation()
        onSelect({kind: 'track', id: track._id})
      })
      const marker = new Marker({element: el, anchor: 'center'})
        .setLngLat(start)
        .addTo(map)
      markersRef.current.push(marker)
    }
  }

  if (filters.pins) {
    for (const pin of data.pins) {
      const el = document.createElement('button')
      el.type = 'button'
      el.dataset.kind = 'pin'
      el.dataset.id = pin._id
      el.setAttribute('aria-label', pin.title)
      el.innerHTML = pinSvg(pin.kind)
      el.style.background = 'transparent'
      el.style.border = '0'
      el.style.padding = '0'
      el.style.cursor = 'pointer'
      el.style.lineHeight = '0'
      el.addEventListener('click', (event) => {
        event.stopPropagation()
        onSelect({kind: 'pin', id: pin._id})
      })
      const marker = new Marker({element: el, anchor: 'center'})
        .setLngLat([pin.location.lng, pin.location.lat])
        .addTo(map)
      markersRef.current.push(marker)
      bounds.extend([pin.location.lng, pin.location.lat])
      hasPoint = true
    }
  }

  if (filters.photos) {
    for (const photo of data.photos) {
      const thumb = photo.image
        ? urlFor(photo.image).width(80).height(80).fit('crop').url()
        : ''
      const el = document.createElement('button')
      el.type = 'button'
      el.dataset.kind = 'photo'
      el.dataset.id = photo._id
      el.setAttribute('aria-label', photo.fish)
      el.style.width = '28px'
      el.style.height = '28px'
      el.style.padding = '0'
      el.style.border = '1px solid white'
      el.style.borderRadius = '2px'
      el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.28)'
      el.style.backgroundImage = thumb ? `url(${thumb})` : 'none'
      el.style.backgroundSize = 'cover'
      el.style.backgroundPosition = 'center'
      el.style.backgroundColor = '#111'
      el.style.cursor = 'pointer'
      el.addEventListener('click', (event) => {
        event.stopPropagation()
        onSelect({kind: 'photo', id: photo._id})
      })
      const marker = new Marker({element: el, anchor: 'center'})
        .setLngLat([photo.location.lng, photo.location.lat])
        .addTo(map)
      markersRef.current.push(marker)
      bounds.extend([photo.location.lng, photo.location.lat])
      hasPoint = true
    }
  }

  if (hasPoint) {
    map.fitBounds(bounds, {padding: 72, maxZoom: 12, duration: 0})
  } else {
    map.jumpTo({center: [0, 20], zoom: 1.4})
  }
}
