import type { Metadata } from 'next'
import { Manrope, Geist_Mono } from 'next/font/google'
import './globals.css'

const manrope = Manrope({ variable: '--font-manrope', subsets: ['latin'], weight: ['400', '600', '700'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Argos One — Mechanic Diagnostic Assistant',
  description: 'Speed up diagnostics with repair intelligence built from your shop\'s history.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
