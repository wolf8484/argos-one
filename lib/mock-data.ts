import { Job, Solution } from '@/types'

export const mockSolutions: Record<string, Solution[]> = {
  P0420: [
    {
      id: 's1',
      title: 'Replace catalytic converter',
      category: 'emissions',
      successRate: 87,
      occurrences: 47,
      avgRepairTimeHours: 2.5,
      parts: ['Catalytic converter', 'Exhaust gaskets'],
      notes: 'Confirm with live O2 sensor data before replacing. Bank 1 downstream O2 should show flat waveform.',
    },
    {
      id: 's2',
      title: 'Replace downstream O2 sensor',
      category: 'electrical',
      successRate: 34,
      occurrences: 23,
      avgRepairTimeHours: 0.75,
      parts: ['Downstream O2 sensor'],
      notes: 'Check sensor wiring harness for heat damage first.',
    },
    {
      id: 's3',
      title: 'Check for exhaust leaks before catalytic converter',
      category: 'mechanical',
      successRate: 12,
      occurrences: 8,
      avgRepairTimeHours: 0.5,
      parts: ['Exhaust manifold gasket'],
    },
  ],
  P0171: [
    {
      id: 's4',
      title: 'Clean or replace MAF sensor',
      category: 'fuel',
      successRate: 72,
      occurrences: 38,
      avgRepairTimeHours: 0.5,
      parts: ['MAF sensor', 'MAF cleaner spray'],
      notes: 'Try cleaning with MAF cleaner first before replacing. Check air filter condition.',
    },
    {
      id: 's5',
      title: 'Inspect for vacuum leaks',
      category: 'mechanical',
      successRate: 45,
      occurrences: 29,
      avgRepairTimeHours: 1.0,
      parts: ['Intake manifold gasket', 'Vacuum hose set'],
      notes: 'Use smoke machine. Common leak points: intake boot, PCV hose, brake booster line.',
    },
    {
      id: 's6',
      title: 'Replace fuel injectors',
      category: 'fuel',
      successRate: 23,
      occurrences: 12,
      avgRepairTimeHours: 3.0,
      parts: ['Fuel injector set', 'Fuel injector o-rings'],
    },
  ],
  P0300: [
    {
      id: 's7',
      title: 'Replace spark plugs and ignition coils',
      category: 'electrical',
      successRate: 78,
      occurrences: 56,
      avgRepairTimeHours: 1.5,
      parts: ['Spark plug set', 'Ignition coil set'],
      notes: 'Check for oil fouling on plugs — indicates valve cover gasket leak.',
    },
    {
      id: 's8',
      title: 'Replace fuel injectors',
      category: 'fuel',
      successRate: 41,
      occurrences: 22,
      avgRepairTimeHours: 3.0,
      parts: ['Fuel injector set'],
    },
    {
      id: 's9',
      title: 'Check compression — possible internal engine damage',
      category: 'mechanical',
      successRate: 15,
      occurrences: 9,
      avgRepairTimeHours: 1.0,
      parts: [],
      notes: 'Run compression test on all cylinders. If one is significantly lower, likely valve or ring issue.',
    },
  ],
}

export const mockJobs: Job[] = [
  {
    id: 'j1',
    vehicle: {
      id: 'v1',
      vin: '1HGBH41JXMN109186',
      make: 'Honda',
      model: 'Civic',
      year: 2019,
      mileage: 82400,
      engine: '1.5L 4-cyl',
      trim: 'EX',
    },
    dtcCodes: ['P0420'],
    symptoms: 'Check engine light on. No noticeable performance issues.',
    customerComplaint: 'CEL came on after last oil change',
    status: 'resolved',
    createdAt: '2026-08-05T09:00:00Z',
    resolvedAt: '2026-08-05T11:30:00Z',
    confirmedSolution: mockSolutions.P0420[0],
    solutions: mockSolutions.P0420,
  },
  {
    id: 'j2',
    vehicle: {
      id: 'v2',
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
      mileage: 61200,
      engine: '2.5L 4-cyl',
    },
    dtcCodes: ['P0171'],
    symptoms: 'Rough idle, slight hesitation on acceleration',
    status: 'open',
    createdAt: '2026-08-06T14:00:00Z',
    solutions: mockSolutions.P0171,
  },
  {
    id: 'j3',
    vehicle: {
      id: 'v3',
      make: 'Ford',
      model: 'F-150',
      year: 2018,
      mileage: 134900,
      engine: '5.0L 8-cyl',
    },
    dtcCodes: ['P0300'],
    symptoms: 'Engine misfiring at idle and low RPM, rough running',
    customerComplaint: 'Shaking bad at stop lights',
    status: 'open',
    createdAt: '2026-08-07T08:15:00Z',
    solutions: mockSolutions.P0300,
  },
]

export function getSolutionsForCodes(codes: string[]): Solution[] {
  const seen = new Set<string>()
  const results: Solution[] = []

  for (const code of codes) {
    const solutions = mockSolutions[code.toUpperCase()] ?? []
    for (const sol of solutions) {
      if (!seen.has(sol.id)) {
        seen.add(sol.id)
        results.push(sol)
      }
    }
  }

  return results.sort((a, b) => b.successRate - a.successRate)
}
