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
  // Errors raised by our own security-definer functions (create_branch,
  // set_session_branch, add_technician_to_branch) arrive as PostgrestError
  // with the SQLSTATE we chose. Their messages are authored here, not by a
  // caller, so they are safe to return verbatim -- and far more useful than
  // a blanket 500 for what is really a permission or validation failure.
  const RAISED_STATUS: Record<string, number> = { '42501': 403, P0002: 404, '22023': 400 }
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const status = RAISED_STATUS[String((error as { code: unknown }).code)]
    if (status) {
      return NextResponse.json({ error: String((error as { message: unknown }).message) }, { status })
    }
  }

  console.error(fallback, error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}
