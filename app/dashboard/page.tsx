import { BUILD_VERSION } from '@/lib/build-version'

import DashboardClient from './dashboard-client'

// Server component on purpose: process.env.VERCEL_GIT_COMMIT_SHA is only
// readable server-side. A 'use client' component gets an undefined value
// for it at build time, so BUILD_VERSION would always fall back to
// DEV_BUILD_LABEL there -- permanently mismatching /api/version's real
// commit and leaving the update banner stuck "on" forever in production.
export default function DashboardPage() {
  return <DashboardClient buildVersion={BUILD_VERSION} />
}
