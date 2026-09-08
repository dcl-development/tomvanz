import type {Metadata} from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tom Vanz',
}

export default function RootLayout({children}: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
