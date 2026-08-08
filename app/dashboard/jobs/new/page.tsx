'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getSolutionsForCodes } from '@/lib/mock-data'
import { Solution, Vehicle } from '@/types'
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  X,
  Plus,
  CheckCircle2,
  Clock,
  Wrench,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'

type Step = 'vehicle' | 'problem' | 'results'

function StepBar({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'vehicle', label: 'Vehicle' },
    { key: 'problem', label: 'Problem' },
    { key: 'results', label: 'Results' },
  ]
  const idx = steps.findIndex((s) => s.key === current)

  return (
    <div className="inline-flex items-center gap-1 bg-[var(--surface-soft)] rounded-full p-1.5 mb-8">
      {steps.map((s, i) => (
        <div
          key={s.key}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-nav-link transition-colors ${
            i === idx
              ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
              : i < idx
              ? 'text-foreground'
              : 'text-muted-foreground'
          }`}
        >
          {i < idx ? <CheckCircle2 size={13} /> : <span className="text-caption font-semibold">{i + 1}</span>}
          {s.label}
        </div>
      ))}
    </div>
  )
}

function categoryIcon(cat: Solution['category']) {
  const icons: Record<Solution['category'], string> = {
    electrical: '⚡',
    mechanical: '🔧',
    emissions: '💨',
    fuel: '⛽',
    cooling: '❄️',
    transmission: '⚙️',
    brakes: '🛑',
    other: '🔩',
  }
  return icons[cat]
}

function rateBadgeVariant(rate: number): 'success' | 'warning' | 'error' {
  if (rate >= 70) return 'success'
  if (rate >= 40) return 'warning'
  return 'error'
}

export default function NewJobPage() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('vehicle')

  // Vehicle step
  const [vin, setVin] = useState('')
  const [vinLoading, setVinLoading] = useState(false)
  const [vinError, setVinError] = useState('')
  const [vehicle, setVehicle] = useState<Partial<Vehicle>>({})
  const [mileage, setMileage] = useState('')
  const [vinApplied, setVinApplied] = useState(false)
  const [vinPartial, setVinPartial] = useState(false)

  // Problem step
  const [dtcInput, setDtcInput] = useState('')
  const [dtcCodes, setDtcCodes] = useState<string[]>([])
  const [symptoms, setSymptoms] = useState('')
  const [complaint, setComplaint] = useState('')

  // Results step
  const [solutions, setSolutions] = useState<Solution[]>([])
  const [confirmedId, setConfirmedId] = useState<string | null>(null)

  async function decodeVin() {
    if (vin.length !== 17) {
      setVinError('VIN must be exactly 17 characters')
      return
    }
    setVinLoading(true)
    setVinError('')
    try {
      const res = await fetch(`/api/vin?vin=${vin}`)
      const data = await res.json()
      if (!res.ok || data.error) {
        setVinError(data.error || 'Could not decode VIN')
        return
      }
      // VIN is an assist: fill the manual fields with whatever decoded, so the
      // mechanic can complete or correct anything (e.g. Model on EU/import VINs).
      setVehicle((v) => ({
        ...v,
        vin,
        make: data.make,
        model: data.model || '',
        year: parseInt(data.year),
        engine: data.engine,
        trim: data.trim,
        bodyStyle: data.bodyStyle,
      }))
      setVinApplied(true)
      setVinPartial(Boolean(data.partial))
    } catch {
      setVinError('VIN lookup failed — check your connection')
    } finally {
      setVinLoading(false)
    }
  }

  function addDtc() {
    const code = dtcInput.trim().toUpperCase()
    if (!code) return
    if (dtcCodes.includes(code)) {
      setDtcInput('')
      return
    }
    setDtcCodes([...dtcCodes, code])
    setDtcInput('')
  }

  function goToResults() {
    const found = getSolutionsForCodes(dtcCodes)
    setSolutions(found)
    setStep('results')
  }

  const vehicleReady = Boolean(vehicle.make && vehicle.model && vehicle.year)

  return (
    <div className="px-5 pt-8 pb-4">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => (step === 'vehicle' ? router.back() : setStep(step === 'results' ? 'problem' : 'vehicle'))}
          className="flex items-center justify-center size-9 rounded-full border border-[var(--hairline)] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-title-lg">New Diagnostic</h1>
      </div>

      <StepBar current={step} />

      {step === 'vehicle' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-title-md mb-1">Identify the vehicle</h2>
            <p className="text-body-sm">Enter Year, Make &amp; Model — or scan a VIN to auto-fill.</p>
          </div>

          {/* VIN assist */}
          <div className="bg-[var(--surface-card)] rounded-lg p-4 space-y-2">
            <label className="text-caption font-semibold">SCAN OR ENTER VIN (OPTIONAL)</label>
            <div className="flex gap-2">
              <Input
                value={vin}
                onChange={(e) => {
                  setVin(e.target.value.toUpperCase())
                  setVinError('')
                }}
                placeholder="17-character VIN"
                maxLength={17}
                className="font-mono tracking-wider bg-card"
              />
              <Button
                variant="secondary"
                onClick={decodeVin}
                disabled={vin.length !== 17 || vinLoading}
                className="shrink-0"
              >
                {vinLoading ? <Loader2 size={16} className="animate-spin" /> : 'Decode'}
              </Button>
            </div>
            {vinError && (
              <p className="text-body-sm text-destructive flex items-center gap-1">
                <AlertCircle size={14} /> {vinError}
              </p>
            )}
            {vinApplied && !vinPartial && (
              <p className="text-body-sm text-success flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Auto-filled from VIN — check the details below.
              </p>
            )}
            {vinApplied && vinPartial && (
              <div className="flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2">
                <AlertCircle size={15} className="text-warning shrink-0 mt-0.5" />
                <p className="text-body-sm text-foreground">
                  <span className="font-semibold">Partial decode.</span> This VIN only
                  returned Make &amp; Year — common for imported or European vehicles.
                  Please enter the <span className="font-semibold">Model</span> below.
                </p>
              </div>
            )}
            {!vinApplied && !vinError && <p className="text-caption">{vin.length}/17 characters</p>}
          </div>

          {/* Manual-primary fields (VIN fills these in) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-caption font-semibold">YEAR</label>
              <Input
                type="number"
                placeholder="2020"
                value={vehicle.year ?? ''}
                onChange={(e) => setVehicle((v) => ({ ...v, year: e.target.value ? parseInt(e.target.value) : undefined }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-caption font-semibold">MAKE</label>
              <Input
                placeholder="Toyota"
                value={vehicle.make ?? ''}
                onChange={(e) => setVehicle((v) => ({ ...v, make: e.target.value }))}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-caption font-semibold flex items-center gap-1.5">
                MODEL
                {vinApplied && vinPartial && !vehicle.model && (
                  <span className="text-warning font-semibold normal-case tracking-normal">· needs input</span>
                )}
              </label>
              <Input
                placeholder="Camry"
                value={vehicle.model ?? ''}
                onChange={(e) => setVehicle((v) => ({ ...v, model: e.target.value }))}
                aria-invalid={vinApplied && vinPartial && !vehicle.model}
              />
            </div>
          </div>

          {/* Extra decoded details, when present */}
          {(vehicle.engine || vehicle.trim || vehicle.bodyStyle) && (
            <div className="flex flex-wrap gap-2 text-caption">
              {vehicle.engine && <span className="bg-[var(--surface-card)] px-2.5 py-1 rounded-md">{vehicle.engine}</span>}
              {vehicle.trim && <span className="bg-[var(--surface-card)] px-2.5 py-1 rounded-md">{vehicle.trim}</span>}
              {vehicle.bodyStyle && <span className="bg-[var(--surface-card)] px-2.5 py-1 rounded-md">{vehicle.bodyStyle}</span>}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-caption font-semibold">CURRENT MILEAGE</label>
            <Input
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="e.g. 84500"
              type="number"
            />
          </div>

          <Button variant="primary" size="lg" className="w-full" disabled={!vehicleReady} onClick={() => setStep('problem')}>
            Continue <ArrowRight size={16} className="ml-1" />
          </Button>
        </div>
      )}

      {step === 'problem' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-title-md mb-1">What&apos;s the problem?</h2>
            <p className="text-body-sm">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-caption font-semibold">DTC CODES</label>
            <div className="flex gap-2">
              <Input
                value={dtcInput}
                onChange={(e) => setDtcInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && addDtc()}
                placeholder="e.g. P0420"
                className="font-mono"
              />
              <Button variant="secondary" size="icon" onClick={addDtc} className="shrink-0 rounded-md">
                <Plus size={16} />
              </Button>
            </div>
            {dtcCodes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {dtcCodes.map((code) => (
                  <Badge key={code} variant="outline" className="font-mono gap-1.5">
                    {code}
                    <button onClick={() => setDtcCodes(dtcCodes.filter((c) => c !== code))}>
                      <X size={12} />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-caption font-semibold">SYMPTOMS OBSERVED</label>
            <Textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="Describe what you see, hear, or feel…"
              className="resize-none min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-caption font-semibold">CUSTOMER COMPLAINT (OPTIONAL)</label>
            <Textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="In their own words…"
              className="resize-none min-h-[80px]"
            />
          </div>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={dtcCodes.length === 0 && !symptoms.trim()}
            onClick={goToResults}
          >
            Find Solutions <ArrowRight size={16} className="ml-1" />
          </Button>
        </div>
      )}

      {step === 'results' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-title-md mb-1">Repair Intelligence</h2>
            <div className="flex flex-wrap items-center gap-2 text-body-sm">
              <span>{vehicle.year} {vehicle.make} {vehicle.model}</span>
              <span>·</span>
              {dtcCodes.map((c) => (
                <span key={c} className="font-mono font-semibold text-foreground">{c}</span>
              ))}
            </div>
          </div>

          {solutions.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <AlertCircle size={40} className="mx-auto text-muted-foreground" />
              <p className="text-title-sm">No previous repairs found</p>
              <p className="text-body-sm">Be the first to log a fix for this code — it helps the whole team.</p>
              <Button variant="secondary" className="mt-4">
                <Plus size={16} className="mr-2" /> Log a New Fix
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-caption">{solutions.length} solutions found · ranked by success rate</p>
              {solutions.map((sol, i) => (
                <div
                  key={sol.id}
                  className="bg-card border rounded-lg p-4 space-y-3 transition-colors"
                  style={{
                    borderColor: confirmedId === sol.id ? 'var(--success)' : 'var(--hairline)',
                    backgroundColor: confirmedId === sol.id ? 'color-mix(in oklab, var(--success) 6%, var(--card))' : undefined,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {i === 0 && <Badge variant="info">Top Match</Badge>}
                        <span className="text-base">{categoryIcon(sol.category)}</span>
                      </div>
                      <p className="text-title-sm leading-snug">{sol.title}</p>
                    </div>
                    <Badge variant={rateBadgeVariant(sol.successRate)} className="shrink-0 font-semibold">
                      {sol.successRate}%
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-caption">
                    <span className="flex items-center gap-1">
                      <Wrench size={11} /> {sol.occurrences} repairs
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> ~{sol.avgRepairTimeHours}h
                    </span>
                  </div>

                  {sol.parts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {sol.parts.map((p) => (
                        <span key={p} className="text-caption bg-[var(--surface-card)] px-2 py-0.5 rounded-md">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}

                  {sol.notes && (
                    <p className="text-body-sm bg-[var(--surface-card)] rounded-md px-3 py-2 leading-relaxed">
                      {sol.notes}
                    </p>
                  )}

                  {confirmedId === sol.id ? (
                    <div className="flex items-center gap-2 text-success text-body-sm font-semibold">
                      <CheckCircle2 size={16} /> Marked as fixed — great work!
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => setConfirmedId(sol.id)}
                      disabled={confirmedId !== null}
                    >
                      <CheckCircle2 size={14} className="mr-2" /> This fixed it
                    </Button>
                  )}
                </div>
              ))}

              {!confirmedId && (
                <button className="w-full flex items-center justify-center gap-2 text-body-sm font-semibold text-muted-foreground py-4 border border-dashed border-[var(--hairline)] rounded-lg hover:text-foreground transition-colors">
                  <Plus size={16} /> None worked — log a new fix
                </button>
              )}
            </div>
          )}

          {confirmedId && (
            <Button variant="primary" size="lg" className="w-full" onClick={() => router.push('/dashboard')}>
              Done <ChevronRight size={16} className="ml-1" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
