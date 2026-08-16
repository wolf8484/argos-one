import { NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { catalogResearchSchema } from '@/lib/server/schemas'
import { researchAndCacheVariants } from '@/lib/server/vehicle-research'

// Explicit deep-research endpoint for the vehicle catalogue. Resolves a make/model
// to ids, researches + caches trim/spec options (shared logic in
// lib/server/vehicle-research), and returns the model's full variant list.
// GET /api/catalog runs the same fallback automatically when a model is empty.

export async function POST(request: Request) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const input = catalogResearchSchema.parse(await request.json())

    // Resolve make + model to ids (both must already exist in the catalogue).
    const { data: makeRow, error: makeError } = await auth.supabase
      .from('makes').select('id,name').ilike('name', input.make).maybeSingle()
    if (makeError) throw makeError
    if (!makeRow) return NextResponse.json({ error: 'Unknown make' }, { status: 404 })
    const { data: modelRow, error: modelError } = await auth.supabase
      .from('models').select('id,name').eq('make_id', makeRow.id).ilike('name', input.model).maybeSingle()
    if (modelError) throw modelError
    if (!modelRow) return NextResponse.json({ error: 'Unknown model' }, { status: 404 })

    const added = await researchAndCacheVariants(auth.supabase, makeRow.name, modelRow.name, modelRow.id, input.year)

    const { data: variants, error: listError } = await auth.supabase
      .from('vehicle_variants')
      .select('id,name,year_start,year_end,engine,drivetrain,transmission,is_custom')
      .eq('model_id', modelRow.id)
      .order('is_custom', { ascending: true })
      .order('name')
    if (listError) throw listError

    return NextResponse.json({ make: makeRow.name, model: modelRow.name, added, variants: variants ?? [] })
  } catch (error) {
    return apiError(error, 'Vehicle research failed')
  }
}
