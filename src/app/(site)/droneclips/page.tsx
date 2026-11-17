import type {Metadata} from 'next'

import {DroneClipsPageClient} from '@/components/DroneClipsPageClient'

export const metadata: Metadata = {
  title: 'Video Compressor (Drone) · Tom Vanz',
  description: 'Shrink drone videos on your device for texting and sharing.',
}

export default function DroneClipsPage() {
  return <DroneClipsPageClient />
}
