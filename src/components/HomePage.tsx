import Link from 'next/link'

const choices = [
  {
    href: '/map',
    title: 'Map',
    description: 'Trips, routes, and places.',
  },
  {
    href: '/droneclips',
    title: 'Drone Clips',
    description: 'Make videos smaller before you send them.',
  },
]

export function HomePage() {
  return (
    <div className="flex h-full flex-col bg-[#e8e8e8]">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <ul className="flex w-full max-w-md flex-col gap-4">
          {choices.map((choice) => (
            <li key={choice.href}>
              <Link
                href={choice.href}
                className="flex min-h-[88px] flex-col justify-center rounded-2xl border-2 border-black/10 bg-white px-6 py-5 shadow-sm transition-[border-color,transform] hover:border-black/25 active:scale-[0.99]"
              >
                <span className="text-[22px] font-bold tracking-tight text-black">{choice.title}</span>
                <span className="mt-1 text-[15px] leading-snug text-black/55">{choice.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
