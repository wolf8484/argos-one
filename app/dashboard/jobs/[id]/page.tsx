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
          className="p-2 rounded-[2px] border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          style={{ borderColor: 'var(--hairline-strong)' }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-heading-lg">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h1>
          <p className="text-caption text-muted-foreground">{formatDate(job.createdAt)}</p>
        </div>
        <Badge variant={job.status === 'resolved' ? 'success' : 'warning'} className="ml-auto">
          {job.status === 'resolved' ? (
            <><CheckCircle2 size={11} className="mr-1" />Resolved</>
          ) : (
            <><Wrench size={11} className="mr-1" />Open</>
          )}
        </Badge>
      </div>

      <div className="border rounded-none p-4 space-y-3" style={{ borderColor: 'var(--hairline-strong)' }}>
        <div className="flex items-center gap-2 text-body-sm font-semibold text-muted-foreground">
          <Car size={14} /> Vehicle
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-body-sm">
          <div><span className="text-muted-foreground">Make</span><p className="font-semibold">{vehicle.make}</p></div>
          <div><span className="text-muted-foreground">Model</span><p className="font-semibold">{vehicle.model}</p></div>
          <div><span className="text-muted-foreground">Year</span><p className="font-semibold">{vehicle.year}</p></div>
          {vehicle.mileage && <div><span className="text-muted-foreground">Mileage</span><p className="font-semibold">{vehicle.mileage.toLocaleString()} mi</p></div>}
          {vehicle.engine && <div><span className="text-muted-foreground">Engine</span><p className="font-semibold">{vehicle.engine}</p></div>}
          {vehicle.vin && <div className="col-span-2"><span className="text-muted-foreground">VIN</span><p className="font-mono text-caption mt-0.5">{vehicle.vin}</p></div>}
        </div>
      </div>

      <div className="border rounded-none p-4 space-y-3" style={{ borderColor: 'var(--hairline-strong)' }}>
        <p className="text-body-sm font-semibold text-muted-foreground">DTC Codes</p>
        <div className="flex flex-wrap gap-2">
          {job.dtcCodes.map((code) => (
            <span key={code} className="font-mono font-bold text-body-sm bg-muted px-3 py-1 rounded-[2px]">
              {code}
            </span>
          ))}
        </div>
        <p className="text-body-sm text-muted-foreground">{job.symptoms}</p>
        {job.customerComplaint && (
          <p className="text-body-sm text-muted-foreground bg-muted px-3 py-2">
            &ldquo;{job.customerComplaint}&rdquo;
          </p>
        )}
      </div>

      {job.confirmedSolution && (
        <div className="border rounded-none p-4 space-y-2" style={{ borderColor: 'var(--success)', backgroundColor: 'color-mix(in oklab, var(--success) 8%, transparent)' }}>
          <div className="flex items-center gap-2 text-success text-body-sm font-semibold">
            <CheckCircle2 size={16} /> Confirmed Fix
          </div>
          <p className="text-heading-sm">{job.confirmedSolution.title}</p>
          <div className="flex items-center gap-4 text-caption text-muted-foreground">
            <span className="flex items-center gap-1"><Wrench size={11} />{job.confirmedSolution.occurrences} repairs</span>
            <span className="flex items-center gap-1"><Clock size={11} />~{job.confirmedSolution.avgRepairTimeHours}h</span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-overline text-muted-foreground">
          All Solutions Considered ({solutions.length})
        </h2>
        {solutions.map((sol) => (
          <div key={sol.id} className="border rounded-none p-4 space-y-2" style={{ borderColor: 'var(--hairline-strong)' }}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-body-sm font-semibold">{sol.title}</p>
              <Badge
                variant={sol.successRate >= 70 ? 'success' : sol.successRate >= 40 ? 'warning' : 'error'}
                className="shrink-0 font-bold"
              >
                {sol.successRate}%
              </Badge>
            </div>
            {sol.parts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {sol.parts.map((p) => (
                  <span key={p} className="text-caption bg-muted text-muted-foreground px-2 py-0.5 rounded-[2px]">{p}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
