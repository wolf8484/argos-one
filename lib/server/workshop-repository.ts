import type { SupabaseClient } from '@supabase/supabase-js'

import { generateMatchInsights } from '@/lib/server/repair-match-insights'
import { hashPatternSource, summarizeNetworkPattern } from '@/lib/server/network-summary'
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
      // The two repair_records embeds are disambiguated by foreign-key column
      // rather than by constraint name: the self-reference resolves to an
      // auto-generated constraint name that PostgREST's schema cache drops
      // after unrelated DDL, which turned this read into a PGRST200 500.
      .select(`*,customer:customers(*),vehicle:vehicles(*),dtcs:job_dtc_codes(*),
        repair:repair_records!job_id(*,items:repair_items(*),reference:repair_records!reference_repair_id(job_id)),photos:job_photos(*)`)
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
      const decoded = await this.decodeDtcCodes(input.dtcs)
      const { error: insertError } = await this.supabase.from('job_dtc_codes').insert(input.dtcs.map((code) => ({
        shop_id: this.profile.shop_id, job_id: jobId, code,
        description: decoded.get(code.trim().toUpperCase())?.description ?? null,
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

    // The matched job's own complaint/observations/DTCs -- find_similar_repairs
    // only ever returned the matched repair's cause/work_performed/verification,
    // so the match card had a fix with no problem to judge it against.
    const jobIds = [...new Set(data.map((row: { job_id: string }) => row.job_id).filter(Boolean))]
    const { data: matchedJobs, error: jobsError } = await this.supabase
      .from('jobs')
      .select('id,complaint,observations,dtcs:job_dtc_codes(code)')
      .in('id', jobIds)
    if (jobsError) throw jobsError
    const jobMap = new Map((matchedJobs ?? []).map((row) => [row.id, row]))

    const insightsByRepair = await this.getMatchInsights(jobId, data.slice(0, 2))
    return data.map((row: { repair_id: string; job_id: string; evidence: string[] }) => {
      const matchedJob = jobMap.get(row.job_id) as { complaint: string | null; observations: string | null; dtcs: Array<{ code: string }> } | undefined
      return {
        ...row,
        ...detailMap.get(row.repair_id),
        complaint: matchedJob?.complaint ?? null,
        observations: matchedJob?.observations ?? null,
        dtcs: (matchedJob?.dtcs ?? []).map((d) => d.code),
        evidence: this.ensureMinEvidence([...(row.evidence ?? []), ...(insightsByRepair.get(row.repair_id) ?? [])]),
      }
    })
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
    system?: string | null
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
      system: input.system || null,
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
      const decoded = await this.decodeDtcCodes(input.dtcs)
      const { error: dtcError } = await this.supabase.from('job_dtc_codes').insert(input.dtcs.map((code) => ({
        shop_id: this.profile.shop_id,
        job_id: jobId,
        code,
        description: decoded.get(code.trim().toUpperCase())?.description ?? null,
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

    // Resolving a job changes what this shop contributes to the network.
    // Best-effort: a failure here must not fail the mechanic's save, and the
    // function is a no-op for shops that have not opted into sharing.
    if (input.resolve) {
      const { error: networkError } = await this.supabase.rpc('refresh_network_contributions')
      if (networkError) console.error('refresh_network_contributions failed', networkError)
    }
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

    const [notes, repairGroups, repairs, recalls, complaintTrends, networkPatterns] = await Promise.all([
      this.listProfileNotes(profileId),
      this.getProfileRepairGroups(profileId),
      this.listProfileRepairs(profileId),
      this.getMatchingRecalls(profile.make, profile.model),
      this.getComplaintTrends(profile.make, profile.model),
      this.getNetworkRepairPatterns(profile.make, profile.model),
    ])
    return { profile, notes, repairGroups, repairs, recalls, complaintTrends, networkPatterns }
  }

  async listProfileNotes(profileId: string) {
    const { data, error } = await this.supabase
      .from('vehicle_profile_notes')
      .select('id,body,vehicle_year,vehicle_trim,vehicle_transmission,vehicle_mileage,source_job_id,created_at,updated_at,author:profiles(id,full_name)')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    return data ?? []
  }

  // Verified repairs for this profile, grouped by system. Supersedes the
  // older vehicle_profile_mileage_insights RPC, which bucketed by mileage
  // band instead -- mileage is now a detail on each row.
  async getProfileRepairGroups(profileId: string) {
    const { data, error } = await this.supabase.rpc('vehicle_profile_repair_groups', {
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
    }).select('id,body,vehicle_year,vehicle_trim,vehicle_transmission,vehicle_mileage,source_job_id,created_at,updated_at,author:profiles(id,full_name)').single()
    if (error) throw error
    return data
  }

  async updateProfileNote(profileId: string, noteId: string, body: string) {
    const { data, error } = await this.supabase
      .from('vehicle_profile_notes')
      .update({ body, updated_at: new Date().toISOString() })
      .eq('id', noteId)
      .eq('profile_id', profileId)
      .select('id,body,vehicle_year,vehicle_trim,vehicle_transmission,vehicle_mileage,source_job_id,created_at,updated_at,author:profiles(id,full_name)')
      .single()
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

  private static readonly SHOP_COLUMNS =
    'id,name,timezone,shares_repair_data,network_read_exempt,branch_id,region,preferred_supplier,default_bay_id,default_technician_id,auto_assign_jobs'

  async getShop() {
    const { data, error } = await this.supabase
      .from('shops')
      .select(WorkshopRepository.SHOP_COLUMNS)
      .eq('id', this.profile.shop_id)
      .single()
    if (error) throw error
    return data
  }

  async updateShop(input: {
    sharesRepairData?: boolean
    name?: string
    branchId?: string | null
    region?: string
    timezone?: string
    preferredSupplier?: string | null
    defaultBayId?: string | null
    defaultTechnicianId?: string | null
    autoAssignJobs?: boolean
  }) {
    const patch: Record<string, unknown> = {}
    if (input.sharesRepairData !== undefined) patch.shares_repair_data = input.sharesRepairData
    if (input.name !== undefined) patch.name = input.name
    if (input.branchId !== undefined) patch.branch_id = input.branchId
    if (input.region !== undefined) patch.region = input.region
    if (input.timezone !== undefined) patch.timezone = input.timezone
    if (input.preferredSupplier !== undefined) patch.preferred_supplier = input.preferredSupplier
    if (input.defaultBayId !== undefined) patch.default_bay_id = input.defaultBayId
    if (input.defaultTechnicianId !== undefined) patch.default_technician_id = input.defaultTechnicianId
    if (input.autoAssignJobs !== undefined) patch.auto_assign_jobs = input.autoAssignJobs
    if (!Object.keys(patch).length) return this.getShop()

    const { data, error } = await this.supabase
      .from('shops')
      .update(patch)
      .eq('id', this.profile.shop_id)
      .select(WorkshopRepository.SHOP_COLUMNS)
      .single()
    if (error) throw error
    return data
  }

  async listBays() {
    const { data, error } = await this.supabase
      .from('shop_bays')
      .select('id,name,description,position,active,created_at,updated_at')
      .order('position')
      .order('name')
    if (error) throw error
    return data ?? []
  }

  async addBay(input: { name: string; description?: string | null; active?: boolean }) {
    // New bays land at the end of the list rather than jumping to the top.
    const { data: last } = await this.supabase
      .from('shop_bays')
      .select('position')
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data, error } = await this.supabase
      .from('shop_bays')
      .insert({
        shop_id: this.profile.shop_id,
        name: input.name,
        description: input.description ?? null,
        active: input.active ?? true,
        position: (last?.position ?? 0) + 1,
      })
      .select('id,name,description,position,active,created_at,updated_at')
      .single()
    if (error) throw error
    return data
  }

  async updateBay(bayId: string, input: { name?: string; description?: string | null; active?: boolean }) {
    const patch: Record<string, unknown> = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.description !== undefined) patch.description = input.description
    if (input.active !== undefined) patch.active = input.active

    const { data, error } = await this.supabase
      .from('shop_bays')
      .update(patch)
      .eq('id', bayId)
      .select('id,name,description,position,active,created_at,updated_at')
      .single()
    if (error) throw error
    return data
  }

  async deleteBay(bayId: string) {
    const { error } = await this.supabase.from('shop_bays').delete().eq('id', bayId)
    if (error) throw error
  }

  async listTechnicians() {
    const { data, error } = await this.supabase
      .from('shop_technicians')
      .select('id,profile_id,first_name,last_name,initials,employee_id,role,active,default_bay_id,position,created_at,updated_at')
      .order('position')
      .order('first_name')
    if (error) throw error
    return data ?? []
  }

  async addTechnician(input: {
    firstName: string
    lastName?: string | null
    initials?: string | null
    employeeId?: string | null
    role?: string
    active?: boolean
    defaultBayId?: string | null
  }) {
    const { data: last } = await this.supabase
      .from('shop_technicians')
      .select('position')
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data, error } = await this.supabase
      .from('shop_technicians')
      .insert({
        shop_id: this.profile.shop_id,
        first_name: input.firstName,
        last_name: input.lastName ?? null,
        initials: input.initials || WorkshopRepository.deriveInitials(input.firstName, input.lastName),
        employee_id: input.employeeId ?? null,
        role: input.role ?? 'technician',
        active: input.active ?? true,
        default_bay_id: input.defaultBayId ?? null,
        position: (last?.position ?? 0) + 1,
      })
      .select('id,profile_id,first_name,last_name,initials,employee_id,role,active,default_bay_id,position,created_at,updated_at')
      .single()
    if (error) throw error
    return data
  }

  async updateTechnician(technicianId: string, input: {
    firstName?: string
    lastName?: string | null
    initials?: string | null
    employeeId?: string | null
    role?: string
    active?: boolean
    defaultBayId?: string | null
  }) {
    const patch: Record<string, unknown> = {}
    if (input.firstName !== undefined) patch.first_name = input.firstName
    if (input.lastName !== undefined) patch.last_name = input.lastName
    if (input.initials !== undefined) patch.initials = input.initials
    if (input.employeeId !== undefined) patch.employee_id = input.employeeId
    if (input.role !== undefined) patch.role = input.role
    if (input.active !== undefined) patch.active = input.active
    if (input.defaultBayId !== undefined) patch.default_bay_id = input.defaultBayId

    const { data, error } = await this.supabase
      .from('shop_technicians')
      .update(patch)
      .eq('id', technicianId)
      .select('id,profile_id,first_name,last_name,initials,employee_id,role,active,default_bay_id,position,created_at,updated_at')
      .single()
    if (error) throw error
    return data
  }

  async deleteTechnician(technicianId: string) {
    const { error } = await this.supabase.from('shop_technicians').delete().eq('id', technicianId)
    if (error) throw error
  }

  private static deriveInitials(firstName: string, lastName?: string | null) {
    return `${firstName.trim().charAt(0)}${(lastName ?? '').trim().charAt(0)}`.toUpperCase() || null
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

  // Recalls are global reference data (not shop-scoped) matched at
  // make/model, optionally narrowed by a single year falling inside the
  // recall's [year_from, year_to] range. A profile pools multiple model
  // years, so the profile page calls this without a year and shows every
  // recall for that make/model regardless of year range.
  //
  // The recall's `model` text comes straight from the regulator's free-text
  // recall title (e.g. "Camry Ascent & Ascent Sport AXVH80R"), not a bare
  // model name like the profile's "Camry" -- so this matches model as a
  // prefix rather than requiring an exact match.
  async getMatchingRecalls(make: string, model: string, year?: number | null) {
    const escapedModel = model.replace(/[%_]/g, (char) => `\\${char}`)
    let query = this.supabase
      .from('recalls')
      .select('id,make,model,year_from,year_to,defect_description,remedy,source_url,recall_date')
      .ilike('make', make)
      .ilike('model', `${escapedModel}%`)
      .order('recall_date', { ascending: false, nullsFirst: false })
    if (year) {
      query = query.or(`year_from.is.null,year_from.lte.${year}`).or(`year_to.is.null,year_to.gte.${year}`)
    }
    const { data, error } = await query
    if (error) throw error
    return data ?? []
  }

  // Anonymised repair patterns from other shops on the platform, grouped by
  // trim -- a mechanic already knows the exact trim in front of them, so a
  // pattern is only useful narrowed to it. Returns nothing unless this shop
  // has opted into sharing (reciprocity) or is read-exempt -- enforced
  // inside the SQL function, not here, so the UI cannot bypass it. There is
  // deliberately no minimum-contributing-shops floor: no shop identity, and
  // no shop count, is ever exposed to the reader. Never merged into
  // getProfileRepairGroups: this shop's own "Common symptoms & repairs"
  // stays its own verified work only.
  async getNetworkRepairPatterns(make: string, model: string) {
    const { data, error } = await this.supabase.rpc('network_repair_patterns', {
      target_make: make,
      target_model: model,
    })
    if (error) throw error
    const rows = (data ?? []) as Array<{
      system: string; label: string; vehicle_trim: string | null; occurrences: number; shop_count: number
      symptoms: string[] | null; repairs: string[] | null
    }>
    if (!rows.length) return []

    // One card per label, not just the top label per system: a rare fault
    // is exactly the kind of thing nobody remembers, so it can't be the
    // one that gets hidden. Cards nest under a system accordion the same
    // way the shop's own "Common symptoms & repairs" does.
    const summarizedRows = await Promise.all(rows.map(async (row) => {
      const symptoms = row.symptoms ?? []
      const repairs = row.repairs ?? []
      const sourceHash = hashPatternSource(row.label, symptoms, repairs)
      // network_pattern_summaries keys on trim too (0039) -- two different
      // trims can share the same system+label, and without trim in the key
      // they'd overwrite each other's cached summary.
      const trimKey = row.vehicle_trim ?? ''

      const { data: cached } = await this.supabase
        .from('network_pattern_summaries')
        .select('most_common_issue,symptoms_summary,repair_summary,source_hash')
        .eq('make', make).eq('model', model).eq('trim', trimKey).eq('system', row.system).eq('label', row.label)
        .maybeSingle()

      const summary = cached && cached.source_hash === sourceHash
        ? { mostCommonIssue: cached.most_common_issue, symptomsSummary: cached.symptoms_summary, repairSummary: cached.repair_summary }
        : await summarizeNetworkPattern({ label: row.label, symptoms, repairs })

      if (!cached || cached.source_hash !== sourceHash) {
        await this.supabase.from('network_pattern_summaries').upsert({
          make, model, trim: trimKey, system: row.system, label: row.label, source_hash: sourceHash,
          most_common_issue: summary.mostCommonIssue,
          symptoms_summary: summary.symptomsSummary,
          repair_summary: summary.repairSummary,
          updated_at: new Date().toISOString(),
        })
      }

      return {
        system: row.system,
        label: row.label,
        trim: row.vehicle_trim,
        occurrences: row.occurrences,
        shopCount: row.shop_count,
        mostCommonIssue: summary.mostCommonIssue,
        symptomsSummary: summary.symptomsSummary,
        repairSummary: summary.repairSummary,
      }
    }))

    const bySystem = new Map<string, typeof summarizedRows>()
    for (const row of summarizedRows) {
      const list = bySystem.get(row.system) ?? []
      list.push(row)
      bySystem.set(row.system, list)
    }

    return [...bySystem.entries()].map(([system, systemRows]) => ({
      system,
      occurrences: systemRows.reduce((sum, row) => sum + row.occurrences, 0),
      rows: systemRows.sort((a, b) => b.occurrences - a.occurrences),
    })).sort((a, b) => b.occurrences - a.occurrences)
  }

  // Shop-scoped, term-matched search across every profile's repair history
  // (system + fault label) -- lets a search like "Corolla suspension"
  // surface a specific past repair, not just cars whose name matches.
  async searchShopRepairs(query: string) {
    const { data, error } = await this.supabase.rpc('search_shop_repairs', { search_query: query })
    if (error) throw error
    return data ?? []
  }

  // Aggregated NHTSA owner-complaint counts per component, seeded from the
  // makes/models catalog (scripts/seed-complaint-trends.ts) rather than
  // scraped per-shop, so every catalog car has a row set regardless of
  // whether this shop has ever serviced one. Top 5 components by complaint
  // count -- enough to show a genuine pattern without turning into a wall
  // of noise.
  async getComplaintTrends(make: string, model: string) {
    const { data, error } = await this.supabase
      .from('complaint_trends')
      .select('component,complaint_count,sample_summary')
      .ilike('make', make)
      .ilike('model', model)
      .order('complaint_count', { ascending: false })
      .limit(5)
    if (error) throw error
    return data ?? []
  }

  async decodeDtcCode(code: string) {
    const { data, error } = await this.supabase
      .from('dtc_reference')
      .select('code,description,system')
      .eq('code', code.trim().toUpperCase())
      .maybeSingle()
    if (error) throw error
    return data
  }

  async decodeDtcCodes(codes: string[]) {
    const normalized = Array.from(new Set(codes.map((code) => code.trim().toUpperCase()).filter(Boolean)))
    if (!normalized.length) return new Map<string, { code: string; description: string; system: string | null }>()
    const { data, error } = await this.supabase
      .from('dtc_reference')
      .select('code,description,system')
      .in('code', normalized)
    if (error) throw error
    return new Map((data ?? []).map((row) => [row.code, row]))
  }
}
