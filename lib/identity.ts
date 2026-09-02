// Browser-safe identity helpers. Kept free of node: imports because the login
// and join screens are client components -- code *generation* lives in
// lib/server/identity.ts, which needs node:crypto.

export function normalizeInviteCode(raw: string) {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (cleaned.length !== 6) return null
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`
}

/**
 * Australian mobiles as typed on the shop floor ("0412 345 678", "0412345678")
 * into the E.164 form Supabase auth requires. Already-international input is
 * passed through so an overseas number still works.
 */
export function normalizePhone(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const digits = trimmed.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) {
    return /^\+\d{8,15}$/.test(digits) ? digits : null
  }
  const local = digits.replace(/\D/g, '')
  if (/^0\d{9}$/.test(local)) return `+61${local.slice(1)}`
  if (/^61\d{9}$/.test(local)) return `+${local}`
  if (/^\d{9}$/.test(local)) return `+61${local}`
  return null
}

/** Display form for a stored E.164 AU mobile: +61412345678 -> 0412 345 678 */
export function formatPhoneForDisplay(e164: string | null | undefined) {
  if (!e164) return ''
  const match = /^\+61(\d{9})$/.exec(e164)
  if (!match) return e164
  const digits = match[1]
  return `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
}

/**
 * The sign-in field accepts either identifier, so the login form has to decide
 * which Supabase credential to send. Anything containing "@" is treated as an
 * email; everything else is tried as a phone number.
 */
export function isEmailIdentifier(value: string) {
  return value.includes('@')
}

/**
 * Supabase's password-based phone sign-in requires a live SMS provider
 * (Twilio) to be configured on the project, purely to satisfy a login-method
 * toggle we never actually use for sending anything. Staff who join with only
 * a mobile number are instead authenticated under a deterministic placeholder
 * email derived from their number, so the real "identifier" the app shows is
 * still just the phone -- this address never appears anywhere in the UI.
 */
export function staffAuthEmail(e164Phone: string) {
  return `${e164Phone.replace(/^\+/, '')}@staff.argosone.internal`
}
