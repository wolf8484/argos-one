import { serverEnv } from '@/lib/config/env'

// The mechanic only ever records work_performed and verification_notes as
// free text -- there's no structured "cause" or "steps" input anywhere in
// the UI. This turns that free text into a short summary at completion
// time, so the historical repair record can show a quick "what solved it"
// line without pretending the mechanic entered structured data they didn't.
export async function generateRepairSummary(
  workPerformed: string,
  verificationNotes: string | null | undefined,
): Promise<string | null> {
  const key = serverEnv().GROQ_API_KEY
  if (!key || !workPerformed.trim()) return null
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
            content: 'Summarize a completed vehicle repair in 1-2 short sentences (max 40 words total): what was wrong and what was done about it. Return JSON {"summary": string}. Plain factual tone, no marketing language, third person, do not mention "the mechanic" or restate that verification passed.',
          },
          {
            role: 'user',
            content: `Work performed: ${workPerformed}\nVerification: ${verificationNotes || 'Not recorded'}`,
          },
        ],
      }),
    })
    if (!response.ok) return null
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data.choices?.[0]?.message?.content
    if (!raw) return null
    const parsed = JSON.parse(raw) as { summary?: unknown }
    return typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : null
  } catch {
    return null
  }
}
