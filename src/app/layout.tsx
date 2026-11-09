import type {Metadata} from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.tomvanz.com'),
  title: 'Tom Vanz',
  description: 'Tom Vanz: a map of trips, routes, and places, plus Drone Clips for making videos smaller before you send them.',
}

export default function RootLayout({children}: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
