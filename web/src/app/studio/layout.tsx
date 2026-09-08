export {metadata, viewport} from 'next-sanity/studio'

export default function StudioLayout({children}: {children: React.ReactNode}) {
  return <div className="h-dvh min-h-dvh bg-white">{children}</div>
}
