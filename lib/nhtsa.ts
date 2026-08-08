import { VinDecodeResult, NhtsaResponse } from '@/types'

export async function decodeVin(vin: string): Promise<VinDecodeResult> {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin.trim()}?format=json`

  const res = await fetch(url, { next: { revalidate: 86400 } })
  if (!res.ok) throw new Error('NHTSA API unavailable')

  const data: NhtsaResponse = await res.json()

  const get = (name: string) =>
    data.Results.find((r) => r.Variable === name)?.Value ?? ''

  const make = get('Make')
  const model = get('Model')
  const year = get('Model Year')
  const engine = [get('Displacement (L)'), get('Engine Number of Cylinders')]
    .filter(Boolean)
    .map((v, i) => (i === 0 ? `${v}L` : `${v}-cyl`))
    .join(' ')
  const trim = get('Trim')
  const bodyStyle = get('Body Class')
  const fuelType = get('Fuel Type - Primary')

  // Make + Year come from the WMI prefix and are present for any real VIN.
  // Model/engine/trim require detailed records NHTSA lacks for many
  // non-US-market vehicles (common in Australia) — so they're optional, and a
  // missing Model is flagged as a partial decode rather than a failure.
  if (!make || !year) {
    const errorText = get('Error Text') || 'This VIN could not be decoded'
    return { make: '', model: '', year: '', engine: '', trim: '', bodyStyle: '', fuelType: '', error: errorText }
  }

  return { make, model, year, engine, trim, bodyStyle, fuelType, partial: !model }
}
