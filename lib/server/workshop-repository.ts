import type { SupabaseClient } from '@supabase/supabase-js'

import { generateMatchInsights } from '@/lib/server/repair-match-insights'
import { generateRepairSummary } from '@/lib/server/repair-summary'

type Profile = { id: string; shop_id: string; full_name: string; role: string }

export class WorkshopRepository {
  constructor(private readonly supabase: SupabaseClient, private readonly profile: Profile) {}

  async listJobs() {
    const { data, error } = await this.supabase
      .from('jobs')
      .select(`id,job_number,status,stage,bay,complaint,observations,summary,selected_reference_id,created_at,updated_at,resolved_at,
        customer:customers(id,full_name,phone,email),
        vehicle:vehicles(id,vin,year,make,model,mileage,engine,trim,drivetrain,transmission,body_style,fuel_type),
        dtcs:job_dtc_codes(id,code,description)`)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }

  async getJob(id: string) {
    const { data, error } = await this.supabase
      .from('jobs')
      .select(`*,customer:customers(*),vehicle:vehicles(*),dtcs:job_dtc_codes(*),
        repair:repair_records!repair_records_job_id_fkey(*,items:repair_items(*)),photos:job_photos(*)`)
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  }

  async createJob(input: {
    customer: { fullName: string; phone?: string | null; email?: string | null }
    vehicle: Record<string, unknown>
    bay?: string | null
  }) {
    const shopId = this.profile.shop_id
    const { data: customer, error: customerError } = await this.supabase.from('customers').insert({
      shop_id: shopId,
      full_name: input.customer.fullName,
      phone: input.customer.phone || null,
      email: input.customer.email || null,
      created_by: this.profile.id,
    }).select().single()
    if (customerError) throw customerError

    const vehicleInput = input.vehicle as Record<string, string | number | null | undefined>
    const { data: vehicle, error: vehicleError } = await this.supabase.from('vehicles').insert({
      shop_id: shopId,
      customer_id: customer.id,
      vin: vehicleInput.vin || null,
      year: vehicleInput.year,
      make: vehicleInput.make,
      model: vehicleInput.model,
      mileage: vehicleInput.mileage ?? null,
      engine: vehicleInput.engine || null,
      trim: vehicleInput.trim || null,
      drivetrain: vehicleInput.drivetrain || null,
      transmission: vehicleInput.transmission || null,
      body_style: vehicleInput.bodyStyle || null,
      fuel_type: vehicleInput.fuelType || null,
      created_by: this.profile.id,
    }).select().single()
    if (vehicleError) throw vehicleError

    const { data: job, error: jobError } = await this.supabase.from('jobs').insert({
      shop_id: shopId,
      vehicle_id: vehicle.id,
      customer_id: customer.id,
      stage: 'assessment',
      bay: input.bay || null,
      assigned_to: this.profile.id,
      created_by: this.profile.id,
    }).select().single()
    if (jobError) throw jobError
    return this.getJob(job.id)
  }

  async updateJobDetails(jobId: string, input: {
    customer: { fullName: string; phone?: string | null; email?: string | null }
    vehicle: Record<string, unknown>
    bay?: string | null
  }) {
    const { data: job, error: jobError } = await this.supabase
      .from('jobs')
      .select('id,customer_id,vehicle_id,stage')
      .eq('id', jobId)
      .single()
    if (jobError) throw jobError
    const vehicleInput = input.vehicle as Record<string, string | number | null | undefined>

    // Imported or partially-created jobs can legitimately have no customer yet.
    // Create that relationship on first save instead of attempting to update a
    // null UUID, which PostgREST rejects.
    let customerId = job.customer_id
    if (customerId) {
      const { error } = await this.supabase.from('customers').update({
        full_name: input.customer.fullName,
        phone: input.customer.phone || null,
        email: input.customer.email || null,
      }).eq('id', customerId).eq('shop_id', this.profile.shop_id)
      if (error) throw error
    } else {
      const { data: customer, error } = await this.supabase.from('customers').insert({
        shop_id: this.profile.shop_id,
        full_name: input.customer.fullName,
        phone: input.customer.phone || null,
        email: input.customer.email || null,
        created_by: this.profile.id,
      }).select('id').single()
      if (error) throw error
      customerId = customer.id
    }

    const { error: vehicleError } = await this.supabase.from('vehicles').update({
        vin: vehicleInput.vin || null,
        year: vehicleInput.year,
        make: vehicleInput.make,
        model: vehicleInput.model,
        mileage: vehicleInput.mileage ?? null,
        engine: vehicleInput.engine || null,
        trim: vehicleInput.trim || null,
        drivetrain: vehicleInput.drivetrain || null,
        transmission: vehicleInput.transmission || null,
        body_style: vehicleInput.bodyStyle || null,
        fuel_type: vehicleInput.fuelType || null,
      }).eq('id', job.vehicle_id).eq('shop_id', this.profile.shop_id)
    if (vehicleError) throw vehicleError

    const { error: updateJobError } = await this.supabase.from('jobs').update({
      bay: input.bay || null,
      customer_id: customerId,
      stage: job.stage === 'vehicle' ? 'assessment' : job.stage,
    }).eq('id', jobId).eq('shop_id', this.profile.shop_id)
    if (updateJobError) throw updateJobError
    return this.getJob(jobId)
  }

