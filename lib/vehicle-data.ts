// Vehicle make/model catalog, backed by Supabase (shared shop-wide).
// Custom additions insert new rows that everyone then sees — replacing the
// earlier per-device localStorage approach.

import { supabase } from '@/lib/supabase/client'

export async function getAllMakes(): Promise<string[]> {
  const { data, error } = await supabase.from('makes').select('name').order('name')
  if (error) {
    console.error('getAllMakes failed', error)
    return []
  }
  return (data ?? []).map((r: { name: string }) => r.name)
}

export async function getModelsForMake(make: string): Promise<string[]> {
  if (!make.trim()) return []
  const { data: mk, error: e1 } = await supabase
    .from('makes')
    .select('id')
    .ilike('name', make.trim())
    .maybeSingle()
  if (e1 || !mk) return []

  const { data, error } = await supabase
    .from('models')
    .select('name')
    .eq('make_id', mk.id)
    .order('name')
  if (error) {
    console.error('getModelsForMake failed', error)
    return []
  }
  return (data ?? []).map((r: { name: string }) => r.name)
}

export async function addCustomMake(make: string): Promise<void> {
  const name = make.trim()
  if (!name) return
  const { error } = await supabase.from('makes').insert({ name, is_custom: true })
  // 23505 = unique violation (make already exists) — safe to ignore.
  if (error && error.code !== '23505') console.error('addCustomMake failed', error)
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
}
