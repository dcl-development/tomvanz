// Repo: https://github.com/dcl-development/tomvanz

import type {NextConfig} from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
      },
    ],
  },
  transpilePackages: ['sanity', 'next-sanity', 'mediabunny', '@mediabunny/aac-encoder'],
  async redirects() {
    return [
      { source: '/admin', destination: '/studio', permanent: false },
      { source: '/admin/:path*', destination: '/studio/:path*', permanent: false },
    ]
  },
}

export default nextConfig
