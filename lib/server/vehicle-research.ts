import { serverEnv } from '@/lib/config/env'

// Shared "deep research" for the vehicle catalogue: given a make/model with no
// trim data, search the web (Serper), extract structured variant options with an
// LLM (Groq), and cache them into the SHARED catalogue via the add_shared_variant
// SECURITY DEFINER helper. Used by both the explicit /api/catalog/research route
// and the GET /api/catalog fallback (so the live app, which only calls GET, still
// gets researched trims without any client change).

type SerperResult = { title?: string; snippet?: string }

interface ResearchedVariant {
  name?: string
  engine?: string | null
  drivetrain?: string | null
  transmission?: string | null
}

// Minimal shape we need — satisfied by any Supabase client (server or user-scoped).
type RpcCapable = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }>
}

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= 120 ? trimmed : null
}

// Researches and caches variants for a model. Returns how many were written.
// Never throws — research is best-effort; callers fall back to whatever is cached.
export async function researchAndCacheVariants(
  supabase: RpcCapable,
  make: string,
  model: string,
  modelId: string,
  year?: number
): Promise<number> {
  const env = serverEnv()
  if (!env.SERPER_API_KEY || !env.GROQ_API_KEY) return 0

  try {
    const searchQuery = [make, model, year ? String(year) : '',
      'Australia specifications trims engine transmission drivetrain'].filter(Boolean).join(' ')
    const searchResponse = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: searchQuery, gl: 'au', hl: 'en', num: 8 }),
    })
    if (!searchResponse.ok) return 0
    const searchData = (await searchResponse.json()) as { organic?: SerperResult[] }
    const sourceText = (searchData.organic ?? [])
      .filter((s) => s.title && s.snippet)
      .slice(0, 8)
      .map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}`)
      .join('\n\n')

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
            content: `Vehicle: ${make} ${model}${year ? ` ${year}` : ''}\n\nSearch extracts:\n${sourceText || 'No results — use common AU-market knowledge only.'}`,
          },
        ],
      }),
    })
    if (!aiResponse.ok) return 0
    const aiData = (await aiResponse.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const raw = aiData.choices?.[0]?.message?.content?.trim() || '{}'

    let researched: ResearchedVariant[] = []
    try {
      const parsed = JSON.parse(raw) as { variants?: ResearchedVariant[] }
      if (Array.isArray(parsed.variants)) researched = parsed.variants.slice(0, 12)
    } catch {
      return 0
    }

    let added = 0
    for (const v of researched) {
      const name = clean(v.name)
      if (!name) continue
      const { error } = await supabase.rpc('add_shared_variant', {
        p_model_id: modelId,
        p_name: name,
        p_engine: clean(v.engine),
        p_drivetrain: clean(v.drivetrain),
        p_transmission: clean(v.transmission),
        p_year_start: null,
        p_year_end: null,
      })
      if (!error) added += 1
    }
    return added
  } catch {
    return 0
  }
}
