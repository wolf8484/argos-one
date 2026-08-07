import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { mockJobs } from '@/lib/mock-data'
import { CheckCircle2, Clock, Wrench } from 'lucide-react'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function JobsPage() {
  return (
    <div className="px-4 pt-10 pb-4 space-y-6">
      <div>
        <h1 className="text-display-md">All Jobs</h1>
        <p className="text-body-sm text-muted-foreground mt-1">{mockJobs.length} total</p>
      </div>

      <div className="space-y-3">
        {mockJobs.map((job) => (
          <Link
            key={job.id}
            href={`/dashboard/jobs/${job.id}`}
            className="block bg-card border rounded-none p-4 hover:bg-muted transition-colors"
            style={{ borderColor: 'var(--hairline-strong)' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-heading-sm">
                  {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {job.dtcCodes.map((c) => (
                    <span key={c} className="text-caption font-mono font-bold bg-muted px-2 py-0.5 rounded-[2px]">
                      {c}
                    </span>
                  ))}
                </div>
                <p className="text-body-sm text-muted-foreground mt-2 line-clamp-1">{job.symptoms}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Badge variant={job.status === 'resolved' ? 'success' : 'warning'}>
                  {job.status === 'resolved' ? (
                    <><CheckCircle2 size={10} className="mr-1" />Resolved</>
                  ) : (
                    <><Wrench size={10} className="mr-1" />Open</>
                  )}
                </Badge>
                <span className="flex items-center gap-1 text-caption text-muted-foreground">
                  <Clock size={10} />
                  {formatDate(job.createdAt)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
