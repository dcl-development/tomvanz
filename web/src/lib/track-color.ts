/** Stable color per track id. Hue from the id, sat/lightness locked for gray Positron. */
export function trackColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 62% 38%)`
}
