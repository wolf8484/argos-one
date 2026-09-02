import { ApiError } from '@/lib/server/http'

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

/**
 * Fixed-window limiter for the unauthenticated invite endpoints, which are the
 * only places a stranger can probe the database without a session.
 *
 * Deliberately in-memory: state lives per serverless instance, so a determined
 * attacker spread across instances gets more attempts than the nominal limit.
 * It is sized to stop casual code-guessing rather than to be a hard guarantee
 * -- the real defence is the 6-character keyspace (~1.07 billion) against a
 * 48-hour window. Move to a shared store if invites ever become high-value.
 */
export function enforceRateLimit(key: string, { limit = 10, windowMs = 60_000 } = {}) {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    if (buckets.size > 5000) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey)
      }
    }
    return
  }

  existing.count += 1
  if (existing.count > limit) {
    throw new ApiError('Too many attempts. Wait a minute and try again.', 429)
  }
}

/** Best-effort client address for keying the limiter behind Vercel's proxy. */
export function clientKey(request: Request, scope: string) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return `${scope}:${forwarded || request.headers.get('x-real-ip') || 'unknown'}`
}
