import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Argos One',
    short_name: 'Argos One',
    description: 'Workshop inspection, diagnosis and repair knowledge for mechanics.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#111111',
    theme_color: '#090909',
    categories: ['business', 'productivity', 'utilities'],
    icons: [
      { src: '/icons/argos-one-app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/argos-one-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/argos-one-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/argos-one-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
