'use client'

import dynamic from 'next/dynamic'

const DroneClipsApp = dynamic(
  () => import('@/components/DroneClipsApp').then((mod) => ({default: mod.DroneClipsApp})),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#e8e8e8] text-[14px] text-black/50">
        Loading clip tool
      </div>
    ),
  },
)

export function DroneClipsPageClient() {
  return <DroneClipsApp />
}
