// Client helpers for the trim/spec catalogue used on the vehicle step.
// GET is public; research requires a signed-in workshop user.

export interface VehicleVariant {
  id: string
  name: string
  engine: string | null
  drivetrain: string | null
  transmission: string | null
  year_start: number | null
  year_end: number | null
  is_custom: boolean
}

export async function fetchVariants(make: string, model: string): Promise<VehicleVariant[]> {
  if (!make.trim() || !model.trim()) return []
  const params = new URLSearchParams({ make, model })
  const res = await fetch(`/api/catalog?${params.toString()}`)
  if (!res.ok) return []
  const data = (await res.json()) as { variants?: VehicleVariant[] }
  return data.variants ?? []
}

// Deep-research fallback: fills the shared catalogue for this make/model and
// returns the resulting list. Returns [] on failure so the UI can fall back to
// manual entry.
export async function researchVariants(
  make: string,
  model: string,
  year?: number
): Promise<VehicleVariant[]> {
  try {
    const res = await fetch('/api/catalog/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ make, model, year }),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { variants?: VehicleVariant[] }
    return data.variants ?? []
  } catch {
    return []
  }
}

// Distinct, non-empty values for a spec field across a set of variants,
// preserving first-seen order.
export function distinctValues(
  variants: VehicleVariant[],
  key: 'engine' | 'drivetrain' | 'transmission'
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of variants) {
    const value = v[key]
    if (value && !seen.has(value)) {
      seen.add(value)
      out.push(value)
    }
  }
  return out
}
