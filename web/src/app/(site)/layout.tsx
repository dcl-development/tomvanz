import {client} from '@/lib/sanity/client'
import {SiteHeader} from '@/components/SiteHeader'

export const dynamic = 'force-dynamic'

export default async function SiteLayout({children}: LayoutProps<'/'>) {
  const name =
    (await client.fetch<string | null>('coalesce(*[_type == "siteSettings"][0].name, "Tom Vanz")')) ??
    'Tom Vanz'

  return (
    <div className="flex h-dvh flex-col bg-black">
      <SiteHeader name={name} />
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  )
}
