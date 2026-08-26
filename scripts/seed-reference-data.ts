// One-time (re-runnable) load of reference data into the two global lookup
// tables added in 0017_reference_data.sql: `dtc_reference` and `recalls`.
//
// Does NOT touch jobs, repair_records, or vehicle_profile_notes -- those stay
// 100% real shop/customer data. This script only writes to the two reference
// tables, and every write is an upsert keyed on a natural/stable key so the
// script is safe to run repeatedly.
//
// Usage:
//   npm run seed:reference                    # both datasets, all catalog models
//   npm run seed:reference -- --skip-dtc
//   npm run seed:reference -- --skip-recalls
//   npm run seed:reference -- --recalls-pages=10   # raise per-model result-page cap
//
// Sources:
//   DTC codes: https://github.com/todrobbins/dtcdb (MIT licensed, generic
//     SAE J2012 P-codes only -- the dataset has no B/C/U codes).
//   Recalls:   https://www.vehiclerecalls.gov.au/ (Australian Government
//     Product Safety recall register). There's no public export/API, but the
//     site's own search (?search=<make>+<model> on the public,
//     robots.txt-permitted /recalls/browse-all-recalls path) returns
//     genuinely filtered, relevant results -- so this is catalog-driven,
//     same shape as scripts/seed-complaint-trends.ts: every make/model in
//     the makes/models catalog is queried directly (not "whatever a scraped
//     listing window happens to surface"), so every catalog car gets
//     checked. Each recall's own detail page is then read for structured
//     Make/Model/Year-range/Defect fields, and anything whose category isn't
//     "Cars" is discarded (the search covers all vehicle types, not just
//     cars). `--recalls-pages` bounds how many result pages to walk per
//     model (default 3, 20 recalls/page) -- generous for a single
//     make/model query, which rarely exceeds one page.

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / (SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY) in the environment.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(`--${name}`)
const option = (name: string, fallback: number) => {
  const match = args.find((arg) => arg.startsWith(`--${name}=`))
  return match ? Number(match.split('=')[1]) : fallback
}
const stringOption = (name: string): string | null => {
  const match = args.find((arg) => arg.startsWith(`--${name}=`))
  return match ? match.split('=').slice(1).join('=') : null
}
const ONLY_MAKE = stringOption('make')
const ONLY_MODEL = stringOption('model')

const DTC_CSV_URL = 'https://raw.githubusercontent.com/todrobbins/dtcdb/master/generic.csv'
const RECALLS_BASE = 'https://www.vehiclerecalls.gov.au'
const RECALLS_LISTING = `${RECALLS_BASE}/recalls/browse-all-recalls`

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function seedDtcReference() {
  console.log(`Fetching DTC reference data from ${DTC_CSV_URL} ...`)
  const res = await fetch(DTC_CSV_URL)
  if (!res.ok) throw new Error(`DTC CSV fetch failed: ${res.status}`)
  const csv = await res.text()

  const byCode = new Map<string, { code: string; description: string; system: string | null; source: string }>()
  let currentSystem: string | null = null

  for (const rawLine of csv.split('\n')) {
    const line = rawLine.trim().replace(/\r$/, '')
    if (!line) continue
    const sectionMatch = line.match(/^DTC Codes\s*-\s*[A-Z0-9-]+\s*[–-]\s*(.+)$/)
    if (sectionMatch) {
      currentSystem = sectionMatch[1].trim()
      continue
    }
    const codeMatch = line.match(/^([PBCU]\d{4})\s*,\s*(.+)$/i)
    if (!codeMatch) continue
    // The source CSV has a couple of duplicate code rows; last one wins.
    byCode.set(codeMatch[1].toUpperCase(), {
      code: codeMatch[1].toUpperCase(),
      description: codeMatch[2].trim(),
      system: currentSystem,
      source: 'https://github.com/todrobbins/dtcdb',
    })
  }
  const rows = Array.from(byCode.values())

  console.log(`Parsed ${rows.length} DTC codes. Upserting...`)
  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from('dtc_reference').upsert(chunk, { onConflict: 'code' })
    if (error) throw error
  }
  console.log(`DTC reference: ${rows.length} codes upserted.`)
}

