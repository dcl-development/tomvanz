'use client'

import Image from 'next/image'
import Link from 'next/link'
import {usePathname} from 'next/navigation'

const links = [{href: '/', label: 'Map'}]

type Props = {
  name: string
}

export function SiteHeader({name}: Props) {
  const pathname = usePathname()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 bg-black px-3 md:h-16 md:px-5">
      <Link href="/" className="flex min-w-0 items-center">
        <Image
          src="/tom-vanz-logo.png"
          alt={name}
          width={1200}
          height={400}
          priority
          className="h-8 w-auto md:h-10"
        />
      </Link>
      <nav aria-label="Site" className="flex shrink-0 items-center text-[13px]">
        {links.map((link) => {
          const current = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={current ? 'page' : undefined}
              className={`px-2.5 py-2 md:px-3 ${current ? 'text-white' : 'text-white/40 hover:text-white/75'}`}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
