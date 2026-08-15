// Vehicle make/model catalog, backed by Supabase (shared shop-wide).
// Custom additions insert new rows that everyone then sees — replacing the
// earlier per-device localStorage approach.
//
// In-memory caches avoid redundant round-trips: selecting the same make twice
// in one session, or re-opening the model dropdown, is instant after the first
// fetch. Caches are session-scoped (module-level) and invalidated by adding a
// custom make/model, which is the only thing that can change them.

import { supabase } from '@/lib/supabase/client'

type MakeRow = { id: string; name: string }

let makesCache: Promise<MakeRow[]> | null = null
const modelsCache = new Map<string, Promise<string[]>>()

async function loadMakes(): Promise<MakeRow[]> {
  const pending: Promise<MakeRow[]> =
    makesCache ??
    supabase
      .from('makes')
      .select('id,name')
      .order('name')
      .then(({ data, error }: { data: MakeRow[] | null; error: { message: string } | null }) => {
        if (error) {
          console.error('loadMakes failed', error)
          return []
        }
        return data ?? []
      })
  makesCache = pending
  const result = await pending
  if (result.length === 0) makesCache = null // allow retry on empty/failed fetch
  return result
}

export async function getAllMakes(): Promise<string[]> {
  return (await loadMakes()).map((m) => m.name)
}

export async function getModelsForMake(make: string): Promise<string[]> {
  const key = make.trim().toLowerCase()
  if (!key) return []
  let cached = modelsCache.get(key)
  if (!cached) {
    cached = (async () => {
      const makes = await loadMakes()
      const mk = makes.find((m) => m.name.toLowerCase() === key)
      if (!mk) return []
      const { data, error } = await supabase.from('models').select('name').eq('make_id', mk.id).order('name')
      if (error) {
        console.error('getModelsForMake failed', error)
        return []
      }
      return (data ?? []).map((r: { name: string }) => r.name)
    })()
    modelsCache.set(key, cached)
  }
  return cached
}

export async function addCustomMake(make: string): Promise<void> {
  const name = make.trim()
  if (!name) return
  const { error } = await supabase.from('makes').insert({ name, is_custom: true })
  // 23505 = unique violation (make already exists) — safe to ignore.
  if (error && error.code !== '23505') console.error('addCustomMake failed', error)
  makesCache = null
}

export async function addCustomModel(make: string, model: string): Promise<void> {
  const mk = make.trim()
  const md = model.trim()
  if (!mk || !md) return

  let makeId: string | undefined
  const { data: makeRow } = await supabase.from('makes').select('id').ilike('name', mk).maybeSingle()
  makeId = makeRow?.id
  if (!makeId) {
    const { data: inserted } = await supabase
      .from('makes')
      .insert({ name: mk, is_custom: true })
      .select('id')
      .single()
    makeId = inserted?.id
  }
  if (!makeId) return

  const { error } = await supabase.from('models').insert({ make_id: makeId, name: md, is_custom: true })
  if (error && error.code !== '23505') console.error('addCustomModel failed', error)
  makesCache = null
  modelsCache.delete(mk.toLowerCase())
}
