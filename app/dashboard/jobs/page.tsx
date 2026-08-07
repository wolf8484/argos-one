import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { mockJobs } from '@/lib/mock-data'
import { CheckCircle2, Clock, Wrench } from 'lucide-react'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function JobsPage() {
  return (
    <div className="px-5 pt-10 pb-4 space-y-6">
      <div>
        <h1 className="text-display-sm">All Jobs</h1>
        <p className="text-body-sm mt-1">{mockJobs.length} total</p>
      </div>

      <div className="space-y-3">
        {mockJobs.map((job) => (
          <Link
            key={job.id}
            href={`/dashboard/jobs/${job.id}`}
            className="block bg-card border border-[var(--hairline)] rounded-lg p-4 hover:shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-shadow"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-title-sm">
                  {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {job.dtcCodes.map((c) => (
                    <span key={c} className="text-code font-medium bg-[var(--surface-card)] px-2 py-0.5 rounded-md">
                      {c}
                    </span>
                  ))}
                </div>
                <p className="text-body-sm mt-2 line-clamp-1">{job.symptoms}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Badge variant={job.status === 'resolved' ? 'success' : 'warning'}>
                  {job.status === 'resolved' ? (
                    <><CheckCircle2 size={10} className="mr-1" />Resolved</>
                  ) : (
                    <><Wrench size={10} className="mr-1" />Open</>
                  )}
                </Badge>
                <span className="flex items-center gap-1 text-caption">
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