  async archiveJob(jobId: string) {
    const { error } = await this.supabase
      .from('jobs')
      .update({ status: 'cancelled' })
      .eq('id', jobId)
      .eq('shop_id', this.profile.shop_id)
    if (error) throw error
    return this.getJob(jobId)
  }

  // Un-cancels a job. `stage` is left untouched by archiveJob, so the job
  // resumes exactly where it was cancelled (e.g. back at the repair step)
  // with whatever assessment/repair data was already saved.
  async restoreJob(jobId: string) {
    const { error } = await this.supabase
      .from('jobs')
      .update({ status: 'open' })
      .eq('id', jobId)
      .eq('shop_id', this.profile.shop_id)
      .eq('status', 'cancelled')
    if (error) throw error
    return this.getJob(jobId)
  }

  // Hard delete. jobs -> job_dtc_codes/repair_records/job_photos all cascade
  // via FK (repair_records -> repair_steps/repair_items cascade further).
  // vehicles/customers are NOT touched (jobs.vehicle_id is ON DELETE RESTRICT
  // and customer_id is ON DELETE SET NULL) since they may be shared with
  // other jobs for the same car/customer.
  async purgeJob(jobId: string) {
    const { error } = await this.supabase
      .from('jobs')
      .delete()
      .eq('id', jobId)
      .eq('shop_id', this.profile.shop_id)
      .eq('status', 'cancelled')
    if (error) throw error
  }

  async saveAssessment(jobId: string, input: { complaint: string; observations?: string | null; dtcs: string[]; nextStage: string; summary?: string | null }) {
    const { error } = await this.supabase.from('jobs').update({
      complaint: input.complaint,
      observations: input.observations || null,
      summary: input.summary || null,
      stage: input.nextStage,
    }).eq('id', jobId)
    if (error) throw error
    const { error: deleteError } = await this.supabase.from('job_dtc_codes').delete().eq('job_id', jobId)
    if (deleteError) throw deleteError
    if (input.dtcs.length) {
      const { error: insertError } = await this.supabase.from('job_dtc_codes').insert(input.dtcs.map((code) => ({
        shop_id: this.profile.shop_id, job_id: jobId, code,
      })))
      if (insertError) throw insertError
    }
    return this.getJob(jobId)
  }

  async getMatches(jobId: string) {
    const { data, error } = await this.supabase.rpc('find_similar_repairs', { target_job_id: jobId })
    if (error) throw error
    if (!data?.length) return []
    const repairIds = data.map((row: { repair_id: string }) => row.repair_id)
    const { data: details, error: detailsError } = await this.supabase
      .from('repair_records')
      .select('id,items:repair_items(*)')
      .in('id', repairIds)
    if (detailsError) throw detailsError
    const detailMap = new Map((details ?? []).map((row) => [row.id, row]))
    const insightsByRepair = await this.getMatchInsights(jobId, data.slice(0, 2))
    return data.map((row: { repair_id: string; evidence: string[] }) => ({
      ...row,
      ...detailMap.get(row.repair_id),
      evidence: this.ensureMinEvidence([...(row.evidence ?? []), ...(insightsByRepair.get(row.repair_id) ?? [])]),
    }))
  }