type ParsedRecall = {
  make: string
  model: string
  yearFrom: number | null
  yearTo: number | null
  defectDescription: string
  remedy: string | null
  sourceUrl: string
  recallDate: string | null
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

function extractField(html: string, fieldName: string): string | null {
  const re = new RegExp(`field--name-field-${fieldName}[^>]*>([\\s\\S]*?)</div>\\s*</div>`)
  const match = html.match(re)
  if (!match) return null
  return decodeHtmlEntities(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

function stripLabel(value: string, label: string): string {
  return value.startsWith(label) ? value.slice(label.length).trim() : value.trim()
}

async function fetchRecallDetail(path: string): Promise<ParsedRecall | null> {
  const url = `${RECALLS_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) return null
  const html = await res.text()

  const categoryRaw = extractField(html, 'product-category')
  if (!categoryRaw || !/\bCars\b/.test(categoryRaw)) return null

  const makeRaw = extractField(html, 'r-make')
  const modelRaw = extractField(html, 'r-models')
  const yearRaw = extractField(html, 'r-date-ranges')
  const publishRaw = extractField(html, 'r-original-publish-date')

  const defectMatch = html.match(/field--name-field-r-defect[^>]*>[\s\S]*?field__item[^>]*>([\s\S]*?)<\/div>/)
  const defectDescription = defectMatch ? decodeHtmlEntities(defectMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) : ''
  const remedy = extractField(html, 'r-action')

  const make = makeRaw ? stripLabel(makeRaw, 'Make') : ''
  const model = modelRaw ? stripLabel(modelRaw, 'Model') : ''
  if (!make || !model || !defectDescription) return null

  const yearText = yearRaw ? stripLabel(yearRaw, 'Year range') : ''
  const yearMatch = yearText.match(/(\d{4})\s*(?:-\s*(\d{4}))?/)
  const yearFrom = yearMatch ? Number(yearMatch[1]) : null
  const yearTo = yearMatch ? Number(yearMatch[2] || yearMatch[1]) : null

  const publishText = publishRaw ? stripLabel(publishRaw, 'Original published date') : ''
  const publishDate = new Date(publishText)
  const recallDate = Number.isNaN(publishDate.getTime()) ? null : publishDate.toISOString().slice(0, 10)

  // Mechanics care about what's realistically still on the road -- a
  // recall notice from the 1980s/90s isn't useful reference data here.
  if (recallDate && Number(recallDate.slice(0, 4)) < 2000) return null

  return { make, model, yearFrom, yearTo, defectDescription, remedy, sourceUrl: url, recallDate }
}

function dedupeKey(recall: ParsedRecall): string {
  const basis = `${recall.make.toLowerCase()}|${recall.model.toLowerCase()}|${recall.recallDate ?? ''}|${recall.defectDescription}`
  return createHash('sha256').update(basis).digest('hex')
}

function buildRecallRow(recall: ParsedRecall) {
  return {
    make: recall.make,
    model: recall.model,
    year_from: recall.yearFrom,
    year_to: recall.yearTo,
    defect_description: recall.defectDescription,
    remedy: recall.remedy,
    source_url: recall.sourceUrl,
    recall_date: recall.recallDate,
    dedupe_key: dedupeKey(recall),
  }
}

type CatalogModel = { make: string; model: string }

// Same catalog-driven approach as scripts/seed-complaint-trends.ts: every
// make/model in the makes/models catalog is queried directly, so coverage
// isn't at the mercy of whatever a scraped listing window happens to
// surface. The site's own search (?search=Make+Model on the same
// robots.txt-permitted /recalls/browse-all-recalls path) returns genuinely
// filtered, relevant results -- confirmed live against "Honda Civic"
// (correct Civic-specific recalls back to 2018, 1 extra page).
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

async function findRecallPathsForModel(make: string, model: string, maxPages: number): Promise<string[]> {
  const query = encodeURIComponent(`${make} ${model}`)
  const paths: string[] = []
  for (let page = 0; page < maxPages; page += 1) {
    const url = `${RECALLS_LISTING}?search=${query}${page > 0 ? `&page=${page}` : ''}`
    const res = await fetch(url)
    if (!res.ok) break
    const html = await res.text()
    const matches = [...html.matchAll(/<a href="(\/recalls\/rec-\d+)" class="text-primary">/g)]
    if (!matches.length) break
    paths.push(...matches.map((m) => m[1]))
    await sleep(200)
  }
  return paths
}

async function seedRecalls(maxPagesPerModel: number) {
  const catalog = await loadCatalog()
  console.log(`Seeding recalls for ${catalog.length} catalog model(s) via per-model search...`)

  const detailPaths = new Set<string>()
  let done = 0
  for (const { make, model } of catalog) {
    try {
      const paths = await findRecallPathsForModel(make, model, maxPagesPerModel)
      for (const path of paths) detailPaths.add(path)
    } catch (err) {
      console.warn(`  ${make} ${model}: search failed (${(err as Error).message})`)
    }
    done += 1
    if (done % 20 === 0) console.log(`  [${done}/${catalog.length}] models searched, ${detailPaths.size} distinct recall(s) found so far`)
  }

  console.log(`Found ${detailPaths.size} distinct recall detail pages across the catalog. Fetching each (rate-limited)...`)
  const carRecalls: ParsedRecall[] = []
  let checked = 0
  for (const path of detailPaths) {
    checked += 1
    try {
      const detail = await fetchRecallDetail(path)
      if (detail) carRecalls.push(detail)
    } catch (err) {
      console.warn(`  ${path}: fetch/parse failed (${(err as Error).message})`)
    }
    if (checked % 25 === 0) console.log(`  checked ${checked}/${detailPaths.size}, ${carRecalls.length} car recalls so far`)
    await sleep(250)
  }

  console.log(`${carRecalls.length} car recalls parsed. Upserting...`)
  const byDedupeKey = new Map<string, ReturnType<typeof buildRecallRow>>()
  for (const recall of carRecalls) {
    const row = buildRecallRow(recall)
    byDedupeKey.set(row.dedupe_key, row)
  }
  const rows = Array.from(byDedupeKey.values())

  const chunkSize = 200
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from('recalls').upsert(chunk, { onConflict: 'dedupe_key' })
    if (error) throw error
  }
  console.log(`Recalls: ${rows.length} car recalls upserted.`)
}

async function main() {
  if (!flag('skip-dtc')) await seedDtcReference()
  else console.log('Skipping DTC reference (--skip-dtc)')

  if (!flag('skip-recalls')) await seedRecalls(option('recalls-pages', 3))
  else console.log('Skipping recalls (--skip-recalls)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
