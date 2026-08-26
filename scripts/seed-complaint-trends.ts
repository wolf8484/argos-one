// Seeds `complaint_trends` (0019_complaint_trends.sql) from the NHTSA
// consumer-complaints API, aggregated by component -- the second source
// feeding the car profile's "Known issues" section, alongside recalls.
//
// Unlike the recall seed (which walks a scraped listing), this is driven
// directly from the makes/models catalog so every catalog car gets a row
// set, not just ones a listing happens to surface. For each catalog
// make/model, it queries the last N model years (default 15) and stores
// aggregated per-component complaint counts -- not raw individual
// complaints, since a single popular model year can have 500+ raw
// complaints and dumping those would bury the signal.
//
// Does NOT touch jobs, repair_records, or vehicle_profile_notes.
//
// Usage:
//   npm run seed:complaints                     # all catalog makes/models, last 15 model years
//   npm run seed:complaints -- --years=8
//   npm run seed:complaints -- --make=Honda --model=Civic   # single model, for a quick test run
//
// Source: https://api.nhtsa.gov/complaints/complaintsByVehicle -- public,
// no API key, no auth. NHTSA "Model Year" is a required exact-match param
// (querying without it returns zero results), so this loops one request
// per make/model/year.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / (SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY) in the environment.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const args = process.argv.slice(2)
const option = (name: string, fallback: string | null = null) => {
  const match = args.find((arg) => arg.startsWith(`--${name}=`))
  return match ? match.split('=').slice(1).join('=') : fallback
}

const YEARS_BACK = Number(option('years', '15'))
const ONLY_MAKE = option('make')
const ONLY_MODEL = option('model')
const COMPLAINTS_BASE = 'https://api.nhtsa.gov/complaints/complaintsByVehicle'

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type CatalogModel = { make: string; model: string }

async function loadCatalog(): Promise<CatalogModel[]> {
  const { data: makes, error: makesError } = await supabase.from('makes').select('id,name')
  if (makesError) throw makesError
  const { data: models, error: modelsError } = await supabase.from('models').select('make_id,name')
  if (modelsError) throw modelsError

  const makeById = new Map((makes ?? []).map((m) => [m.id, m.name]))
  const catalog = (models ?? [])
    .map((m) => ({ make: makeById.get(m.make_id), model: m.name }))
    .filter((m): m is CatalogModel => Boolean(m.make))

  if (ONLY_MAKE) {
    return catalog.filter((m) => m.make.toLowerCase() === ONLY_MAKE.toLowerCase() && (!ONLY_MODEL || m.model.toLowerCase() === ONLY_MODEL.toLowerCase()))
  }
  return catalog
}

type ComplaintResult = { components: string; summary: string }

async function fetchComplaints(make: string, model: string, year: number): Promise<ComplaintResult[]> {
  const url = `${COMPLAINTS_BASE}?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`
  const res = await fetch(url)
  if (!res.ok) return []
  const body = (await res.json()) as { results?: ComplaintResult[] }
  return body.results ?? []
}

// NHTSA complaint text is consumer-submitted and often typed in all caps.
// Reads as shouting in the UI, so shouty text gets sentence-cased; text
// that's already normal case (or short acronyms like "ABS") is left alone.
function normalizeShoutyText(value: string): string {
  const letters = value.replace(/[^a-zA-Z]/g, '')
  if (!letters.length) return value
  const upperRatio = (letters.match(/[A-Z]/g) || []).length / letters.length
  if (upperRatio < 0.6) return value

  const lowered = value.toLowerCase()
  return lowered
    .replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, (match) => match.toUpperCase())
    .replace(/\bi\b/g, 'I')
}

type ComponentAgg = { count: number; sampleSummary: string }

async function seedModel(make: string, model: string, currentYear: number) {
  const byComponent = new Map<string, ComponentAgg>()

  for (let offset = 0; offset < YEARS_BACK; offset += 1) {
    const year = currentYear - offset
    try {
      const complaints = await fetchComplaints(make, model, year)
      for (const complaint of complaints) {
        const seenInThisComplaint = new Set<string>()
        for (const raw of (complaint.components || '').split(',')) {
          const component = raw.trim()
          if (!component || component === 'UNKNOWN OR OTHER' || seenInThisComplaint.has(component)) continue
          seenInThisComplaint.add(component)
          const existing = byComponent.get(component)
          if (existing) {
            existing.count += 1
          } else {
            byComponent.set(component, { count: 1, sampleSummary: normalizeShoutyText((complaint.summary || '').trim().slice(0, 500)) })
          }
        }
      }
    } catch (err) {
      console.warn(`  ${make} ${model} ${year}: fetch failed (${(err as Error).message})`)
    }
    await sleep(150)
  }

  const rows = Array.from(byComponent.entries()).map(([component, agg]) => ({
    make,
    model,
    component,
    complaint_count: agg.count,
    sample_summary: agg.sampleSummary || null,
  }))

  if (!rows.length) return 0

  const { error } = await supabase.from('complaint_trends').upsert(rows, { onConflict: 'make,model,component' })
  if (error) throw error
  return rows.length
}

async function main() {
  const catalog = await loadCatalog()
  console.log(`Seeding complaint trends for ${catalog.length} catalog model(s), last ${YEARS_BACK} model years each...`)
  const currentYear = new Date().getFullYear()

  let done = 0
  for (const { make, model } of catalog) {
    const rowCount = await seedModel(make, model, currentYear)
    done += 1
    console.log(`  [${done}/${catalog.length}] ${make} ${model}: ${rowCount} component row(s)`)
  }

  console.log('Complaint trends: done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
