import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export function apiError(error: unknown, fallback = 'Request failed') {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: 'Invalid request', issues: error.issues }, { status: 400 })
  }
  console.error(fallback, error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}
