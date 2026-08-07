import { NextRequest, NextResponse } from 'next/server'
import { decodeVin } from '@/lib/nhtsa'

export async function GET(req: NextRequest) {
  const vin = req.nextUrl.searchParams.get('vin')
  if (!vin || vin.length !== 17) {
    return NextResponse.json({ error: 'VIN must be 17 characters' }, { status: 400 })
  }

  try {
    const result = await decodeVin(vin)
    if (result.error) return NextResponse.json({ error: result.error }, { status: 404 })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Failed to decode VIN' }, { status: 500 })
  }
}
