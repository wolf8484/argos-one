import { NextResponse } from 'next/server'

import { serverEnv } from '@/lib/config/env'
import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { catalogResearchSchema } from '@/lib/server/schemas'

// Deep-research fallback for the vehicle catalogue. When a make/model has no (or
// thin) trim/spec data, search the web (Serper) and extract structured variant
// options with an LLM (Groq), then cache them into the SHARED catalogue via the
// add_shared_variant SECURITY DEFINER helper. Results are near-authoritative
// starting points — a technician or VIN decode can still override any field.

type SerperResult = { title?: string; link?: string; snippet?: string }

interface ResearchedVariant {
  name?: string
  engine?: string | null
  drivetrain?: string | null
  transmission?: string | null
  year_start?: number | null
  year_end?: number | null
}

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= 120 ? trimmed : null
}

export async function POST(request: Request) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const input = catalogResearchSchema.parse(await request.json())
    const env = serverEnv()
    if (!env.SERPER_API_KEY || !env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'Vehicle research is not configured' }, { status: 503 })
    }

    // Resolve make + model to ids (both must already exist in the catalogue).
    const { data: makeRow, error: makeError } = await auth.supabase
      .from('makes').select('id,name').ilike('name', input.make).maybeSingle()
    if (makeError) throw makeError
    if (!makeRow) return NextResponse.json({ error: 'Unknown make' }, { status: 404 })
    const { data: modelRow, error: modelError } = await auth.supabase
      .from('models').select('id,name').eq('make_id', makeRow.id).ilike('name', input.model).maybeSingle()
    if (modelError) throw modelError
    if (!modelRow) return NextResponse.json({ error: 'Unknown model' }, { status: 404 })

    // 1) Web search, biased to Australia.
    const searchQuery = [input.make, input.model, input.year ? String(input.year) : '',
      'Australia specifications trims engine transmission drivetrain'].filter(Boolean).join(' ')
    const searchResponse = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: searchQuery, gl: 'au', hl: 'en', num: 8 }),
    })
    if (!searchResponse.ok) throw new Error(`Search returned ${searchResponse.status}`)
    const searchData = (await searchResponse.json()) as { organic?: SerperResult[] }
    const sourceText = (searchData.organic ?? [])
      .filter((s) => s.title && s.snippet)
      .slice(0, 8)
      .map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}`)
      .join('\n\n')

    // 2) Structured extraction. Strict JSON, no invented specs.
    const aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_completion_tokens: 1400,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You extract Australian-market vehicle configurations for a workshop app. Return STRICT JSON: {"variants":[{"name":string,"engine":string,"drivetrain":string,"transmission":string}]}. "name" is the trim (e.g. "SR5", "GTI"). Use concise workshop terms: drivetrain one of FWD/RWD/AWD/4WD; transmission like "6-speed manual", "8-speed automatic", "CVT", "7-speed DCT". Only include configurations well-supported by the extracts or common knowledge for the AU market. It is better to return fewer, correct entries than to invent specs. Max 12 entries. No commentary.',
          },
          {
            role: 'user',
            content: `Vehicle: ${input.make} ${input.model}${input.year ? ` ${input.year}` : ''}\n\nSearch extracts:\n${sourceText || 'No results — use common AU-market knowledge only.'}`,
          },
        ],
      }),
    })
    if (!aiResponse.ok) throw new Error(`Groq returned ${aiResponse.status}`)
    const aiData = (await aiResponse.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const raw = aiData.choices?.[0]?.message?.content?.trim() || '{}'

    let researched: ResearchedVariant[] = []
    try {
      const parsed = JSON.parse(raw) as { variants?: ResearchedVariant[] }
      if (Array.isArray(parsed.variants)) researched = parsed.variants.slice(0, 12)
    } catch {
      researched = []
    }

    // 3) Cache each valid entry into the shared catalogue (de-duped by the fn).
    let added = 0
    for (const v of researched) {
      const name = clean(v.name)
      if (!name) continue
      const { error } = await auth.supabase.rpc('add_shared_variant', {
        p_model_id: modelRow.id,
        p_name: name,
        p_engine: clean(v.engine),
        p_drivetrain: clean(v.drivetrain),
        p_transmission: clean(v.transmission),
        p_year_start: null,
        p_year_end: null,
      })
      if (!error) added += 1
    }

    // 4) Return the model's full variant list (shared + this shop's).
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
