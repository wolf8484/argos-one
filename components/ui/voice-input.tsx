'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic, Square } from 'lucide-react'

import { cn } from '@/lib/utils'

type Status = 'idle' | 'recording' | 'transcribing' | 'error'

const MAX_SECONDS = 60

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  // webm on Chrome/Android/desktop, mp4 on iOS Safari/Chrome.
  const types = ['audio/webm', 'audio/mp4', 'audio/ogg']
  return types.find((t) => MediaRecorder.isTypeSupported?.(t))
}

function extFor(mime: string): string {
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

export function VoiceInput({
  onTranscript,
  className,
}: {
  onTranscript: (text: string) => void
  className?: string
}) {
  const [supported] = useState(() =>
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  )
  const [status, setStatus] = useState<Status>('idle')
  const [seconds, setSeconds] = useState(0)

  const recRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => cleanup()
  }, [])

  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        cleanup()
        const type = rec.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        void transcribe(blob, type)
      }
      recRef.current = rec
      rec.start()
      setSeconds(0)
      setStatus('recording')
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
      maxTimerRef.current = setTimeout(() => stop(), MAX_SECONDS * 1000)
    } catch {
      // Permission denied or no mic.
      cleanup()
      setStatus('error')
      setTimeout(() => setStatus('idle'), 4000)
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current)
    setStatus('transcribing')
    try {
      recRef.current?.stop()
    } catch {
      /* already stopped */
    }
  }

  async function transcribe(blob: Blob, type: string) {
    if (blob.size === 0) {
      setStatus('idle')
      return
    }
    setStatus('transcribing')
    try {
      const fd = new FormData()
      fd.append('file', blob, `clip.${extFor(type)}`)
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
      const data = (await res.json()) as { text?: string; error?: string }
      if (res.ok && data.text) onTranscript(data.text)
      setStatus(res.ok ? 'idle' : 'error')
      if (!res.ok) setTimeout(() => setStatus('idle'), 4000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 4000)
    }
  }

  function onClick() {
    if (status === 'recording') stop()
    else if (status === 'idle' || status === 'error') void start()
  }

  if (!supported) return null

  const base =
    'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-button-sm transition-colors disabled:opacity-70'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={status === 'transcribing'}
      aria-pressed={status === 'recording'}
      className={cn(
        base,
        status === 'recording'
          ? 'border-transparent bg-destructive text-white'
          : status === 'error'
          ? 'border-destructive text-destructive'
          : 'border-[var(--hairline)] text-foreground hover:bg-muted',
        className
      )}
    >
      {status === 'recording' ? (
        <>
          <Square size={13} /> Stop · {seconds}s
        </>
      ) : status === 'transcribing' ? (
        <>
          <Loader2 size={13} className="animate-spin" /> Transcribing…
        </>
      ) : status === 'error' ? (
        <>
          <Mic size={13} /> Try again
        </>
      ) : (
        <>
          <Mic size={13} /> Dictate
        </>
      )}
    </button>
  )
}
