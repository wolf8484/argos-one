import { NextResponse } from 'next/server'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'

const fixtureMarker = 'ARGOS_DEMO_FIXTURE::'

type DemoFixture = {
  key: string
  status: 'open' | 'resolved'
  stage: 'assessment' | 'similar_repairs' | 'repair' | 'resolved'
  bay: string
  customer: string
  year: number
  make: string
  model: string
  mileage: number
  dtc?: string
  complaint: string
  observations: string
  summary: string
  repair?: {
    cause: string
    workPerformed: string
    verification: string
    steps: string[]
    items: Array<{ kind: 'part' | 'consumable'; name: string; partNumber?: string; quantity: number }>
  }
}

const fixtures: DemoFixture[] = [
  {
    key: 'volvo-v60-open', status: 'open', stage: 'assessment', bay: 'Bay 03',
    customer: 'Maria Santos', year: 2020, make: 'Volvo', model: 'V60', mileage: 80000, dtc: 'P0171',
    complaint: 'Check engine light comes on after 15–20 minutes. Hesitates when accelerating uphill.',
    observations: 'Lean condition at idle. Light whistle near intake. Fuel trims rise above +18% when warm.',
    summary: 'Check-engine light appears after 15–20 minutes with hesitation uphill. Warm idle is lean with a light whistle near the intake.',
  },
  {
    key: 'toyota-camry-open', status: 'open', stage: 'similar_repairs', bay: 'Bay 02',
    customer: 'Jamie Lee', year: 2020, make: 'Toyota', model: 'Camry', mileage: 61200, dtc: 'P0171',
    complaint: 'Rough idle with a slight hesitation when pulling away from a stop.',
    observations: 'Idle speed varies when warm; no visible smoke or fluid leaks.',
    summary: 'Rough idle when warm with slight hesitation pulling away. Idle speed varies, with no visible smoke or fluid leaks.',
  },
  {
    key: 'ford-f150-open', status: 'open', stage: 'repair', bay: 'Bay 05',
    customer: 'Noah Williams', year: 2018, make: 'Ford', model: 'F-150', mileage: 134900, dtc: 'P0300',
    complaint: 'Engine shakes at idle and feels weak at low RPM.',
    observations: 'Misfire is most noticeable while stationary after the engine warms up.',
    summary: 'Engine shakes at idle and feels weak at low RPM. The misfire becomes more noticeable after the engine warms up.',
  },
  {
    key: 'honda-civic-resolved', status: 'resolved', stage: 'resolved', bay: 'Bay 01',
    customer: 'Priya Nair', year: 2019, make: 'Honda', model: 'Civic', mileage: 82400, dtc: 'P0420',
    complaint: 'Check-engine light was on with no noticeable loss of power.',
    observations: 'No exhaust leak found. Rear oxygen-sensor response remained slow after the engine reached operating temperature.',
    summary: 'Check-engine light with no noticeable power loss. Rear oxygen-sensor response remained slow after reaching operating temperature.',
    repair: {
      cause: 'Catalytic-converter efficiency was below specification after oxygen-sensor operation and exhaust integrity were verified.',
      workPerformed: 'Checked the exhaust system for leaks and damage.\nVerified front and rear oxygen-sensor activity at operating temperature.\nReplaced the catalytic converter and both sealing gaskets.\nCleared adaptations and completed the manufacturer drive cycle.',
      verification: 'No DTC returned after the full drive cycle. Catalyst monitor completed and tailpipe emissions remained within specification.',
      steps: [
        'Checked the exhaust system for leaks and damage.',
        'Verified front and rear oxygen-sensor activity at operating temperature.',
        'Replaced the catalytic converter and both sealing gaskets.',
        'Cleared adaptations and completed the manufacturer drive cycle.',
      ],
      items: [
        { kind: 'part', name: 'Catalytic converter assembly', partNumber: '18160-5BA-A00', quantity: 1 },
        { kind: 'part', name: 'Exhaust flange gasket', partNumber: '18212-SA7-003', quantity: 2 },
      ],
    },
  },
]

