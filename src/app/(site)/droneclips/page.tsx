import type {Metadata} from 'next'

import {DroneClipsPageClient} from '@/components/DroneClipsPageClient'

export const metadata: Metadata = {
  title: 'Drone Clips · Tom Vanz',
  description: 'Shrink drone videos on your device for texting and sharing.',
}

export default function DroneClipsPage() {
  return <DroneClipsPageClient />
}
