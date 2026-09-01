import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

// For rejections the caller should see verbatim (e.g. "you can't remove the
// last Admin") rather than the generic fallback message apiError otherwise
// returns for anything it doesn't recognise.
export class ApiError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export function apiError(error: unknown, fallback = 'Request failed') {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: 'Invalid request', issues: error.issues }, { status: 400 })
  }
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error(fallback, error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}
