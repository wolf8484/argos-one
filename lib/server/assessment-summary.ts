import { serverEnv } from '@/lib/config/env'

function fallbackSummary(complaint: string, observations?: string | null) {
  const combined = [complaint, observations].filter(Boolean).join(' ')
  return combined.length > 280 ? `${combined.slice(0, 277).trimEnd()}…` : combined
}

export async function summarizeAssessment(complaint: string, observations?: string | null) {
  const fallback = fallbackSummary(complaint, observations)
  const key = serverEnv().GROQ_API_KEY
  if (!key) return fallback
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', temperature: 0, max_completion_tokens: 120,
        messages: [
          { role: 'system', content: 'Create a concise workshop job-card summary in no more than two short sentences and 260 characters. Combine the customer complaint and any initial observation. Preserve facts, timing, numbers and uncertainty. Do not diagnose, recommend work, add labels, or invent information. Return only the summary.' },
          { role: 'user', content: `Customer complaint: ${complaint}\nInitial observations: ${observations || 'None recorded'}` },
        ],
      }),
    })
    if (!response.ok) return fallback
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const summary = data.choices?.[0]?.message?.content?.trim()
    return summary ? summary.slice(0, 280) : fallback
  } catch {
    return fallback
  }
}