  // Weak candidates can surface with fewer than 2 SQL/AI reasons (e.g. no
  // fault code overlap and no specific AI insight). The checklist UI reads
  // oddly with a single bullet, so pad with generic reasons to keep 2 minimum.
  private ensureMinEvidence(evidence: string[]) {
    const fallbacks = ['Ranked among closest matches', 'Similar overall repair profile']
    const result = [...evidence]
    for (const fallback of fallbacks) {
      if (result.length >= 2) break
      if (!result.includes(fallback)) result.push(fallback)
    }
    return result
  }

  // AI-authored reasons (e.g. "Similar warm-idle symptoms") are cached per
  // (job, repair) pairing in repair_match_insights, computed only for the
  // top-ranked candidates and only on first view.
  private async getMatchInsights(
    jobId: string,
    topCandidates: Array<{ repair_id: string; cause: string | null; work_performed: string | null }>,
  ) {
    const result = new Map<string, string[]>()
    if (!topCandidates.length) return result
    const { data: job, error: jobError } = await this.supabase.from('jobs').select('complaint,observations').eq('id', jobId).single()
    if (jobError || !job?.complaint) return result
    const repairIds = topCandidates.map((row) => row.repair_id)
    const { data: cached } = await this.supabase
      .from('repair_match_insights')
      .select('repair_id,insights')
      .eq('job_id', jobId)
      .in('repair_id', repairIds)
    const cachedMap = new Map((cached ?? []).map((row) => [row.repair_id, row.insights as string[]]))
    for (const row of cachedMap) result.set(row[0], row[1])

    const uncached = topCandidates.filter((row) => !cachedMap.has(row.repair_id))
    if (!uncached.length) return result

    await Promise.all(uncached.map(async (row) => {
      const insights = await generateMatchInsights(job.complaint, job.observations, row.cause, row.work_performed)
      result.set(row.repair_id, insights)
      if (insights.length) {
        await this.supabase.from('repair_match_insights').insert({
          job_id: jobId,
          repair_id: row.repair_id,
          shop_id: this.profile.shop_id,
          insights,
        })
      }
    }))
    return result
  }

  async saveRepair(jobId: string, input: {
    workPerformed: string; verificationNotes?: string | null; referenceRepairId?: string | null
    dtcs: string[]; items: Array<Record<string, unknown>>; resolve: boolean
  }) {
    // repair_records.cause holds an AI-generated summary of work_performed +
    // verification_notes, not a mechanic-entered diagnosis -- there's no UI
    // for the latter. Only (re)generated at completion time so drafts don't
    // burn API calls on text that's still being edited.
    const repairSummary = input.resolve ? await generateRepairSummary(input.workPerformed, input.verificationNotes) : null
    const repairPayload = {
      shop_id: this.profile.shop_id,
      job_id: jobId,
      cause: repairSummary,
      work_performed: input.workPerformed || null,
      verification_notes: input.verificationNotes || null,
      reference_repair_id: input.referenceRepairId || null,
      verified: input.resolve,
      completed_by: input.resolve ? this.profile.id : null,
    }
    const { data: repair, error } = await this.supabase.from('repair_records').upsert(repairPayload, { onConflict: 'job_id' }).select().single()
    if (error) throw error

    await Promise.all([
      // repair_steps is no longer written to (see comment above) -- this
      // clears out any synthetic steps a previous save may have left behind.
      this.supabase.from('repair_steps').delete().eq('repair_id', repair.id),
      this.supabase.from('repair_items').delete().eq('repair_id', repair.id),
      this.supabase.from('job_dtc_codes').delete().eq('job_id', jobId),
    ]).then((results) => results.forEach(({ error: nestedError }) => { if (nestedError) throw nestedError }))

    if (input.dtcs.length) {
      const { error: dtcError } = await this.supabase.from('job_dtc_codes').insert(input.dtcs.map((code) => ({
        shop_id: this.profile.shop_id,
        job_id: jobId,
        code,
      })))
      if (dtcError) throw dtcError
    }

    if (input.items.length) {
      const { error: itemsError } = await this.supabase.from('repair_items').insert(input.items.map((item) => ({
        shop_id: this.profile.shop_id,
        repair_id: repair.id,
        kind: item.kind,
        name: item.name,
        part_number: item.partNumber || null,
        brand: item.brand || null,
        quantity: item.quantity,
        unit: item.unit || null,
        supplier: item.supplier || null,
        price_amount: item.priceAmount ?? null,
        currency: item.currency || 'AUD',
        offer_url: item.offerUrl || null,
        offer_image_url: item.offerImageUrl || null,
      })))
      if (itemsError) throw itemsError
    }
    const { error: jobError } = await this.supabase.from('jobs').update({
      stage: input.resolve ? 'resolved' : 'repair',
      status: input.resolve ? 'resolved' : 'open',
      resolved_at: input.resolve ? new Date().toISOString() : null,
      selected_reference_id: input.referenceRepairId || null,
    }).eq('id', jobId)
    if (jobError) throw jobError
    return this.getJob(jobId)
  }

