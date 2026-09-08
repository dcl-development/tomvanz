export function lineMiles(coords: [number, number][]): number | null {
  if (coords.length < 2) return null
  let miles = 0
  for (let i = 1; i < coords.length; i += 1) {
    miles += haversineMiles(coords[i - 1]!, coords[i]!)
  }
  if (miles < 0.05) return null
  return miles
}

export function formatMiles(miles: number): string {
  if (miles < 10) return `${miles.toFixed(1)} mi`
  return `${Math.round(miles)} mi`
}

function haversineMiles(a: [number, number], b: [number, number]): number {
  const earthMiles = 3958.8
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * earthMiles * Math.asin(Math.min(1, Math.sqrt(h)))
}
