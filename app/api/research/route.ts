import { NextRequest, NextResponse } from 'next/server'

import { serverEnv } from '@/lib/config/env'
import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { researchSchema } from '@/lib/server/schemas'

type SerperResult = { title?: string; link?: string; snippet?: string; date?: string }

export async function POST(request: NextRequest) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const input = researchSchema.parse(await request.json())
    const env = serverEnv()
    if (!env.SERPER_API_KEY || !env.GROQ_API_KEY) return NextResponse.json({ error: 'Repair research is not configured' }, { status: 503 })
    const searchQuery = [input.vehicle, input.dtcs.join(' '), input.query].filter(Boolean).join(' ')
    const searchResponse = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: searchQuery, gl: 'au', hl: 'en', num: 8 }),
    })
    if (!searchResponse.ok) throw new Error(`Search returned ${searchResponse.status}`)
    const searchData = await searchResponse.json() as { organic?: SerperResult[] }
    const sources = (searchData.organic ?? []).filter((source) => source.title && source.link).slice(0, 8).map((source) => ({
      title: source.title!, url: source.link!, snippet: source.snippet || '', date: source.date || null,
    }))
    const sourceText = sources.map((source, index) => `[${index + 1}] ${source.title}\n${source.snippet}\n${source.url}`).join('\n\n')
    const aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b', temperature: 0.1, max_completion_tokens: 1200,
        messages: [
          { role: 'system', content: 'You are assisting a qualified automotive technician. Summarize only the supplied search extracts. Clearly distinguish likely diagnostic directions from confirmed facts, mention safety-critical uncertainty, tell the mechanic to verify against official service information, and cite source numbers in square brackets. Never invent torque values, procedures, part fitment or diagnoses.' },
          { role: 'user', content: `Vehicle: ${input.vehicle || 'not supplied'}\nDTCs: ${input.dtcs.join(', ') || 'none supplied'}\nComplaint: ${input.complaint || 'not supplied'}\nObservations: ${input.observations || 'not supplied'}\nResearch request: ${input.query}\n\nSearch extracts:\n${sourceText || 'No results'}` },
        ],
      }),
    })
    if (!aiResponse.ok) throw new Error(`Groq returned ${aiResponse.status}`)
    const aiData = await aiResponse.json() as { choices?: Array<{ message?: { content?: string } }> }
    const synthesis = aiData.choices?.[0]?.message?.content?.trim() || 'No synthesis could be generated. Review the source links directly.'
    if (input.jobId) {
      const { error } = await auth.supabase.from('web_research').insert({
        shop_id: auth.profile.shop_id, job_id: input.jobId, query: searchQuery, synthesis, sources, created_by: auth.profile.id,
      })
      if (error) throw error
    }
    return NextResponse.json({ query: searchQuery, synthesis, sources })
  } catch (error) {
    return apiError(error, 'Web repair research failed')
  }
}
