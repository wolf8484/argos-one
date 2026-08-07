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
          <div className={`flex items-center gap-2 ${i <= idx ? 'text-primary' : 'text-muted-foreground'}`}>
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                i < idx
                  ? 'bg-primary text-primary-foreground'
                  : i === idx
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < idx ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <span className="text-sm font-medium hidden sm:block">{labels[i]}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-px mx-2 ${i < idx ? 'bg-primary' : 'bg-border'}`} />
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

function categoryColor(rate: number) {
  if (rate >= 70) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
  if (rate >= 40) return 'text-amber-400 bg-amber-400/10 border-amber-400/20'
  return 'text-red-400 bg-red-400/10 border-red-400/20'
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
          className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold">New Diagnostic</h1>
      </div>

      <StepBar current={step} />

      {step === 'vehicle' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-1">Identify the vehicle</h2>
            <p className="text-sm text-muted-foreground">Enter the VIN or fill in manually</p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">VIN Number</label>
            <div className="flex gap-2">
              <Input
                value={vin}
                onChange={(e) => {
                  setVin(e.target.value.toUpperCase())
                  setVinError('')
                  if (vehicle.make) setVehicle({})
                }}
                placeholder="17-character VIN"
                maxLength={17}
                className="font-mono tracking-wider bg-card border-border"
              />
              <Button
                onClick={decodeVin}
                disabled={vin.length !== 17 || vinLoading}
                className="shrink-0"
              >
                {vinLoading ? <Loader2 size={16} className="animate-spin" /> : 'Decode'}
              </Button>
            </div>
            {vinError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle size={14} /> {vinError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {vin.length}/17 characters
            </p>
          </div>

          {vehicle.make && (
            <div className="bg-card border border-primary/30 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-primary text-sm font-medium">
                <CheckCircle2 size={16} />
                VIN decoded successfully
              </div>
              <p className="text-xl font-bold">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {vehicle.engine && <span className="bg-muted px-2 py-1 rounded">{vehicle.engine}</span>}
                {vehicle.trim && <span className="bg-muted px-2 py-1 rounded">{vehicle.trim}</span>}
                {vehicle.bodyStyle && <span className="bg-muted px-2 py-1 rounded">{vehicle.bodyStyle}</span>}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Current Mileage</label>
            <Input
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="e.g. 84500"
              type="number"
              className="bg-card border-border"
            />
          </div>

          {!vehicle.make && (
            <button
              onClick={() => setManualMode(!manualMode)}
              className="text-sm text-primary underline-offset-2 hover:underline"
            >
              {manualMode ? 'Hide manual entry' : 'Enter manually instead'}
            </button>
          )}

          {manualMode && !vehicle.make && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Year</label>
                <Input
                  placeholder="2020"
                  onChange={(e) => setVehicle((v) => ({ ...v, year: parseInt(e.target.value) }))}
                  className="bg-card border-border"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Make</label>
                <Input
                  placeholder="Toyota"
                  onChange={(e) => setVehicle((v) => ({ ...v, make: e.target.value }))}
                  className="bg-card border-border"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Model</label>
                <Input
                  placeholder="Camry"
                  onChange={(e) => setVehicle((v) => ({ ...v, model: e.target.value }))}
                  className="bg-card border-border"
                />
              </div>
            </div>
          )}

          <Button
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
            <h2 className="text-lg font-semibold mb-1">What&apos;s the problem?</h2>
            <p className="text-sm text-muted-foreground">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">DTC Codes</label>
            <div className="flex gap-2">
              <Input
                value={dtcInput}
                onChange={(e) => setDtcInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && addDtc()}
                placeholder="e.g. P0420"
                className="font-mono bg-card border-border"
              />
              <Button variant="outline" onClick={addDtc} className="shrink-0">
                <Plus size={16} />
              </Button>
            </div>
            {dtcCodes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {dtcCodes.map((code) => (
                  <Badge key={code} variant="outline" className="text-primary border-primary/30 bg-primary/10 font-mono gap-1">
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
            <label className="text-sm font-medium text-muted-foreground">Symptoms observed</label>
            <Textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="Describe what you see, hear, or feel…"
              className="bg-card border-border resize-none min-h-[100px]"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Customer complaint (optional)</label>
            <Textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="In their own words…"
              className="bg-card border-border resize-none min-h-[80px]"
            />
          </div>

          <Button
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
            <h2 className="text-lg font-semibold mb-1">Repair Intelligence</h2>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{vehicle.year} {vehicle.make} {vehicle.model}</span>
              <span>·</span>
              {dtcCodes.map((c) => (
                <span key={c} className="font-mono text-primary">{c}</span>
              ))}
            </div>
          </div>

          {solutions.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <AlertCircle size={40} className="mx-auto text-muted-foreground" />
              <p className="font-medium">No previous repairs found</p>
              <p className="text-sm text-muted-foreground">
                Be the first to log a fix for this code — it helps the whole team.
              </p>
              <Button variant="outline" className="mt-4">
                <Plus size={16} className="mr-2" /> Log a New Fix
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {solutions.length} solutions found · ranked by success rate
              </p>
              {solutions.map((sol, i) => (
                <div
                  key={sol.id}
                  className={`bg-card border rounded-xl p-4 space-y-3 transition-colors ${
                    confirmedId === sol.id
                      ? 'border-emerald-400/50 bg-emerald-400/5'
                      : i === 0
                      ? 'border-primary/30'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {i === 0 && (
                          <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30 border">
                            Top Match
                          </Badge>
                        )}
                        <span className="text-base">{categoryIcon(sol.category)}</span>
                      </div>
                      <p className="font-semibold text-sm leading-snug">{sol.title}</p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 font-bold text-sm ${categoryColor(sol.successRate)}`}>
                      {sol.successRate}%
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Wrench size={11} /> {sol.occurrences} repairs
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> ~{sol.avgRepairTimeHours}h
                    </span>
                  </div>

                  {sol.parts.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {sol.parts.map((p) => (
                        <span key={p} className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}

                  {sol.notes && (
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 leading-relaxed">
                      💡 {sol.notes}
                    </p>
                  )}

                  {confirmedId === sol.id ? (
                    <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                      <CheckCircle2 size={16} /> Marked as fixed — great work!
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-dashed hover:border-emerald-400/50 hover:text-emerald-400"
                      onClick={() => setConfirmedId(sol.id)}
                      disabled={confirmedId !== null}
                    >
                      <CheckCircle2 size={14} className="mr-2" /> This fixed it
                    </Button>
                  )}
                </div>
              ))}

              {!confirmedId && (
                <button className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground py-4 border border-dashed border-border rounded-xl hover:border-primary/30 hover:text-primary transition-colors">
                  <Plus size={16} /> None worked — log a new fix
                </button>
              )}
            </div>
          )}

          {confirmedId && (
            <Button className="w-full" onClick={() => router.push('/dashboard')}>
              Done <ChevronRight size={16} className="ml-2" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
