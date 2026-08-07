export interface Vehicle {
  id: string
  vin?: string
  make: string
  model: string
  year: number
  mileage?: number
  engine?: string
  trim?: string
  bodyStyle?: string
}

export interface DtcCode {
  code: string
  description: string
}

export interface Solution {
  id: string
  title: string
  category: 'electrical' | 'mechanical' | 'emissions' | 'fuel' | 'cooling' | 'transmission' | 'brakes' | 'other'
  successRate: number
  occurrences: number
  avgRepairTimeHours: number
  parts: string[]
  notes?: string
  confirmedByUser?: boolean
}

export interface Job {
  id: string
  vehicle: Vehicle
  dtcCodes: string[]
  symptoms: string
  customerComplaint?: string
  status: 'open' | 'resolved'
  createdAt: string
  resolvedAt?: string
  confirmedSolution?: Solution
  solutions: Solution[]
}

export interface NhtsaResponse {
  Count: number
  Message: string
  SearchCriteria: string
  Results: NhtsaResult[]
}

export interface NhtsaResult {
  Variable: string
  Value: string | null
  ValueId: string | null
  VariableId: number
}

export interface VinDecodeResult {
  make: string
  model: string
  year: string
  engine: string
  trim: string
  bodyStyle: string
  fuelType: string
  error?: string
}
