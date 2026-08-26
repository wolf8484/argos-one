import { NextResponse } from 'next/server'

// Always evaluated per-request (not cached at build) so a client polling this
// after a new deployment goes live gets that deployment's commit, not the one
// baked into whatever bundle happened to be built first.
export const dynamic = 'force-dynamic'

export async function GET() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_BUILD_VERSION || 'dev-local'
  return NextResponse.json({ version }, { headers: { 'Cache-Control': 'no-store' } })
}
