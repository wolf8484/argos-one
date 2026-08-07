import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { mockJobs } from '@/lib/mock-data'
import { ArrowLeft, CheckCircle2, Clock, Wrench, Car } from 'lucide-react'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = mockJobs.find((j) => j.id === id)
  if (!job) notFound()

  const { vehicle, solutions } = job

  return (
    <div className="px-4 pt-8 pb-4 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h1>
          <p className="text-xs text-muted-foreground">{formatDate(job.createdAt)}</p>
        </div>
        <Badge
          variant="outline"
          className={`ml-auto text-xs ${
            job.status === 'resolved'
              ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
              : 'text-amber-400 bg-amber-400/10 border-amber-400/20'
          }`}
        >
          {job.status === 'resolved' ? (
            <><CheckCircle2 size={11} className="mr-1" />Resolved</>
          ) : (
            <><Wrench size={11} className="mr-1" />Open</>
          )}
        </Badge>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Car size={14} /> Vehicle
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div><span className="text-muted-foreground">Make</span><p className="font-medium">{vehicle.make}</p></div>
          <div><span className="text-muted-foreground">Model</span><p className="font-medium">{vehicle.model}</p></div>
          <div><span className="text-muted-foreground">Year</span><p className="font-medium">{vehicle.year}</p></div>
          {vehicle.mileage && <div><span className="text-muted-foreground">Mileage</span><p className="font-medium">{vehicle.mileage.toLocaleString()} mi</p></div>}
          {vehicle.engine && <div><span className="text-muted-foreground">Engine</span><p className="font-medium">{vehicle.engine}</p></div>}
          {vehicle.vin && <div className="col-span-2"><span className="text-muted-foreground">VIN</span><p className="font-mono text-xs mt-0.5">{vehicle.vin}</p></div>}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">DTC Codes</p>
        <div className="flex flex-wrap gap-2">
          {job.dtcCodes.map((code) => (
            <span key={code} className="font-mono text-sm bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-lg">
              {code}
            </span>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{job.symptoms}</p>
        {job.customerComplaint && (
          <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
            &ldquo;{job.customerComplaint}&rdquo;
          </p>
        )}
      </div>

      {job.confirmedSolution && (
        <div className="bg-emerald-400/5 border border-emerald-400/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
            <CheckCircle2 size={16} /> Confirmed Fix
          </div>
          <p className="font-medium">{job.confirmedSolution.title}</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Wrench size={11} />{job.confirmedSolution.occurrences} repairs</span>
            <span className="flex items-center gap-1"><Clock size={11} />~{job.confirmedSolution.avgRepairTimeHours}h</span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          All Solutions Considered ({solutions.length})
        </h2>
        {solutions.map((sol) => (
          <div key={sol.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-sm">{sol.title}</p>
              <Badge variant="outline" className={`shrink-0 font-bold ${
                sol.successRate >= 70
                  ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                  : sol.successRate >= 40
                  ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                  : 'text-red-400 bg-red-400/10 border-red-400/20'
              }`}>
                {sol.successRate}%
              </Badge>
            </div>
            {sol.parts.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {sol.parts.map((p) => (
                  <span key={p} className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded">{p}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
