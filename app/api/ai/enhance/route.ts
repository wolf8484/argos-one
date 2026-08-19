import { NextRequest, NextResponse } from 'next/server'

import { serverEnv } from '@/lib/config/env'
import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { enhanceTextSchema } from '@/lib/server/schemas'

export async function POST(request: NextRequest) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error

  try {
    const input = enhanceTextSchema.parse(await request.json())
    const key = serverEnv().GROQ_API_KEY
    if (!key) return NextResponse.json({ error: 'AI enhancement is not configured' }, { status: 503 })
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        temperature: 0.1,
        max_completion_tokens: 800,
        messages: [
          { role: 'system', content: `Rewrite workshop ${input.field.replace('_', ' ')} notes for clarity. Preserve every fact, number, uncertainty and the mechanic's meaning. Do not diagnose, invent facts, add advice, headings, bullets or commentary. Return only the improved text.` },
          { role: 'user', content: input.text },
        ],
      }),
    })
    if (!response.ok) throw new Error(`Groq returned ${response.status}`)
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) throw new Error('AI enhancement returned no text')
    return NextResponse.json({ text })
  } catch (error) {
    return apiError(error, 'AI enhancement failed')
  }
}
