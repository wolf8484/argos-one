import { randomInt } from 'node:crypto'

export { formatPhoneForDisplay, isEmailIdentifier, normalizeInviteCode, normalizePhone } from '@/lib/identity'

// O/0 and I/1 are left out: these codes get read aloud across a workshop floor
// or written on paper, where those pairs are indistinguishable.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Six characters as XXXX-XX, e.g. A7K9-Q2. ~1.07 billion combinations. */
export function generateInviteCode() {
  const pick = () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  const body = Array.from({ length: 6 }, pick)
  return `${body.slice(0, 4).join('')}-${body.slice(4).join('')}`
}
