import { NextRequest, NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { catalogWriteSchema } from '@/lib/server/schemas'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const make = request.nextUrl.searchParams.get('make')?.trim()
    const model = request.nextUrl.searchParams.get('model')?.trim()
    if (make) {
      const { data: makeRow, error: makeError } = await supabase.from('makes').select('id').ilike('name', make).maybeSingle()
      if (makeError) throw makeError
      if (!makeRow) return NextResponse.json({ make, models: [] })
      if (model) {
        const { data: modelRow, error: modelError } = await supabase
          .from('models')
          .select('id,name')
          .eq('make_id', makeRow.id)
          .ilike('name', model)
          .maybeSingle()
        if (modelError) throw modelError
        if (!modelRow) return NextResponse.json({ make, model, variants: [] })
        const { data, error } = await supabase
          .from('vehicle_variants')
          .select('id,name,year_start,year_end,engine,drivetrain,transmission,is_custom')
          .eq('model_id', modelRow.id)
          .order('is_custom', { ascending: true })
          .order('name')
        if (error) throw error
        return NextResponse.json({ make, model: modelRow.name, variants: data ?? [] })
      }
      const { data, error } = await supabase.from('models').select('name').eq('make_id', makeRow.id).order('name')
      if (error) throw error
      return NextResponse.json({ make, models: (data ?? []).map((row) => row.name) })
    }
    const { data, error } = await supabase.from('makes').select('name').order('name')
    if (error) throw error
    return NextResponse.json({ makes: (data ?? []).map((row) => row.name) })
  } catch (error) {
    return apiError(error, 'Could not load vehicle catalog')
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const input = catalogWriteSchema.parse(await request.json())
    const { data: initialMakeRow, error: makeError } = await auth.supabase.from('makes').select('id,name').ilike('name', input.make).maybeSingle()
    if (makeError) throw makeError
    let makeRow = initialMakeRow
    if (!makeRow) {
      const result = await auth.supabase.from('makes').insert({ name: input.make, is_custom: true }).select('id,name').single()
      if (result.error) throw result.error
      makeRow = result.data
    }
    let modelRow: { id: string; name: string } | null = null
    if (input.model) {
      const { data: existingModel, error: modelLookupError } = await auth.supabase
        .from('models')
        .select('id,name')
        .eq('make_id', makeRow.id)
        .ilike('name', input.model)
        .maybeSingle()
      if (modelLookupError) throw modelLookupError
      modelRow = existingModel
      if (!modelRow) {
        const { data, error } = await auth.supabase
          .from('models')
          .insert({ make_id: makeRow.id, name: input.model, is_custom: true })
          .select('id,name')
          .single()
        if (error) throw error
        modelRow = data
      }
    }
    let variant = null
    if (input.variant) {
      if (!modelRow) throw new Error('Choose or add a model before adding a variant')
      const { data: existingVariant, error: variantLookupError } = await auth.supabase
        .from('vehicle_variants')
        .select('id,name,engine,drivetrain,transmission')
        .eq('model_id', modelRow.id)
        .eq('shop_id', auth.profile.shop_id)
        .ilike('name', input.variant)
        .maybeSingle()
      if (variantLookupError) throw variantLookupError
      if (existingVariant) {
        variant = existingVariant
      } else {
        const { data, error } = await auth.supabase
        .from('vehicle_variants')
        .insert({
          model_id: modelRow.id,
          shop_id: auth.profile.shop_id,
          name: input.variant,
          engine: input.engine || null,
          drivetrain: input.drivetrain || null,
          transmission: input.transmission || null,
          is_custom: true,
        })
        .select('id,name,engine,drivetrain,transmission')
        .single()
        if (error) throw error
        variant = data
      }
    }
    return NextResponse.json({ make: makeRow.name, model: modelRow?.name ?? null, variant }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Could not update vehicle catalog')
  }
}
