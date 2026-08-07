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
        <h1 className="text-2xl font-bold">All Jobs</h1>
        <p className="text-sm text-muted-foreground mt-1">{mockJobs.length} total</p>
      </div>

      <div className="space-y-3">
        {mockJobs.map((job) => (
          <Link
            key={job.id}
            href={`/dashboard/jobs/${job.id}`}
            className="block bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold">
                  {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {job.dtcCodes.map((c) => (
                    <span key={c} className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {c}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-1">{job.symptoms}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    job.status === 'resolved'
                      ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                      : 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                  }`}
                >
                  {job.status === 'resolved' ? (
                    <><CheckCircle2 size={10} className="mr-1" />Resolved</>
                  ) : (
                    <><Wrench size={10} className="mr-1" />Open</>
                  )}
                </Badge>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
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
