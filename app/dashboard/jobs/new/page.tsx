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
  const steps: Step[] = ['vehicle', 'problem', 'results']
  const labels = ['Vehicle', 'Problem', 'Results']
  const idx = steps.indexOf(current)

  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center flex-1">
          <div className={`flex items-center gap-2 ${i <= idx ? 'text-foreground' : 'text-muted-foreground'}`}>
            <div
              className={`w-6 h-6 rounded-[2px] flex items-center justify-center text-caption font-bold shrink-0 border ${
                i <= idx
                  ? 'bg-primary text-primary-foreground border-transparent'
                  : 'bg-transparent text-muted-foreground'
              }`}
              style={i > idx ? { borderColor: 'var(--hairline-strong)' } : undefined}
            >
              {i < idx ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <span className="text-button-sm hidden sm:block">{labels[i]}</span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="flex-1 h-px mx-2"
              style={{ backgroundColor: i < idx ? 'var(--foreground)' : 'var(--hairline)' }}
            />
          )}
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
  const [manualMode, setManualMode] = useState(false)

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
      setVehicle({
        vin,
        make: data.make,
        model: data.model,
        year: parseInt(data.year),
        engine: data.engine,
        trim: data.trim,
        bodyStyle: data.bodyStyle,
      })
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

  const vehicleReady = (vehicle.make && vehicle.model && vehicle.year) || manualMode

  return (
    <div className="px-4 pt-8 pb-4">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => (step === 'vehicle' ? router.back() : setStep(step === 'results' ? 'problem' : 'vehicle'))}
          className="p-2 rounded-[2px] border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          style={{ borderColor: 'var(--hairline-strong)' }}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-heading-lg">New Diagnostic</h1>
      </div>

      <StepBar current={step} />

      {step === 'vehicle' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-heading-md mb-1">Identify the vehicle</h2>
            <p className="text-body-sm text-muted-foreground">Enter the VIN or fill in manually</p>
          </div>

          <div className="space-y-3">
            <label className="text-body-sm font-semibold text-muted-foreground">VIN Number</label>
            <div className="flex gap-2 items-end">
              <Input
                value={vin}
                onChange={(e) => {
                  setVin(e.target.value.toUpperCase())
                  setVinError('')
                  if (vehicle.make) setVehicle({})
                }}
                placeholder="17-character VIN"
                maxLength={17}
                className="font-mono tracking-wider"
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
            <p className="text-caption text-muted-foreground">
              {vin.length}/17 characters
            </p>
          </div>

          {vehicle.make && (
            <div className="border rounded-none p-4 space-y-2" style={{ borderColor: 'var(--hairline-strong)' }}>
              <div className="flex items-center gap-2 text-foreground text-body-sm font-semibold">
                <CheckCircle2 size={16} />
                VIN decoded successfully
              </div>
              <p className="text-heading-md">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </p>
              <div className="flex flex-wrap gap-2 text-caption text-muted-foreground">
                {vehicle.engine && <span className="bg-muted px-2 py-1 rounded-[2px]">{vehicle.engine}</span>}
                {vehicle.trim && <span className="bg-muted px-2 py-1 rounded-[2px]">{vehicle.trim}</span>}
                {vehicle.bodyStyle && <span className="bg-muted px-2 py-1 rounded-[2px]">{vehicle.bodyStyle}</span>}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label className="text-body-sm font-semibold text-muted-foreground">Current Mileage</label>
            <Input
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="e.g. 84500"
              type="number"
            />
          </div>

          {!vehicle.make && (
            <button
              onClick={() => setManualMode(!manualMode)}
              className="text-body-sm font-semibold underline underline-offset-4"
            >
              {manualMode ? 'Hide manual entry' : 'Enter manually instead'}
            </button>
          )}

          {manualMode && !vehicle.make && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-body-sm font-semibold text-muted-foreground">Year</label>
                <Input
                  placeholder="2020"
                  onChange={(e) => setVehicle((v) => ({ ...v, year: parseInt(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-body-sm font-semibold text-muted-foreground">Make</label>
                <Input
                  placeholder="Toyota"
                  onChange={(e) => setVehicle((v) => ({ ...v, make: e.target.value }))}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-body-sm font-semibold text-muted-foreground">Model</label>
                <Input
                  placeholder="Camry"
                  onChange={(e) => setVehicle((v) => ({ ...v, model: e.target.value }))}
                />
              </div>
            </div>
          )}

          <Button
            variant="primary"
            className="w-full"
            disabled={!vehicleReady}
            onClick={() => setStep('problem')}
          >
            Continue <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
      )}

      {step === 'problem' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-heading-md mb-1">What&apos;s the problem?</h2>
            <p className="text-body-sm text-muted-foreground">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-body-sm font-semibold text-muted-foreground">DTC Codes</label>
            <div className="flex gap-2">
              <Input
                value={dtcInput}
                onChange={(e) => setDtcInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && addDtc()}
                placeholder="e.g. P0420"
                className="font-mono"
              />
              <Button variant="outline" size="icon" onClick={addDtc} className="shrink-0">
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

          <div className="space-y-3">
            <label className="text-body-sm font-semibold text-muted-foreground">Symptoms observed</label>
            <Textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="Describe what you see, hear, or feel…"
              className="resize-none min-h-[100px]"
            />
          </div>

          <div className="space-y-3">
            <label className="text-body-sm font-semibold text-muted-foreground">Customer complaint (optional)</label>
            <Textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="In their own words…"
              className="resize-none min-h-[80px]"
            />
          </div>

          <Button
            variant="primary"
            className="w-full"
            disabled={dtcCodes.length === 0 && !symptoms.trim()}
            onClick={goToResults}
          >
            Find Solutions <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
      )}

      {step === 'results' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-heading-md mb-1">Repair Intelligence</h2>
            <div className="flex flex-wrap items-center gap-2 text-body-sm text-muted-foreground">
              <span>{vehicle.year} {vehicle.make} {vehicle.model}</span>
              <span>·</span>
              {dtcCodes.map((c) => (
                <span key={c} className="font-mono font-bold text-foreground">{c}</span>
              ))}
            </div>
          </div>

          {solutions.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <AlertCircle size={40} className="mx-auto text-muted-foreground" />
              <p className="text-heading-sm">No previous repairs found</p>
              <p className="text-body-sm text-muted-foreground">
                Be the first to log a fix for this code — it helps the whole team.
              </p>
              <Button variant="outline" className="mt-4">
                <Plus size={16} className="mr-2" /> Log a New Fix
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-caption text-muted-foreground">
                {solutions.length} solutions found · ranked by success rate
              </p>
              {solutions.map((sol, i) => (
                <div
                  key={sol.id}
                  className="border rounded-none p-4 space-y-3 transition-colors"
                  style={{
                    borderColor: confirmedId === sol.id ? 'var(--success)' : 'var(--hairline-strong)',
                    backgroundColor: confirmedId === sol.id ? 'color-mix(in oklab, var(--success) 8%, transparent)' : undefined,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {i === 0 && <Badge variant="new">Top Match</Badge>}
                        <span className="text-base">{categoryIcon(sol.category)}</span>
                      </div>
                      <p className="text-heading-sm leading-snug">{sol.title}</p>
                    </div>
                    <Badge variant={rateBadgeVariant(sol.successRate)} className="shrink-0 font-bold">
                      {sol.successRate}%
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-caption text-muted-foreground">
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
                        <span key={p} className="text-caption bg-muted text-muted-foreground px-2 py-0.5 rounded-[2px]">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}

                  {sol.notes && (
                    <p className="text-body-sm text-muted-foreground bg-muted px-3 py-2 leading-relaxed">
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
                      variant="outline"
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
                <button
                  className="w-full flex items-center justify-center gap-2 text-body-sm font-semibold text-muted-foreground py-4 border border-dashed hover:text-foreground transition-colors"
                  style={{ borderColor: 'var(--hairline-strong)' }}
                >
                  <Plus size={16} /> None worked — log a new fix
                </button>
              )}
            </div>
          )}

          {confirmedId && (
            <Button variant="primary" className="w-full" onClick={() => router.push('/dashboard')}>
              Done <ChevronRight size={16} className="ml-2" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
