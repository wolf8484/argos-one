import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { mockJobs } from '@/lib/mock-data'
import { ArrowRight, Clock, CheckCircle2, Wrench, Zap } from 'lucide-react'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function DashboardPage() {
  const open = mockJobs.filter((j) => j.status === 'open')
  const resolved = mockJobs.filter((j) => j.status === 'resolved')
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="px-5 pt-10 pb-4 space-y-8">
      <div>
        <p className="text-body-sm">{today}</p>
        <h1 className="text-display-md mt-1">Good morning.</h1>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[var(--surface-card)] rounded-lg p-4 text-center">
          <p className="text-display-sm">{open.length}</p>
          <p className="text-caption mt-1">Open jobs</p>
        </div>
        <div className="bg-[var(--surface-card)] rounded-lg p-4 text-center">
          <p className="text-display-sm text-success">{resolved.length}</p>
          <p className="text-caption mt-1">Resolved</p>
        </div>
        <div className="bg-[var(--surface-card)] rounded-lg p-4 text-center">
          <p className="text-display-sm">1.8h</p>
          <p className="text-caption mt-1">Avg time</p>
        </div>
      </div>

      <Link
        href="/dashboard/jobs/new"
        className="flex items-center justify-between bg-primary text-primary-foreground rounded-lg px-5 py-4 text-title-sm shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:bg-[var(--primary-active)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Zap size={18} />
          <span>Start New Diagnostic</span>
        </div>
        <ArrowRight size={18} />
      </Link>

      <div className="space-y-3">
        <h2 className="text-nav-link text-muted-foreground">Recent Jobs</h2>
        {mockJobs.map((job) => (
          <Link
            key={job.id}
            href={`/dashboard/jobs/${job.id}`}
            className="block bg-card border border-[var(--hairline)] rounded-lg p-4 hover:shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-shadow"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-title-sm truncate">
                    {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
                  </p>
                  <Badge variant={job.status === 'resolved' ? 'success' : 'warning'}>
                    {job.status === 'resolved' ? (
                      <><CheckCircle2 size={11} className="mr-1" />Resolved</>
                    ) : (
                      <><Wrench size={11} className="mr-1" />Open</>
                    )}
                  </Badge>
                </div>
                <p className="text-body-sm mt-1 truncate">{job.symptoms}</p>
                <div className="flex items-center gap-2 mt-2">
                  {job.dtcCodes.map((code) => (
                    <span key={code} className="text-code font-medium bg-[var(--surface-card)] px-2 py-0.5 rounded">
                      {code}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1 text-caption">
                  <Clock size={10} />
                  <span>{formatDate(job.createdAt)}</span>
                </div>
                {job.vehicle.mileage && (
                  <p className="text-caption mt-1">
                    {job.vehicle.mileage.toLocaleString()} mi
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
