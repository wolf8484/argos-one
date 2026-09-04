'use client'

import { useState } from 'react'

import { PHONE_INPUT_MAX_LENGTH, formatPhoneInput } from '@/lib/identity'
import styles from './login.module.css'

/**
 * Password input with a reveal toggle. Mechanics type these on a tablet with
 * gloves or dirty hands, where a mistyped password is likely and invisible --
 * being able to check what was typed matters more here than on a desktop.
 */
export const PASSWORD_MIN_LENGTH = 8

export function PasswordField({ name, label, autoComplete, rule }: {
  name: string
  label: string
  autoComplete: string
  /** Shows a live requirement line under the field that ticks green once met. */
  rule?: boolean
}) {
  const [visible, setVisible] = useState(false)
  const [length, setLength] = useState(0)
  const met = length >= PASSWORD_MIN_LENGTH
  return <label>
    {label}
    <span className={styles.passwordControl}>
      <input
        name={name}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        minLength={PASSWORD_MIN_LENGTH}
        onChange={(event) => setLength(event.target.value.length)}
        required
      />
      <button
        type="button"
        className={styles.reveal}
        onClick={() => setVisible(!visible)}
        aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        aria-pressed={visible}
      >
        {visible ? <EyeOff /> : <Eye />}
      </button>
    </span>
    {/* Always on screen, not just once it fails: the requirement is what to do
        next, so hiding it until after a rejected attempt is the wrong moment. */}
    {rule && <span className={met ? `${styles.rule} ${styles.ruleMet}` : styles.rule}>
      <Check />
      At least {PASSWORD_MIN_LENGTH} characters
    </span>}
  </label>
}

/**
 * Phone input that formats and caps as it is typed. Controlled, unlike the
 * other fields here, because the value shown has to be rewritten on each
 * keystroke -- it still submits through FormData by name like the rest.
 */
export function PhoneField({ name, label, defaultValue = '', placeholder, optional, required }: {
  name: string
  label: string
  defaultValue?: string
  placeholder: string
  optional?: boolean
  required?: boolean
}) {
  const [value, setValue] = useState(() => formatPhoneInput(defaultValue))
  return <label>
    <span className={styles.labelText}>
      {label}
      {optional && <span className={styles.optional}>(optional)</span>}
    </span>
    <input
      name={name}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={value}
      onChange={(event) => setValue(formatPhoneInput(event.target.value))}
      placeholder={placeholder}
      maxLength={PHONE_INPUT_MAX_LENGTH}
      required={required}
    />
  </label>
}

export function ReviewRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return <div className={styles.reviewRow}><span>{label}</span><strong>{value}</strong></div>
}

function Check() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="18" height="18">
    <path d="m4 12.5 5.5 5.5L20 6.5" />
  </svg>
}

function Eye() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="22" height="22">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
  </svg>
}

function EyeOff() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="22" height="22">
    <path d="M2 12s3.6-7 10-7c1.7 0 3.2.5 4.5 1.2M22 12s-3.6 7-10 7c-1.7 0-3.2-.5-4.5-1.2" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
  </svg>
}
