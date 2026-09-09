/** Line color from the track's activity field in Studio. */
export function trackColor(activity: 'bike' | 'hike' | 'other'): string {
  if (activity === 'hike') return '#2d6a4f'
  if (activity === 'bike') return '#1874a5'
  return '#9c6644'
}
