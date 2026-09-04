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

export const updateProfileNoteSchema = z.object({
  body: z.string().trim().min(1).max(4000),
})

export const resolveProfileSchema = z.object({
  make: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
})

export const shopSettingsSchema = z.object({
  sharesRepairData: z.boolean().optional(),
  name: z.string().trim().min(1).max(160).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().max(160).nullable().optional(),
  branchId: z.string().trim().max(60).nullable().optional(),
  region: z.string().trim().min(1).max(80).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  preferredSupplier: z.string().trim().max(160).nullable().optional(),
  defaultBayId: z.string().uuid().nullable().optional(),
  defaultTechnicianId: z.string().uuid().nullable().optional(),
  autoAssignJobs: z.boolean().optional(),
})

export const baySchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200).nullable().optional(),
  active: z.boolean().default(true),
})

export const updateBaySchema = baySchema.partial()

// Last name is optional here because an invited staff member supplies their
// own surname when they redeem the code -- the admin creating the invite is
// only asked for a first name.
// Only ever consumed as updateTechnicianSchema (.partial(), below) -- role and
// active are deliberately plain .optional() rather than .default(...): Zod's
// .partial() does not strip an underlying .default(), so an update payload
// that simply omits role (e.g. a disabled role <select> for the last Owner,
// or any quick-action PATCH that only touches one field) would otherwise
// silently reset it to "technician" on every save, and likewise reset active
// to true. Both would demote/reactivate someone as a side effect of an
// unrelated edit.
export const technicianSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).nullable().optional(),
  initials: z.string().trim().max(4).nullable().optional(),
  employeeId: z.string().trim().max(60).nullable().optional(),
  role: z.enum(['owner', 'admin', 'technician']).optional(),
  active: z.boolean().optional(),
  defaultBayId: z.string().uuid().nullable().optional(),
  // These patch the technician's linked profile (profiles.phone / .email),
  // not the shop_technicians row itself -- see WorkshopRepository.updateTechnician.
  mobile: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().max(160).nullable().optional(),
})

export const updateTechnicianSchema = technicianSchema.partial()

// What an owner/admin fills in to invite someone. Contact details are both
// optional: the admin may only know the person's name, and the invitee
// supplies whichever identifier they actually have when they join.
export const inviteStaffSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160).nullable().optional(),
  mobile: z.string().trim().max(30).nullable().optional(),
  role: z.enum(['admin', 'technician']).default('technician'),
  defaultBayId: z.string().uuid().nullable().optional(),
})

export const inviteLookupSchema = z.object({
  code: z.string().trim().min(4).max(12),
})

// Redemption. At least one identifier is required -- it becomes the login.
export const joinWorkshopSchema = z.object({
  code: z.string().trim().min(4).max(12),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160).nullable().optional(),
  // Mandatory, unlike at invite time: the mobile is the one identifier every
  // staff member is guaranteed to be able to sign in with, so letting someone
  // finish onboarding without it is how an account gets stranded.
  mobile: z.string().trim().min(1).max(30),
  password: z.string().min(8).max(200),
})
