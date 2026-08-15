import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'

import { requireWorkshopUser } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'

type RouteContext = { params: Promise<{ id: string }> }
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id: jobId } = await context.params
    const { data: photos, error } = await auth.supabase
      .from('job_photos')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })
    if (error) throw error

    const signedPhotos = await Promise.all((photos ?? []).map(async (photo) => {
      const { data: signed, error: signedError } = await auth.supabase.storage
        .from('job-photos')
        .createSignedUrl(photo.storage_path, 3600)
      if (signedError) throw signedError
      return { ...photo, url: signed.signedUrl }
    }))

    return NextResponse.json({ photos: signedPhotos })
  } catch (error) {
    return apiError(error, 'Could not load photos')
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id: jobId } = await context.params
    const form = await request.formData()
    const file = form.get('file')
    const kind = String(form.get('kind') || 'arrival')
    const repairId = String(form.get('repairId') || '') || null
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: 'Photo is required' }, { status: 400 })
    if (!allowedTypes.has(file.type) || file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'Use a JPG, PNG, WebP or HEIC image up to 15 MB' }, { status: 400 })
    }
    if (!['arrival', 'repair', 'verification'].includes(kind)) return NextResponse.json({ error: 'Invalid photo type' }, { status: 400 })
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `${auth.profile.shop_id}/${jobId}/${kind}/${randomUUID()}.${extension}`
    const { error: uploadError } = await auth.supabase.storage.from('job-photos').upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) throw uploadError
    const { data: photo, error: photoError } = await auth.supabase.from('job_photos').insert({
      shop_id: auth.profile.shop_id, job_id: jobId, repair_id: repairId, kind, storage_path: path,
      mime_type: file.type, size_bytes: file.size, created_by: auth.profile.id,
    }).select().single()
    if (photoError) {
      await auth.supabase.storage.from('job-photos').remove([path])
      throw photoError
    }
    const { data: signed, error: signedError } = await auth.supabase.storage.from('job-photos').createSignedUrl(path, 3600)
    if (signedError) throw signedError
    return NextResponse.json({ photo: { ...photo, url: signed.signedUrl } }, { status: 201 })
  } catch (error) {
    return apiError(error, 'Could not upload photo')
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireWorkshopUser()
  if ('error' in auth) return auth.error
  try {
    const { id: jobId } = await context.params
    const photoId = request.nextUrl.searchParams.get('photoId')
    if (!photoId) return NextResponse.json({ error: 'Photo id is required' }, { status: 400 })
    const { data: photo, error: findError } = await auth.supabase.from('job_photos').select('storage_path').eq('id', photoId).eq('job_id', jobId).single()
    if (findError) throw findError
    const { error: storageError } = await auth.supabase.storage.from('job-photos').remove([photo.storage_path])
    if (storageError) throw storageError
    const { error: deleteError } = await auth.supabase.from('job_photos').delete().eq('id', photoId)
    if (deleteError) throw deleteError
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return apiError(error, 'Could not delete photo')
  }
}
