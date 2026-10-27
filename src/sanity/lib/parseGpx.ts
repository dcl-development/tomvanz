export type LineString = {
  type: 'LineString'
  coordinates: [number, number][]
}

export function parseGpxToLine(gpxText: string): LineString {
  const doc = new DOMParser().parseFromString(gpxText, 'text/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('Couldn’t read that GPX.')
  }

  const coordinates: [number, number][] = []

  const trackPoints = Array.from(doc.getElementsByTagName('trkpt'))
  const routePoints = Array.from(doc.getElementsByTagName('rtept'))
  const points = trackPoints.length > 0 ? trackPoints : routePoints

  for (const point of points) {
    const lat = Number(point.getAttribute('lat'))
    const lon = Number(point.getAttribute('lon'))
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      coordinates.push([lon, lat])
    }
  }

  if (coordinates.length < 2) {
    throw new Error('That GPX has no track line.')
  }

  return {type: 'LineString', coordinates}
}
