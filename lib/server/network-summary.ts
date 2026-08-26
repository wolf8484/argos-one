import { createHash } from 'node:crypto'

import { serverEnv } from '@/lib/config/env'

export type NetworkPatternSummary = {
  mostCommonIssue: string
  symptomsSummary: string
  repairSummary: string
}

export function hashPatternSource(label: string, symptoms: string[], repairs: string[]) {
  const hash = createHash('sha256')
  hash.update(label)
  hash.update('|')
  hash.update([...symptoms].sort().join('\n'))
  hash.update('|')
  hash.update([...repairs].sort().join('\n'))
  return hash.digest('hex')
}

// Caps how much raw text goes into the prompt -- a handful of write-ups is
// plenty to summarize a pattern, and keeps token usage/latency bounded even
// if a label ends up shared by many jobs over time.
const MAX_SAMPLES = 8

// The prompt asks for <=6 words, but the model isn't guaranteed to comply --
// cap it here so a run-on issue name never reaches the fixed-height UI rows.
const MAX_ISSUE_WORDS = 8

function capIssueWords(issue: string) {
  const words = issue.trim().split(/\s+/)
  return words.length > MAX_ISSUE_WORDS ? `${words.slice(0, MAX_ISSUE_WORDS).join(' ')}…` : issue
}

export async function summarizeNetworkPattern(input: {
  label: string
  symptoms: string[]
  repairs: string[]
}): Promise<NetworkPatternSummary> {
  const key = serverEnv().GROQ_API_KEY
  const symptoms = input.symptoms.slice(0, MAX_SAMPLES)
  const repairs = input.repairs.slice(0, MAX_SAMPLES)
  const fallback: NetworkPatternSummary = {
    mostCommonIssue: input.label,
    symptomsSummary: symptoms[0] || 'No symptom details shared.',
    repairSummary: repairs[0] || 'No repair details shared.',
  }
  if (!key) return fallback

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        temperature: 0.1,
        max_completion_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You summarize repeated vehicle repairs reported by multiple independent workshops. Given a fault label plus raw symptom write-ups and raw repair write-ups from several jobs, produce a short, factual summary. Only state what is actually supported by the inputs -- never invent parts, causes, or steps. Return strict JSON with exactly these keys: "mostCommonIssue" (a short issue name, MAXIMUM 6 words, never a full sentence -- just enough to identify the fault, e.g. "Rough idle with cylinder misfire", not a run-on description of every condition it happens under), "symptomsSummary" (1-2 sentences combining the common symptoms), "repairSummary" (1-2 sentences combining the common fix). No markdown, no extra keys.',
          },
          {
            role: 'user',
            content: `Fault label: ${input.label}\n\nSymptom write-ups:\n${symptoms.map((s, i) => `${i + 1}. ${s}`).join('\n') || 'none provided'}\n\nRepair write-ups:\n${repairs.map((r, i) => `${i + 1}. ${r}`).join('\n') || 'none provided'}`,
          },
        ],
      }),
    })
    if (!response.ok) throw new Error(`Groq returned ${response.status}`)
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const raw = data.choices?.[0]?.message?.content?.trim()
    if (!raw) throw new Error('Groq returned no content')
    const parsed = JSON.parse(raw) as Partial<NetworkPatternSummary>
    if (!parsed.mostCommonIssue || !parsed.symptomsSummary || !parsed.repairSummary) throw new Error('Incomplete summary')
    return {
      mostCommonIssue: capIssueWords(parsed.mostCommonIssue),
      symptomsSummary: parsed.symptomsSummary,
      repairSummary: parsed.repairSummary,
    }
  } catch (error) {
    console.error('summarizeNetworkPattern failed, using fallback', error)
    return fallback
  }
}