export async function POST() {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error

  try {
    const { supabase, profile } = auth
    const shopId = profile.shop_id
    const { data: markedCustomers, error: customerLookupError } = await supabase
      .from('customers')
      .select('id,notes')
      .eq('shop_id', shopId)
      .like('notes', `${fixtureMarker}%`)
    if (customerLookupError) throw customerLookupError

    const customerIds = (markedCustomers ?? []).map((customer) => customer.id)
    const { data: existingJobs, error: jobsLookupError } = customerIds.length
      ? await supabase.from('jobs').select('customer_id').eq('shop_id', shopId).in('customer_id', customerIds).in('status', ['open', 'resolved'])
      : { data: [], error: null }
    if (jobsLookupError) throw jobsLookupError

    const activeFixtureCustomerIds = new Set((existingJobs ?? []).map((job) => job.customer_id).filter(Boolean))
    const markedByKey = new Map((markedCustomers ?? []).map((customer) => [String(customer.notes).slice(fixtureMarker.length), customer]))
    let created = 0

    for (const fixture of fixtures) {
      const knownCustomer = markedByKey.get(fixture.key)
      if (knownCustomer && activeFixtureCustomerIds.has(knownCustomer.id)) continue

      let customerId = knownCustomer?.id
      if (!customerId) {
        const { data: customer, error: customerError } = await supabase.from('customers').insert({
          shop_id: shopId,
          full_name: fixture.customer,
          notes: `${fixtureMarker}${fixture.key}`,
          created_by: profile.id,
        }).select('id').single()
        if (customerError) throw customerError
        customerId = customer.id
      }

      const { data: vehicle, error: vehicleError } = await supabase.from('vehicles').insert({
        shop_id: shopId,
        customer_id: customerId,
        year: fixture.year,
        make: fixture.make,
        model: fixture.model,
        mileage: fixture.mileage,
        created_by: profile.id,
      }).select('id').single()
      if (vehicleError) throw vehicleError

      const { data: job, error: jobError } = await supabase.from('jobs').insert({
        shop_id: shopId,
        vehicle_id: vehicle.id,
        customer_id: customerId,
        status: fixture.status,
        stage: fixture.stage,
        bay: fixture.bay,
        complaint: fixture.complaint,
        observations: fixture.observations,
        summary: fixture.summary,
        assigned_to: profile.id,
        created_by: profile.id,
        resolved_at: fixture.status === 'resolved' ? new Date().toISOString() : null,
      }).select('id').single()
      if (jobError) throw jobError

      if (fixture.dtc) {
        const { error } = await supabase.from('job_dtc_codes').insert({ shop_id: shopId, job_id: job.id, code: fixture.dtc })
        if (error) throw error
      }

      if (fixture.repair) {
        const { data: repair, error: repairError } = await supabase.from('repair_records').insert({
          shop_id: shopId,
          job_id: job.id,
          cause: fixture.repair.cause,
          work_performed: fixture.repair.workPerformed,
          verification_notes: fixture.repair.verification,
          verified: true,
          completed_by: profile.id,
        }).select('id').single()
        if (repairError) throw repairError

        const { error: stepsError } = await supabase.from('repair_steps').insert(fixture.repair.steps.map((instruction, index) => ({
          shop_id: shopId, repair_id: repair.id, position: index + 1, instruction,
        })))
        if (stepsError) throw stepsError

        const { error: itemsError } = await supabase.from('repair_items').insert(fixture.repair.items.map((item) => ({
          shop_id: shopId,
          repair_id: repair.id,
          kind: item.kind,
          name: item.name,
          part_number: item.partNumber,
          quantity: item.quantity,
        })))
        if (itemsError) throw itemsError
      }

      created += 1
    }

    return NextResponse.json({ created, fixtures: fixtures.length })
  } catch (error) {
    return apiError(error, 'Could not prepare demo jobs')
  }
}
