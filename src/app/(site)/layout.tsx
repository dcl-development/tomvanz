import {loadSiteName} from '@/lib/sanity/load'
import {SiteHeader} from '@/components/SiteHeader'

export default async function SiteLayout({children}: {children: React.ReactNode}) {
  const name = await loadSiteName()

  return (
    <div className="flex h-dvh flex-col bg-black">
      <SiteHeader name={name} />
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  )
}
