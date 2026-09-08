/** Distinct map colors. Assigned uniquely across tracks so two lines cannot share a hue. */
const PALETTE = [
  '#c45c26',
  '#1874a5',
  '#2d6a4f',
  '#c1121f',
  '#5c4d7a',
  '#b8860b',
  '#0e7c7b',
  '#3d5a80',
  '#6a994e',
  '#9c6644',
]

export function trackColors(ids: string[]): Map<string, string> {
  const unique = [...new Set(ids)].sort()
  const colors = new Map<string, string>()
  unique.forEach((id, index) => {
    colors.set(id, PALETTE[index % PALETTE.length]!)
  })
  return colors
}

export function trackColor(id: string, among: string[] = [id]): string {
  return trackColors(among).get(id) ?? PALETTE[0]!
}
