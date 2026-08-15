import type { PartSearchResult } from '@/types'

// Client-side helper for the "Search best price" action on each part.
// Calls our server route (which holds the SERP key) and returns normalized
// offers ready for the results sheet.
export async function searchPartPrices(
  query: string,
  partNumber?: string
): Promise<PartSearchResult> {
  const res = await fetch('/api/parts/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, partNumber }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? 'Part search failed')
  }
  return (await res.json()) as PartSearchResult
}
