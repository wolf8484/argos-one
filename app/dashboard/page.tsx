import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { mockJobs } from '@/lib/mock-data'
import { ArrowRight, Clock, CheckCircle2, Wrench, Zap } from 'lucide-react'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function categoryColor(status: string) {
  return status === 'resolved'
    ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
    : 'text-amber-400 bg-amber-400/10 border-amber-400/20'
}

export default function DashboardPage() {
  const open = mockJobs.filter((j) => j.status === 'open')
  const resolved = mockJobs.filter((j) => j.status === 'resolved')
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="px-4 pt-10 pb-4 space-y-8">
      <div>
        <p className="text-muted-foreground text-sm">{today}</p>
        <h1 className="text-2xl font-bold mt-1">
          Good morning<span className="text-primary">.</span>
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-primary">{open.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Open jobs</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{resolved.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Resolved</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">1.8h</p>
          <p className="text-xs text-muted-foreground mt-1">Avg time</p>
        </div>
      </div>

      <Link
        href="/dashboard/jobs/new"
        className="flex items-center justify-between bg-primary text-primary-foreground rounded-xl p-5 font-semibold text-base shadow-lg shadow-primary/20 active:scale-95 transition-transform"
      >
        <div className="flex items-center gap-3">
          <Zap size={20} />
          <span>Start New Diagnostic</span>
        </div>
        <ArrowRight size={20} />
      </Link>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Jobs</h2>
        {mockJobs.map((job) => (
          <Link
            key={job.id}
            href={`/dashboard/jobs/${job.id}`}
            className="block bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold truncate">
                    {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
                  </p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${categoryColor(job.status)}`}
                  >
                    {job.status === 'resolved' ? (
                      <><CheckCircle2 size={10} className="mr-1" />Resolved</>
                    ) : (
                      <><Wrench size={10} className="mr-1" />Open</>
                    )}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1 truncate">{job.symptoms}</p>
                <div className="flex items-center gap-3 mt-2">
                  {job.dtcCodes.map((code) => (
                    <span key={code} className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-primary">
                      {code}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock size={10} />
                  <span>{formatDate(job.createdAt)}</span>
                </div>
                {job.vehicle.mileage && (
                  <p className="text-xs text-muted-foreground mt-1">
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
