'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'

import { cn } from '@/lib/utils'

// Minimal typings for the Web Speech API (not in the standard TS DOM lib).
interface SpeechResultAlternative {
  transcript: string
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<SpeechResultAlternative>>
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export function VoiceInput({
  onTranscript,
  className,
}: {
  onTranscript: (text: string) => void
  className?: string
}) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recRef = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => {
    setSupported(Boolean(getCtor()))
    return () => recRef.current?.stop()
  }, [])

  function toggle() {
    if (listening) {
      recRef.current?.stop()
      return
    }
    const Ctor = getCtor()
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang = 'en-AU'
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? '')
        .join(' ')
        .trim()
      if (text) onTranscript(text)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    setListening(true)
    rec.start()
  }

  // Hidden on browsers without speech recognition — the textarea still works.
  if (!supported) return null

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-button-sm transition-colors',
        listening
          ? 'border-transparent bg-destructive text-white'
          : 'border-[var(--hairline)] text-foreground hover:bg-muted',
        className
      )}
    >
      {listening ? (
        <>
          <Square size={13} /> Stop
        </>
      ) : (
        <>
          <Mic size={13} /> Dictate
        </>
      )}
    </button>
  )
}
