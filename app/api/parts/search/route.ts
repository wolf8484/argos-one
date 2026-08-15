import { NextRequest, NextResponse } from 'next/server'

import type { PartOffer } from '@/types'
import { requireWorkshopUser } from '@/lib/server/auth'

// Live part price search via Serper.dev (Google Shopping as JSON).
// The API key is server-side only — the browser posts a query, we return
// normalized offers (image, price, merchant, link) for the results sheet.
//
// This is a price-scouting shortcut, not an order guarantee: results are
// near-matches, so the UI must keep the "confirm fitment against the VIN"
// disclaimer before a mechanic orders anything.

interface SerperShoppingItem {
  title?: string
  source?: string
  link?: string
  price?: string
  imageUrl?: string
  rating?: number
  ratingCount?: number
  delivery?: string
}

// "$74.90", "A$1,199.00", "US$82.15" -> 74.9 / 1199 / 82.15
function parsePrice(raw?: string): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[^0-9.,]/g, '').replace(/,/g, '')
  const value = Number.parseFloat(cleaned)
  return Number.isFinite(value) ? value : null
}

export async function POST(req: NextRequest) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error

  const key = process.env.SERPER_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'Part search is not configured' }, { status: 500 })
  }

  let query: unknown
  let partNumber: unknown
  try {
    const body = (await req.json()) as { query?: unknown; partNumber?: unknown }
    query = body.query
    partNumber = body.partNumber
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (typeof query !== 'string' || query.trim().length === 0) {
    return NextResponse.json({ error: 'Missing search query' }, { status: 400 })
  }

  // Include the OEM/part number when we have one — it sharpens fitment.
  const q = [query, typeof partNumber === 'string' ? partNumber : '']
    .filter(Boolean)
    .join(' ')
    .trim()

  try {
    const res = await fetch('https://google.serper.dev/shopping', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      // Australia-first: gl/hl bias results to AU merchants and pricing.
      body: JSON.stringify({ q, gl: 'au', hl: 'en', num: 10 }),
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'Part search failed' }, { status: 502 })
    }
    const data = (await res.json()) as { shopping?: SerperShoppingItem[] }
    const offers: PartOffer[] = (data.shopping ?? [])
      .filter((item) => item.title && item.link)
      .map((item) => ({
        title: item.title!,
        merchant: item.source ?? 'Unknown',
        price: item.price ?? '',
        priceValue: parsePrice(item.price),
        currency: 'AUD',
        link: item.link!,
        imageUrl: item.imageUrl,
        rating: item.rating,
        ratingCount: item.ratingCount,
        delivery: item.delivery,
      }))
      // Cheapest first; unknown prices sink to the bottom.
      .sort((a, b) => (a.priceValue ?? Infinity) - (b.priceValue ?? Infinity))

    return NextResponse.json({ query: q, offers })
  } catch {
    return NextResponse.json({ error: 'Part search service unavailable' }, { status: 502 })
  }
}