  async listVehicleProfiles() {
    const { data, error } = await this.supabase.rpc('list_vehicle_profiles')
    if (error) throw error
    return data ?? []
  }

  async getVehicleProfile(profileId: string) {
    const { data: profile, error: profileError } = await this.supabase
      .from('vehicle_profiles')
      .select('id,make,model,created_at,updated_at')
      .eq('id', profileId)
      .single()
    if (profileError) throw profileError

    const [notes, insights, repairs] = await Promise.all([
      this.listProfileNotes(profileId),
      this.getProfileMileageInsights(profileId),
      this.listProfileRepairs(profileId),
    ])
    return { profile, notes, insights, repairs }
  }

  async listProfileNotes(profileId: string) {
    const { data, error } = await this.supabase
      .from('vehicle_profile_notes')
      .select('id,body,vehicle_year,vehicle_trim,vehicle_transmission,vehicle_mileage,source_job_id,created_at,author:profiles(id,full_name)')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    return data ?? []
  }

  async getProfileMileageInsights(profileId: string) {
    const { data, error } = await this.supabase.rpc('vehicle_profile_mileage_insights', {
      target_profile_id: profileId,
    })
    if (error) throw error
    return data ?? []
  }

  // Selected in the same shape as listJobs() so the UI can map these through
  // the one job-card renderer instead of a second bespoke card.
  async listProfileRepairs(profileId: string) {
    const { data, error } = await this.supabase
      .from('jobs')
      .select(`id,job_number,status,stage,bay,complaint,observations,summary,selected_reference_id,created_at,updated_at,resolved_at,
        customer:customers(id,full_name,phone,email),
        vehicle:vehicles!inner(id,vin,year,make,model,mileage,engine,trim,drivetrain,transmission,body_style,fuel_type,profile_id),
        dtcs:job_dtc_codes(id,code,description),
        repair:repair_records!repair_records_job_id_fkey(*,items:repair_items(*))`)
      .eq('vehicle.profile_id', profileId)
      .eq('status', 'resolved')
      .order('resolved_at', { ascending: false, nullsFirst: false })
      .limit(100)
    if (error) throw error
    return data ?? []
  }

  async addProfileNote(profileId: string, input: {
    body: string
    vehicleYear?: number | null
    vehicleTrim?: string | null
    vehicleTransmission?: string | null
    vehicleMileage?: number | null
    sourceJobId?: string | null
  }) {
    const { data, error } = await this.supabase.from('vehicle_profile_notes').insert({
      shop_id: this.profile.shop_id,
      profile_id: profileId,
      body: input.body,
      vehicle_year: input.vehicleYear ?? null,
      vehicle_trim: input.vehicleTrim || null,
      vehicle_transmission: input.vehicleTransmission || null,
      vehicle_mileage: input.vehicleMileage ?? null,
      source_job_id: input.sourceJobId || null,
      created_by: this.profile.id,
    }).select('id,body,vehicle_year,vehicle_trim,vehicle_transmission,vehicle_mileage,source_job_id,created_at,author:profiles(id,full_name)').single()
    if (error) throw error
    return data
  }

  async deleteProfileNote(profileId: string, noteId: string) {
    const { error } = await this.supabase
      .from('vehicle_profile_notes')
      .delete()
      .eq('id', noteId)
      .eq('profile_id', profileId)
    if (error) throw error
  }

  // Resolves the profile bucket for an ad-hoc vehicle identity so a note can be
  // filed before that car has ever been through the shop.
  async resolveVehicleProfile(input: { make: string; model: string }) {
    const { data, error } = await this.supabase.rpc('ensure_vehicle_profile', {
      target_shop_id: this.profile.shop_id,
      target_make: input.make,
      target_model: input.model,
      target_created_by: this.profile.id,
    })
    if (error) throw error
    return data as string | null
  }
}
