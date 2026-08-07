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
    <div className="px-4 pt-10 pb-4 space-y-8">
      <div>
        <p className="text-body-sm text-muted-foreground">{today}</p>
        <h1 className="text-display-md mt-1">
          Good morning<span className="text-primary">.</span>
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-0 border border-[var(--hairline-strong)]">
        <div className="p-4 text-center border-r" style={{ borderColor: 'var(--hairline-strong)' }}>
          <p className="text-heading-lg">{open.length}</p>
          <p className="text-caption text-muted-foreground mt-1">Open jobs</p>
        </div>
        <div className="p-4 text-center border-r" style={{ borderColor: 'var(--hairline-strong)' }}>
          <p className="text-heading-lg text-success">{resolved.length}</p>
          <p className="text-caption text-muted-foreground mt-1">Resolved</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-heading-lg">1.8h</p>
          <p className="text-caption text-muted-foreground mt-1">Avg time</p>
        </div>
      </div>

      <Link
        href="/dashboard/jobs/new"
        className="flex items-center justify-between bg-primary text-primary-foreground rounded-[2px] p-5 text-button-lg active:opacity-85 transition-opacity"
      >
        <div className="flex items-center gap-3">
          <Zap size={20} />
          <span>Start New Diagnostic</span>
        </div>
        <ArrowRight size={20} />
      </Link>

      <div className="space-y-3">
        <h2 className="text-overline text-muted-foreground">Recent Jobs</h2>
        {mockJobs.map((job) => (
          <Link
            key={job.id}
            href={`/dashboard/jobs/${job.id}`}
            className="block bg-card border rounded-none p-4 hover:bg-muted transition-colors"
            style={{ borderColor: 'var(--hairline-strong)' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-heading-sm truncate">
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
                <p className="text-body-sm text-muted-foreground mt-1 truncate">{job.symptoms}</p>
                <div className="flex items-center gap-2 mt-2">
                  {job.dtcCodes.map((code) => (
                    <span key={code} className="text-caption font-mono font-bold bg-muted px-2 py-0.5 rounded-[2px]">
                      {code}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1 text-caption text-muted-foreground">
                  <Clock size={10} />
                  <span>{formatDate(job.createdAt)}</span>
                </div>
                {job.vehicle.mileage && (
                  <p className="text-caption text-muted-foreground mt-1">
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
