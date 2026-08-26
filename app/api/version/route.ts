import { NextResponse } from 'next/server'

import { BUILD_VERSION } from '@/lib/build-version'

// Always evaluated per-request (not cached at build) so a client polling this
// after a new deployment goes live gets that deployment's commit, not the one
// baked into whatever bundle happened to be built first.
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ version: BUILD_VERSION }, { headers: { 'Cache-Control': 'no-store' } })
}
