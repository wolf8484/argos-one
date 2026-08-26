import { z } from 'zod'

const nullableText = z.string().trim().max(5000).nullable().optional()
const nullableHttpUrl = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol
  return protocol === 'https:' || protocol === 'http:'
}, 'Only HTTP(S) URLs are allowed').nullable().optional()

export const vehicleSchema = z.object({
  vin: z.string().trim().toUpperCase().regex(/^[A-HJ-NPR-Z0-9]{17}$/).nullable().optional(),
  year: z.coerce.number().int().min(1886).max(2200),
  make: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  mileage: z.coerce.number().int().min(0).nullable().optional(),
  // Trim/engine/drivetrain/transmission are mandatory: the repair library
  // filters a car profile's history by these, so a vehicle saved without
  // them is invisible to that filter and pools into an "unspecified" bucket.
  engine: z.string().trim().min(1).max(120),
  trim: z.string().trim().min(1).max(120),
  drivetrain: z.string().trim().min(1).max(120),
  transmission: z.string().trim().min(1).max(120),
  bodyStyle: z.string().trim().max(120).nullable().optional(),
  fuelType: z.string().trim().max(120).nullable().optional(),
})

export const customerSchema = z.object({
  fullName: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(60).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
})

export const createJobSchema = z.object({
  id: z.string().uuid().optional(),
  customer: customerSchema,
  vehicle: vehicleSchema,
  bay: z.string().trim().max(30).nullable().optional(),
})

export const assessmentSchema = z.object({
  complaint: z.string().trim().min(1).max(10000),
  observations: nullableText,
  dtcs: z.array(z.string().trim().toUpperCase().regex(/^[A-Z][0-9A-Z]{4,6}$/)).max(30).default([]),
  nextStage: z.enum(['similar_repairs', 'repair']).default('similar_repairs'),
})

export const repairItemSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(['part', 'consumable']).default('part'),
  name: z.string().trim().min(1).max(240),
  partNumber: z.string().trim().max(160).nullable().optional(),
  brand: z.string().trim().max(160).nullable().optional(),
  quantity: z.coerce.number().positive().max(100000).default(1),
  unit: z.string().trim().max(40).nullable().optional(),
  supplier: z.string().trim().max(200).nullable().optional(),
  priceAmount: z.coerce.number().min(0).nullable().optional(),
  currency: z.string().trim().length(3).default('AUD'),
  offerUrl: nullableHttpUrl,
  offerImageUrl: nullableHttpUrl,
})

export const repairSchema = z.object({
  workPerformed: z.string().trim().max(20000).default(''),
  verificationNotes: nullableText,
  dtcs: z.array(z.string().trim().toUpperCase().regex(/^[A-Z][0-9A-Z]{4,6}$/)).max(30).default([]),
  referenceRepairId: z.string().uuid().nullable().optional(),
  system: z.enum([
    'engine_fuel_air', 'ignition', 'transmission', 'emissions', 'cooling_hvac',
    'brakes', 'suspension_steering', 'electrical', 'body_interior', 'other',
  ]).nullable().optional(),
  items: z.array(repairItemSchema).max(200).default([]),
  resolve: z.boolean().default(false),
})

export const enhanceTextSchema = z.object({
  text: z.string().trim().min(1).max(12000),
  field: z.enum(['complaint', 'observations', 'work_performed', 'verification']).default('observations'),
})

export const researchSchema = z.object({
  jobId: z.string().uuid().optional(),
  query: z.string().trim().min(3).max(500),
  vehicle: z.string().trim().max(240).optional(),
  dtcs: z.array(z.string().trim().max(12)).max(30).default([]),
  complaint: z.string().trim().max(5000).optional(),
  observations: z.string().trim().max(5000).optional(),
})

export const catalogWriteSchema = z.object({
  make: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100).optional(),
  variant: z.string().trim().min(1).max(120).optional(),
  engine: z.string().trim().max(120).nullable().optional(),
  drivetrain: z.string().trim().max(120).nullable().optional(),
  transmission: z.string().trim().max(120).nullable().optional(),
})

export const catalogResearchSchema = z.object({
  make: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  year: z.number().int().min(1886).max(2200).optional(),
})

export const profileNoteSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  vehicleYear: z.number().int().min(1886).max(2200).nullable().optional(),
  vehicleTrim: z.string().trim().max(120).nullable().optional(),
  vehicleTransmission: z.string().trim().max(120).nullable().optional(),
  vehicleMileage: z.number().int().min(0).nullable().optional(),
  sourceJobId: z.string().uuid().nullable().optional(),
})

export const resolveProfileSchema = z.object({
  make: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
})
