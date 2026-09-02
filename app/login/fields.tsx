'use client'

import { useState } from 'react'

import styles from './login.module.css'

/**
 * Password input with a reveal toggle. Mechanics type these on a tablet with
 * gloves or dirty hands, where a mistyped password is likely and invisible --
 * being able to check what was typed matters more here than on a desktop.
 */
export function PasswordField({ name, label, autoComplete }: { name: string; label: string; autoComplete: string }) {
  const [visible, setVisible] = useState(false)
  return <label>
    {label}
    <span className={styles.passwordControl}>
      <input name={name} type={visible ? 'text' : 'password'} autoComplete={autoComplete} minLength={8} required />
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
  </label>
}

export function ReviewRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return <div className={styles.reviewRow}><span>{label}</span><strong>{value}</strong></div>
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
