import { serverEnv } from '@/lib/config/env'

// Structured facts (fault code, mileage, make/model) are matched in SQL.
// This covers the part SQL can't: naming *what* about the free-text
// complaint/observations lines up with a candidate repair's cause/notes,
// e.g. "Similar warm-idle symptoms" or "Same engine/PCV system". Callers
// cache the result per (job, repair) pairing so this only runs once.
export async function generateMatchInsights(
  targetComplaint: string,
  targetObservations: string | null | undefined,
  candidateCause: string | null | undefined,
  candidateWorkPerformed: string | null | undefined,
): Promise<string[]> {
  const key = serverEnv().GROQ_API_KEY
  if (!key) return []
  const candidateContext = [candidateCause, candidateWorkPerformed].filter(Boolean).join(' ')
  if (!candidateContext.trim()) return []
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0,
        max_completion_tokens: 120,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Compare a workshop job complaint against a past repair\'s cause. Return JSON {"reasons": string[]} with at most 2 short reasons (max 6 words each, title case, no trailing period) naming a *specific* symptom or vehicle system they share, e.g. "Similar warm-idle symptoms" or "Same engine/PCV system". Only include a reason if the texts genuinely support it. If nothing specific lines up, return {"reasons": []}. Do not repeat generic facts like make, model or fault code.',
          },
          {
            role: 'user',
            content: `Current job complaint: ${targetComplaint}\nCurrent job observations: ${targetObservations || 'None recorded'}\n\nPast repair cause: ${candidateContext}`,
          },
        ],
      }),
    })
    if (!response.ok) return []
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data.choices?.[0]?.message?.content
    if (!raw) return []
    const parsed = JSON.parse(raw) as { reasons?: unknown }
    if (!Array.isArray(parsed.reasons)) return []
    return parsed.reasons.filter((reason): reason is string => typeof reason === 'string' && reason.trim().length > 0).slice(0, 2)
  } catch {
    return []
  }
}
