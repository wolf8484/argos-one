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

// iOS forces every browser onto WebKit, where webkitSpeechRecognition is
// present but non-functional. Detect iOS and steer users to the native
// keyboard mic instead of showing a button that silently fails.
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

type Mode = 'none' | 'button' | 'ios-hint'

export function VoiceInput({
  onTranscript,
  className,
}: {
  onTranscript: (text: string) => void
  className?: string
}) {
  const [mode, setMode] = useState<Mode>('none')
  const [listening, setListening] = useState(false)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isIOS()) setMode('ios-hint')
    else if (getCtor()) setMode('button')

    return () => {
      recRef.current?.stop()
      if (watchdogRef.current) clearTimeout(watchdogRef.current)
    }
  }, [])

  function reset() {
    setListening(false)
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current)
      watchdogRef.current = null
    }
  }

  function toggle() {
    if (listening) {
      recRef.current?.stop()
      reset()
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
    rec.onend = () => reset()
    rec.onerror = () => reset()
    recRef.current = rec

    setListening(true)
    try {
      rec.start()
    } catch {
      // start() throws if mic is busy or blocked — never leave the UI stuck.
      reset()
      return
    }
    // Watchdog: force-stop if nothing fires within 12s, so it can't freeze.
    watchdogRef.current = setTimeout(() => {
      try {
        rec.stop()
      } catch {
        /* already stopped */
      }
      reset()
    }, 12000)
  }

  if (mode === 'none') return null

  if (mode === 'ios-hint') {
    // iPhone/iPad: the on-screen keyboard's mic is the reliable dictation path.
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-caption text-muted-foreground', className)}>
        <Mic size={13} /> Use the keyboard mic
      </span>
    )
  }

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
