import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { PwaRegister } from '@/components/pwa-register'

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], weight: ['400', '500', '600', '700'] })
const jetbrainsMono = JetBrains_Mono({ variable: '--font-jetbrains-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Argos One — Mechanic Diagnostic Assistant',
  description: 'Speed up diagnostics with repair intelligence built from your shop\'s history.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black', title: 'Argos One' },
  icons: {
    icon: [{ url: '/icons/argos-one-app-icon.svg', type: 'image/svg+xml' }, { url: '/icons/argos-one-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/icons/argos-one-192.png',
  },
}

// maximumScale 1 stops iOS Safari zooming the page when a field is focused:
// fields use 15px copy, and Safari auto-zooms anything under 16px and leaves
// the page wider than the screen. iOS still allows pinch-zoom regardless;
// Android honours it and blocks pinch-zoom too.
export const viewport: Viewport = { themeColor: '#090909', width: 'device-width', initialScale: 1, maximumScale: 1, viewportFit: 'cover' }

const themeScript = `try{var t=localStorage.getItem('argos-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the theme script sets data-theme on <html>
    // before React hydrates, which React would otherwise flag as a mismatch.
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        {/* Applies the theme saved by the app's Appearance setting before the
            page is interactive, so signed-out pages (and the dashboard's first
            frame) don't flash dark for someone who chose light. app.js keeps
            using the same "argos-theme" key once it loads. */}
        <Script id="argos-theme" strategy="beforeInteractive">{themeScript}</Script>
        <PwaRegister />
        {children}
      </body>
    </html>
  )
}
