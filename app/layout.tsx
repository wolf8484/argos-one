import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { PwaRegister } from '@/components/pwa-register'

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], weight: ['400', '500', '600', '700'] })
const jetbrainsMono = JetBrains_Mono({ variable: '--font-jetbrains-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Argos One — Mechanic Diagnostic Assistant',
  description: 'Speed up diagnostics with repair intelligence built from your shop\'s history.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Argos One' },
  icons: {
    icon: [{ url: '/icons/argos-one-app-icon.svg', type: 'image/svg+xml' }, { url: '/icons/argos-one-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/icons/argos-one-192.png',
  },
}

export const viewport: Viewport = { themeColor: '#090909', width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <PwaRegister />
        {children}
      </body>
    </html>
  )
}
