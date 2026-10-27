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
  trim: string
  engine: string
  drivetrain: string
  transmission: string
  mileage: number
  dtc?: string
  complaint: string
  observations: string
  summary: string
  repair?: {
    system?: string
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
    customer: 'Maria Santos', year: 2020, make: 'Volvo', model: 'V60',
    trim: 'T5 Momentum', engine: 'B4204T', drivetrain: 'FWD', transmission: '8-speed auto', mileage: 80000, dtc: 'P0171',
    complaint: 'Check engine light comes on after 15–20 minutes. Hesitates when accelerating uphill.',
    observations: 'Lean condition at idle. Light whistle near intake. Fuel trims rise above +18% when warm.',
    summary: 'Check-engine light appears after 15–20 minutes with hesitation uphill. Warm idle is lean with a light whistle near the intake.',
  },
  {
    key: 'toyota-camry-open', status: 'open', stage: 'similar_repairs', bay: 'Bay 02',
    customer: 'Jamie Lee', year: 2020, make: 'Toyota', model: 'Camry',
    trim: 'SX', engine: '2.5L', drivetrain: 'FWD', transmission: '8-speed automatic', mileage: 61200, dtc: 'P0171',
    complaint: 'Rough idle with a slight hesitation when pulling away from a stop.',
    observations: 'Idle speed varies when warm; no visible smoke or fluid leaks.',
    summary: 'Rough idle when warm with slight hesitation pulling away. Idle speed varies, with no visible smoke or fluid leaks.',
  },
  {
    key: 'ford-f150-open', status: 'open', stage: 'repair', bay: 'Bay 05',
    customer: 'Noah Williams', year: 2018, make: 'Ford', model: 'F-150',
    trim: 'XLT', engine: '5.0L V8', drivetrain: '4WD', transmission: '10-speed automatic', mileage: 134900, dtc: 'P0300',
    complaint: 'Engine shakes at idle and feels weak at low RPM.',
    observations: 'Misfire is most noticeable while stationary after the engine warms up.',
    summary: 'Engine shakes at idle and feels weak at low RPM. The misfire becomes more noticeable after the engine warms up.',
  },
  {
    key: 'vw-golf-open', status: 'open', stage: 'assessment', bay: 'Bay 04',
    customer: 'Grace Ferreira', year: 2021, make: 'Volkswagen', model: 'Golf',
    trim: '110TSI Life', engine: '1.4L turbo petrol', drivetrain: 'FWD', transmission: '8-speed automatic', mileage: 45000,
    complaint: 'Occasional rough idle when cold, smooths out after a minute or two.',
    observations: 'Idle settles once coolant temp comes up; no fault codes stored.',
    summary: 'Rough idle when cold that smooths out within a couple of minutes. No fault codes stored.',
  },
  {
    key: 'isuzu-dmax-open', status: 'open', stage: 'assessment', bay: 'Bay 06',
    customer: 'Ben Whitlock', year: 2021, make: 'Isuzu', model: 'D-Max',
    trim: 'LS-U', engine: '3.0L turbo diesel', drivetrain: '4WD', transmission: '6-speed automatic', mileage: 68000,
    complaint: 'Turbo whistle under load, most noticeable when towing.',
    observations: 'Whistle is speed- and load-dependent; no smoke or boost fault codes.',
    summary: 'Turbo whistle under load, especially towing. No smoke or boost fault codes.',
  },
  {
    key: 'hyundai-kona-open', status: 'open', stage: 'assessment', bay: 'Bay 07',
    customer: 'Ingrid Palmer', year: 2022, make: 'Hyundai', model: 'Kona',
    trim: 'Active', engine: '2.0L petrol', drivetrain: 'FWD', transmission: 'CVT', mileage: 15000,
    complaint: 'Slight vibration through the steering wheel at highway speed.',
    observations: 'Vibration scales with speed; tyres and wheel weights look undisturbed.',
    summary: 'Steering vibration that scales with speed. Tyres and wheel weights appear undisturbed.',
  },
  {
    key: 'honda-civic-resolved', status: 'resolved', stage: 'resolved', bay: 'Bay 01',
    customer: 'Priya Nair', year: 2019, make: 'Honda', model: 'Civic',
    trim: 'EX', engine: '2.0L', drivetrain: 'FWD', transmission: 'CVT automatic', mileage: 82400, dtc: 'P0420',
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
  {
    key: 'honda-civic-engine-fuel-air', status: 'resolved', stage: 'resolved', bay: 'Bay 01',
    customer: 'Daniel Okafor', year: 2019, make: 'Honda', model: 'Civic',
    trim: 'EX', engine: '2.0L', drivetrain: 'FWD', transmission: 'CVT automatic', mileage: 64100, dtc: 'P0171',
    complaint: 'Rough idle when cold and a hesitation pulling away from the lights.',
    observations: 'Smoke test found an unmetered air leak at the PCV hose. Long-term fuel trim was +18% at idle.',
    summary: 'Rough cold idle and hesitation. Smoke test found a split PCV hose with fuel trims running lean.',
    repair: {
      system: 'engine_fuel_air',
      cause: 'Split PCV hose letting unmetered air into the intake, driving the engine lean at idle.',
      workPerformed: 'Smoke-tested the intake and confirmed a leak at the PCV hose.\nReplaced the PCV hose and valve.\nCleaned the throttle body and reset idle learn.\nRoad-tested and confirmed fuel trims back within ±5%.',
      verification: 'Fuel trims settled within ±5% at idle and cruise. No DTC returned after two cold starts.',
      steps: [
        'Smoke-tested the intake and confirmed a leak at the PCV hose.',
        'Replaced the PCV hose and valve.',
        'Cleaned the throttle body and reset idle learn.',
        'Road-tested and confirmed fuel trims back within ±5%.',
      ],
      items: [
        { kind: 'part', name: 'PCV hose', quantity: 1 },
        { kind: 'part', name: 'PCV valve', quantity: 1 },
        { kind: 'consumable', name: 'Throttle body cleaner', quantity: 1 },
      ],
    },
  },
  {
    key: 'honda-civic-ignition', status: 'resolved', stage: 'resolved', bay: 'Bay 01',
    customer: 'Sophie Tran', year: 2019, make: 'Honda', model: 'Civic',
    trim: 'EX', engine: '2.0L', drivetrain: 'FWD', transmission: 'CVT automatic', mileage: 97300, dtc: 'P0302',
    complaint: 'Engine shudders under load and the check-engine light flashes on the highway.',
    observations: 'Misfire counter high on cylinder 2. Swapping coils moved the misfire to cylinder 3.',
    summary: 'Flashing check-engine light with shudder under load. Misfire followed the cylinder 2 coil when swapped.',
    repair: {
      system: 'ignition',
      cause: 'Failed ignition coil on cylinder 2 causing a misfire under load.',
      workPerformed: 'Read misfire counters and confirmed cylinder 2.\nSwapped coils 2 and 3 to confirm the misfire followed the coil.\nReplaced the coil and all four spark plugs.\nCleared codes and road-tested under load.',
      verification: 'Misfire counters stayed at zero across a 20 km road test including highway load.',
      steps: [
        'Read misfire counters and confirmed cylinder 2.',
        'Swapped coils 2 and 3 to confirm the misfire followed the coil.',
        'Replaced the coil and all four spark plugs.',
        'Cleared codes and road-tested under load.',
      ],
      items: [
        { kind: 'part', name: 'Ignition coil', quantity: 1 },
        { kind: 'part', name: 'Spark plug', quantity: 4 },
      ],
    },
  },
  {
    key: 'honda-civic-transmission', status: 'resolved', stage: 'resolved', bay: 'Bay 01',
    customer: 'Liam Fraser', year: 2019, make: 'Honda', model: 'Civic',
    trim: 'EX', engine: '2.0L', drivetrain: 'FWD', transmission: 'CVT automatic', mileage: 118500, dtc: 'P0868',
    complaint: 'Judder pulling away from a stop and the revs flare under light throttle.',
    observations: 'CVT fluid dark with a burnt smell. Line pressure low at idle and fluid temperature normal.',
    summary: 'Take-off judder and revs flaring. CVT fluid degraded and line pressure low at idle.',
    repair: {
      system: 'transmission',
      cause: 'Degraded CVT fluid causing low line pressure and belt slip on take-off.',
      workPerformed: 'Checked CVT fluid condition and level.\nDrained and refilled the CVT fluid twice.\nReplaced the CVT fluid strainer.\nRan the CVT learn procedure and road-tested.',
      verification: 'Smooth take-off with no judder or flare. Line pressure back in specification.',
      steps: [
        'Checked CVT fluid condition and level.',
        'Drained and refilled the CVT fluid twice.',
        'Replaced the CVT fluid strainer.',
        'Ran the CVT learn procedure and road-tested.',
      ],
      items: [
        { kind: 'consumable', name: 'Honda HCF-2 CVT fluid (L)', quantity: 7 },
        { kind: 'part', name: 'CVT fluid strainer', quantity: 1 },
      ],
    },
  },
  {
    key: 'honda-civic-cooling-hvac', status: 'resolved', stage: 'resolved', bay: 'Bay 01',
    customer: 'Grace Whitfield', year: 2019, make: 'Honda', model: 'Civic',
    trim: 'EX', engine: '2.0L', drivetrain: 'FWD', transmission: 'CVT automatic', mileage: 71800,
    complaint: 'Air-con blowing warm air on hot days, then cools again on the highway.',
    observations: 'Condenser fan not running with AC on. Fan motor drew no current with 12 V applied at the connector.',
    summary: 'AC warm at idle and cool at speed. Condenser fan motor not running with power applied.',
    repair: {
      system: 'cooling_hvac',
      cause: 'Seized condenser fan motor, so the AC lost condensing airflow at idle.',
      workPerformed: 'Confirmed refrigerant pressures rose at idle with the fan off.\nApplied 12 V to the fan and confirmed the motor was seized.\nReplaced the condenser fan motor and shroud.\nChecked vent temperature at idle and on the road.',
      verification: 'Vent temperature held at 6 °C at idle on a 34 °C day. Fan cycling normally.',
      steps: [
        'Confirmed refrigerant pressures rose at idle with the fan off.',
        'Applied 12 V to the fan and confirmed the motor was seized.',
        'Replaced the condenser fan motor and shroud.',
        'Checked vent temperature at idle and on the road.',
      ],
      items: [
        { kind: 'part', name: 'Condenser fan motor and shroud', quantity: 1 },
      ],
    },
  },
  {
    key: 'honda-civic-brakes', status: 'resolved', stage: 'resolved', bay: 'Bay 01',
    customer: 'Ethan Kowalski', year: 2019, make: 'Honda', model: 'Civic',
    trim: 'EX', engine: '2.0L', drivetrain: 'FWD', transmission: 'CVT automatic', mileage: 58900,
    complaint: 'Steering wheel shakes when braking from highway speed.',
    observations: 'Front rotor runout 0.09 mm, above the 0.04 mm limit. Pads at 4 mm.',
    summary: 'Brake judder from highway speed. Front rotor runout over limit and pads worn.',
    repair: {
      system: 'brakes',
      cause: 'Excessive front rotor runout causing pedal pulsation and steering shake under braking.',
      workPerformed: 'Measured front rotor runout and thickness.\nReplaced both front rotors and pads.\nCleaned and lubricated the caliper slide pins.\nBedded in the new pads and road-tested.',
      verification: 'No judder from 100 km/h stops. Pedal firm and runout within specification.',
      steps: [
        'Measured front rotor runout and thickness.',
        'Replaced both front rotors and pads.',
        'Cleaned and lubricated the caliper slide pins.',
        'Bedded in the new pads and road-tested.',
      ],
      items: [
        { kind: 'part', name: 'Front brake rotor', quantity: 2 },
        { kind: 'part', name: 'Front brake pad set', quantity: 1 },
      ],
    },
  },
  {
    key: 'honda-civic-suspension-steering', status: 'resolved', stage: 'resolved', bay: 'Bay 01',
    customer: 'Hannah Lee', year: 2019, make: 'Honda', model: 'Civic',
    trim: 'EX', engine: '2.0L', drivetrain: 'FWD', transmission: 'CVT automatic', mileage: 89200,
    complaint: 'Clunk from the front left over speed bumps and a light knock when turning.',
    observations: 'Front left sway-bar link had free play at the ball joint. Strut mounts and lower arm bushes were fine.',
    summary: 'Front left clunk over bumps. Sway-bar link ball joint worn with free play.',
    repair: {
      system: 'suspension_steering',
      cause: 'Worn front left sway-bar link ball joint knocking over bumps.',
      workPerformed: 'Road-tested to confirm the noise.\nInspected the front suspension on the hoist.\nReplaced both front sway-bar links.\nTorqued to specification and re-tested over bumps.',
      verification: 'No clunk over speed bumps or when turning at full lock.',
      steps: [
        'Road-tested to confirm the noise.',
        'Inspected the front suspension on the hoist.',
        'Replaced both front sway-bar links.',
        'Torqued to specification and re-tested over bumps.',
      ],
      items: [
        { kind: 'part', name: 'Front sway-bar link', quantity: 2 },
      ],
    },
  },
  {
    key: 'honda-civic-electrical', status: 'resolved', stage: 'resolved', bay: 'Bay 01',
    customer: 'Noah Patel', year: 2019, make: 'Honda', model: 'Civic',
    trim: 'EX', engine: '2.0L', drivetrain: 'FWD', transmission: 'CVT automatic', mileage: 76400,
    complaint: 'Slow cranking in the mornings and the car occasionally needs a jump start.',
    observations: 'Battery passed load test. Parasitic draw of 280 mA traced to the boot light staying on.',
    summary: 'Slow morning starts. Parasitic draw traced to the boot light switch holding the lamp on.',
    repair: {
      system: 'electrical',
      cause: 'Faulty boot latch switch keeping the boot light on and draining the battery overnight.',
      workPerformed: 'Load-tested the battery and charging system.\nMeasured parasitic draw and isolated it by pulling fuses.\nReplaced the boot latch switch.\nRecharged the battery and re-measured draw.',
      verification: 'Parasitic draw down to 25 mA after sleep mode. Starts normally after three nights parked.',
      steps: [
        'Load-tested the battery and charging system.',
        'Measured parasitic draw and isolated it by pulling fuses.',
        'Replaced the boot latch switch.',
        'Recharged the battery and re-measured draw.',
      ],
      items: [
        { kind: 'part', name: 'Boot latch switch', quantity: 1 },
      ],
    },
  },
  {
    key: 'honda-civic-body-interior', status: 'resolved', stage: 'resolved', bay: 'Bay 01',
    customer: 'Chloe Martin', year: 2019, make: 'Honda', model: 'Civic',
    trim: 'EX', engine: '2.0L', drivetrain: 'FWD', transmission: 'CVT automatic', mileage: 52700,
    complaint: 'Water on the front passenger floor after heavy rain.',
    observations: 'Water test showed the windscreen cowl drain blocked with leaves, overflowing into the cabin filter housing.',
    summary: 'Wet passenger floor after rain. Blocked cowl drain overflowing into the cabin.',
    repair: {
      system: 'body_interior',
      cause: 'Blocked windscreen cowl drain letting water overflow into the cabin air intake.',
      workPerformed: 'Water-tested to find the entry point.\nRemoved the cowl panel and cleared the drain.\nReplaced the soaked cabin air filter.\nDried the carpet and re-tested with a hose.',
      verification: 'No water entry after a 10-minute hose test. Carpet dry the following day.',
      steps: [
        'Water-tested to find the entry point.',
        'Removed the cowl panel and cleared the drain.',
        'Replaced the soaked cabin air filter.',
        'Dried the carpet and re-tested with a hose.',
      ],
      items: [
        { kind: 'part', name: 'Cabin air filter', quantity: 1 },
      ],
    },
  },
  {
    key: 'honda-civic-other', status: 'resolved', stage: 'resolved', bay: 'Bay 01',
    customer: 'Oliver Grant', year: 2019, make: 'Honda', model: 'Civic',
    trim: 'EX', engine: '2.0L', drivetrain: 'FWD', transmission: 'CVT automatic', mileage: 104600,
    complaint: 'Squealing noise from the engine bay on cold starts that fades after a minute.',
    observations: 'Drive belt glazed with cracks across the ribs. Tensioner pulley bearing noisy when spun by hand.',
    summary: 'Cold-start squeal. Drive belt glazed and the tensioner bearing noisy.',
    repair: {
      system: 'other',
      cause: 'Glazed drive belt and worn tensioner bearing squealing on cold starts.',
      workPerformed: 'Confirmed the noise source with a stethoscope.\nReplaced the drive belt.\nReplaced the belt tensioner.\nChecked belt alignment and re-tested from cold.',
      verification: 'No squeal on two cold starts. Belt tracking correctly.',
      steps: [
        'Confirmed the noise source with a stethoscope.',
        'Replaced the drive belt.',
        'Replaced the belt tensioner.',
        'Checked belt alignment and re-tested from cold.',
      ],
      items: [
        { kind: 'part', name: 'Drive belt', quantity: 1 },
        { kind: 'part', name: 'Belt tensioner', quantity: 1 },
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

    // Seeding is gated on the branch being marked as demo. This runs on every
    // dashboard load, so without the gate a workshop can never be empty: a
    // brand-new branch created for real customers refills itself with seven
    // fabricated jobs the first time anyone opens it, and deleting them just
    // brings them back on the next load. The is_demo flag is what separates
    // "a shop that wants sample data" from "a shop that must never have any".
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('is_demo,org:organisations!shops_org_id_fkey(primary_shop_id)')
      .eq('id', shopId)
      .single()
    if (shopError) throw shopError
    if (!shop.is_demo) return NextResponse.json({ created: 0, skipped: 'not_a_demo_branch' })

    // Only the head shop of a demo business gets the fixtures. Seeding every
    // demo branch put the same seven vehicles at all of them, which makes the
    // branches indistinguishable in a demo and fills the cross-branch repair
    // view with what look like duplicates of one job. A demo branch is worth
    // having precisely because its content differs from its siblings', so the
    // sample set belongs at one site and hand-built data at the rest.
    const org = shop.org as unknown as { primary_shop_id: string | null } | null
    if (org?.primary_shop_id && org.primary_shop_id !== shopId) {
      return NextResponse.json({ created: 0, skipped: 'not_the_head_branch' })
    }

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
        trim: fixture.trim,
        engine: fixture.engine,
        drivetrain: fixture.drivetrain,
        transmission: fixture.transmission,
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
          system: fixture.repair.system ?? null,
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
