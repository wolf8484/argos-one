import { createHash } from 'node:crypto'

/**
 * The device's own identity, independent of who is signed in on it.
 *
 * A long-lived opaque token minted by the proxy and kept in an httpOnly cookie,
 * so it survives sign-out -- which is the entire point. Branch selection used
 * to be keyed on the GoTrue session (0050) and therefore died at every logout;
 * this outlives logins, so a workshop tablet can be told once what branch it
 * sits in and never ask again.
 */
export const DEVICE_COOKIE = 'argos_device'

/** Five years. A tablet bolted to a workbench should never quietly forget. */
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 5

/** Header PostgREST hands to current_device_hash(). Lowercase deliberately. */
export const DEVICE_HEADER = 'x-argos-device'

/**
 * Postgres only ever sees the hash. Nothing in the database can be replayed as
 * a working cookie, so a leaked backup does not hand anyone a registered
 * device -- and the comparison stays a plain string match, which keeps
 * current_shop_id() free of any crypto extension.
 */
export function hashDeviceToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function deviceHeaders(token: string | undefined): Record<string, string> {
  return token ? { [DEVICE_HEADER]: hashDeviceToken(token) } : {}
}
