import type {Metadata} from 'next'

import {HomePage} from '@/components/HomePage'

export const metadata: Metadata = {
  title: 'Tom Vanz',
}

export default function Home() {
  return <HomePage />
}
