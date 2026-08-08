// Vehicle make/model catalog with per-device persistence.
//
// NOTE: custom additions are stored in localStorage, so they persist per-device
// only. When the Supabase backend lands (v2), swap the getCustom*/addCustom*
// helpers to read/write the shared shop catalog — the component API stays the same.

export const SEED_MAKES: string[] = [
  'Audi', 'BMW', 'Ford', 'Holden', 'Honda', 'Hyundai', 'Isuzu', 'Jeep',
  'Kia', 'Land Rover', 'Lexus', 'Mazda', 'Mercedes-Benz', 'MG', 'Mitsubishi',
  'Nissan', 'Subaru', 'Suzuki', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo',
]

const SEED_MODELS: Record<string, string[]> = {
  Audi: ['A1', 'A3', 'A4', 'A5', 'A6', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'S3', 'SQ5', 'RS3', 'e-tron'],
  BMW: ['1 Series', '2 Series', '3 Series', '4 Series', '5 Series', 'X1', 'X3', 'X5', 'M3', 'M5'],
  Ford: ['Ranger', 'Everest', 'Escape', 'Focus', 'Falcon', 'Territory', 'Mustang', 'Transit'],
  Holden: ['Commodore', 'Colorado', 'Astra', 'Barina', 'Captiva', 'Cruze', 'Trax'],
  Honda: ['Accord', 'City', 'Civic', 'CR-V', 'HR-V', 'Jazz', 'Odyssey'],
  Hyundai: ['i20', 'i30', 'Accent', 'Elantra', 'Kona', 'Santa Fe', 'Tucson', 'iLoad'],
  Isuzu: ['D-Max', 'MU-X'],
  Jeep: ['Cherokee', 'Grand Cherokee', 'Wrangler', 'Compass'],
  Kia: ['Cerato', 'Picanto', 'Rio', 'Seltos', 'Sorento', 'Sportage', 'Carnival'],
  'Land Rover': ['Defender', 'Discovery', 'Range Rover', 'Range Rover Evoque', 'Range Rover Sport'],
  Lexus: ['CT', 'ES', 'IS', 'NX', 'RX', 'UX'],
  Mazda: ['Mazda2', 'Mazda3', 'Mazda6', 'CX-3', 'CX-30', 'CX-5', 'CX-8', 'CX-9', 'BT-50', 'MX-5'],
  'Mercedes-Benz': ['A-Class', 'C-Class', 'E-Class', 'GLA', 'GLC', 'GLE', 'Sprinter', 'Vito'],
  MG: ['MG3', 'ZS', 'HS', 'MG5'],
  Mitsubishi: ['ASX', 'Eclipse Cross', 'Outlander', 'Pajero', 'Pajero Sport', 'Triton'],
  Nissan: ['Navara', 'Qashqai', 'X-Trail', 'Patrol', 'Pathfinder', 'Juke', 'Leaf'],
  Subaru: ['Impreza', 'WRX', 'Forester', 'Outback', 'XV', 'Liberty', 'BRZ'],
  Suzuki: ['Swift', 'Baleno', 'Vitara', 'Jimny', 'Ignis', 'S-Cross'],
  Tesla: ['Model 3', 'Model Y', 'Model S', 'Model X'],
  Toyota: ['Corolla', 'Camry', 'RAV4', 'HiLux', 'LandCruiser', 'Prado', 'Kluger', 'Yaris', 'C-HR', 'Fortuner'],
  Volkswagen: ['Golf', 'Polo', 'Tiguan', 'T-Cross', 'T-Roc', 'Amarok', 'Passat', 'Touareg'],
  Volvo: ['XC40', 'XC60', 'XC90', 'S60', 'V60'],
}

const LS_MAKES = 'argos:customMakes'
const LS_MODELS = 'argos:customModels' // { [MAKE_UPPER]: string[] }

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

// Merge + de-duplicate case-insensitively, keeping the first (seed) casing, sorted.
function mergeSorted(seed: string[], custom: string[]): string[] {
  const seen = new Map<string, string>()
  for (const v of [...seed, ...custom]) {
    const key = v.trim().toLowerCase()
    if (key && !seen.has(key)) seen.set(key, v.trim())
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

function seedModelsFor(make: string): string[] {
  const key = Object.keys(SEED_MODELS).find((k) => k.toLowerCase() === make.trim().toLowerCase())
  return key ? SEED_MODELS[key] : []
}

export function getAllMakes(): string[] {
  return mergeSorted(SEED_MAKES, readJson<string[]>(LS_MAKES, []))
}

export function getModelsForMake(make: string): string[] {
  if (!make.trim()) return []
  const custom = readJson<Record<string, string[]>>(LS_MODELS, {})
  return mergeSorted(seedModelsFor(make), custom[make.trim().toUpperCase()] ?? [])
}

export function addCustomMake(make: string): void {
  const m = make.trim()
  if (!m) return
  const existing = getAllMakes()
  if (existing.some((x) => x.toLowerCase() === m.toLowerCase())) return
  writeJson(LS_MAKES, [...readJson<string[]>(LS_MAKES, []), m])
}

export function addCustomModel(make: string, model: string): void {
  const mk = make.trim()
  const md = model.trim()
  if (!mk || !md) return
  if (getModelsForMake(mk).some((x) => x.toLowerCase() === md.toLowerCase())) return
  const all = readJson<Record<string, string[]>>(LS_MODELS, {})
  const key = mk.toUpperCase()
  all[key] = [...(all[key] ?? []), md]
  writeJson(LS_MODELS, all)
}

// Return the catalog's canonical casing for a make (e.g. VIN "AUDI" -> "Audi").
export function normalizeMake(make: string): string {
  const match = getAllMakes().find((x) => x.toLowerCase() === make.trim().toLowerCase())
  return match ?? make.trim()
}
