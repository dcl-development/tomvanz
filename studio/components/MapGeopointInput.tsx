import {useCallback, useEffect, useRef} from 'react'
import {Box, Stack, Text} from '@sanity/ui'
import {LngLat, Map as MapLibreMap, Marker, type MapMouseEvent} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {PatchEvent, set, type ObjectInputProps} from 'sanity'

type Geopoint = {
  _type: 'geopoint'
  lat: number
  lng: number
}

const STYLE = 'https://tiles.openfreemap.org/styles/positron'

export function MapGeopointInput(props: ObjectInputProps) {
  const {value, onChange, readOnly} = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const geopoint = value as Geopoint | undefined
  const lat = geopoint?.lat
  const lng = geopoint?.lng

  const placeMarker = useCallback((map: MapLibreMap, nextLat: number, nextLng: number) => {
    if (markerRef.current) {
      markerRef.current.setLngLat([nextLng, nextLat])
      return
    }
    markerRef.current = new Marker({color: '#111'}).setLngLat([nextLng, nextLat]).addTo(map)
  }, [])

  useEffect(() => {
    const node = containerRef.current
    if (!node || mapRef.current) return

    const map = new MapLibreMap({
      container: node,
      style: STYLE,
      center: lng != null && lat != null ? [lng, lat] : [0, 20],
      zoom: lng != null && lat != null ? 11 : 1.4,
      attributionControl: {compact: true},
    })
    mapRef.current = map

    map.on('load', () => {
      if (lng != null && lat != null) placeMarker(map, lat, lng)
    })

    map.on('click', (event: MapMouseEvent) => {
      if (readOnly) return
      const next = {
        _type: 'geopoint' as const,
        lat: event.lngLat.lat,
        lng: event.lngLat.lng,
      }
      onChangeRef.current(PatchEvent.from(set(next)))
    })

    return () => {
      markerRef.current?.remove()
      markerRef.current = null
      map.remove()
      mapRef.current = null
    }
    // Map is created once; later lat/lng updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, placeMarker])

  useEffect(() => {
    const map = mapRef.current
    if (!map || lat == null || lng == null) return
    placeMarker(map, lat, lng)
    map.easeTo({center: new LngLat(lng, lat), zoom: Math.max(map.getZoom(), 10)})
  }, [lat, lng, placeMarker])

  return (
    <Stack gap={3}>
      <Text size={1} muted>
        Click the map to drop a pin.
      </Text>
      <Box
        ref={containerRef}
        style={{
          height: 280,
          width: '100%',
          borderRadius: 4,
          overflow: 'hidden',
          border: '1px solid var(--card-border-color)',
        }}
      />
      {lat != null && lng != null ? (
        <Text size={1} muted>
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </Text>
      ) : null}
    </Stack>
  )
}
