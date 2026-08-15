import { NextRequest, NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'

// Speech-to-text via Groq's Whisper (OpenAI-compatible endpoint).
// The API key is server-side only — the browser records audio and posts it here.
export async function POST(req: NextRequest) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error

  const key = process.env.GROQ_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'Transcription is not configured' }, { status: 500 })
  }

  let file: FormDataEntryValue | null
  try {
    const form = await req.formData()
    file = form.get('file')
  } catch {
    return NextResponse.json({ error: 'Invalid upload' }, { status: 400 })
  }

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No audio provided' }, { status: 400 })
  }

  const groqForm = new FormData()
  groqForm.append('file', file, file.name || 'audio.webm')
  groqForm.append('model', 'whisper-large-v3-turbo')
  groqForm.append('response_format', 'json')
  groqForm.append('language', 'en')

  try {
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: groqForm,
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'Transcription failed' }, { status: 502 })
    }
    const data = (await res.json()) as { text?: string }
    return NextResponse.json({ text: (data.text ?? '').trim() })
  } catch {
    return NextResponse.json({ error: 'Transcription service unavailable' }, { status: 502 })
  }
}
