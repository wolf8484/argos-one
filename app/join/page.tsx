'use client'

import Image from 'next/image'
import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

import { formatPhoneForDisplay, isEmailIdentifier, normalizePhone, staffAuthEmail } from '@/lib/identity'
import { PasswordField, ReviewRow } from '../login/fields'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser'
import styles from '../login/login.module.css'

type Invite = { shopName: string; firstName: string; lastName: string; role: string; email: string; mobile: string }
type Draft = { firstName: string; lastName: string; email: string; mobile: string; password: string }

const roleLabels: Record<string, string> = { owner: 'Owner', admin: 'Admin', technician: 'Technician' }

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Something went wrong')
  return payload
}

export default function JoinPage() {
  const router = useRouter()
  // Mirrors the create-workshop wizard: details, password, review, done.
  const [step, setStep] = useState<'code' | 'details' | 'password' | 'review' | 'done'>('code')
  const [code, setCode] = useState('')
  const [invite, setInvite] = useState<Invite | null>(null)
  const [draft, setDraft] = useState<Draft>({ firstName: '', lastName: '', email: '', mobile: '', password: '' })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function checkCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const { invite: found } = await postJson('/api/join/lookup', { code })
      setInvite(found)
      setDraft({
        firstName: found.firstName || '',
        lastName: found.lastName || '',
        email: found.email || '',
        mobile: formatPhoneForDisplay(found.mobile) || found.mobile || '',
        password: '',
      })
      setStep('details')
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function captureDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim()
    const mobile = String(form.get('mobile') || '').trim()
    if (!email && !mobile) return setMessage('Enter an email or a mobile — you sign in with one of them.')
    setDraft((current) => ({
      ...current,
      firstName: String(form.get('firstName') || '').trim(),
      lastName: String(form.get('lastName') || '').trim(),
      email,
      mobile,
    }))
    setMessage('')
    setStep('password')
  }

  function capturePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') || '')
    if (password !== String(form.get('confirmPassword') || '')) return setMessage("Those passwords don't match.")
    setDraft((current) => ({ ...current, password }))
    setMessage('')
    setStep('review')
  }

  async function createAccount() {
    setBusy(true)
    setMessage('')
    try {
      await postJson('/api/join', {
        code,
        firstName: draft.firstName,
        lastName: draft.lastName,
        email: draft.email || null,
        mobile: draft.mobile || null,
        password: draft.password,
      })
      // The account is created pre-confirmed, so there is no reason to make
      // them retype the password they set moments ago -- sign them straight in.
      // Mobile-only accounts are keyed under a placeholder email (see
      // staffAuthEmail / redeemInvite) rather than Supabase's native phone
      // auth, which needs a paid SMS provider just to allow sign-in.
      const identifier = draft.email || draft.mobile
      const credentials = isEmailIdentifier(identifier)
        ? { email: identifier, password: draft.password }
        : { email: staffAuthEmail(normalizePhone(identifier) ?? identifier), password: draft.password }
      await createBrowserSupabaseClient().auth.signInWithPassword(credentials).catch(() => {})
      setStep('done')
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (step === 'code') {
    return <Shell eyebrow="Workshop access" heading="Join a workshop">
      <p className={styles.hint}>Enter the invitation code your workshop admin gave you.</p>
      <form key="code" onSubmit={checkCode} className={styles.form}>
        <label>Invitation code
          <input name="code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="A7K9-Q2" autoCapitalize="characters" autoComplete="off" maxLength={8} required />
        </label>
        {message && <p className={styles.message} role="status">{message}</p>}
        <div className={styles.actions}>
          <button className={styles.primary} type="submit" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button>
          <Link className={styles.switcher} href="/login">Back to sign in</Link>
        </div>
      </form>
    </Shell>
  }

  if (step === 'details' && invite) {
    return <Shell eyebrow={`Join ${invite.shopName}`} step="Step 1 of 2" heading="Your details">
      <form key="details" onSubmit={captureDetails} className={styles.form}>
        <label>First name<input name="firstName" defaultValue={draft.firstName} autoComplete="given-name" required /></label>
        <label>Last name<input name="lastName" defaultValue={draft.lastName} autoComplete="family-name" required /></label>
        <label>
          <span className={styles.labelText}>Email {!invite.email && <span className={styles.optional}>(optional)</span>}</span>
          <input name="email" type="email" inputMode="email" defaultValue={draft.email} autoComplete="email" placeholder="name@email.com" />
        </label>
        <label>
          <span className={styles.labelText}>Mobile {!invite.mobile && <span className={styles.optional}>(optional)</span>}</span>
          <input name="mobile" type="tel" inputMode="tel" defaultValue={draft.mobile} autoComplete="tel" placeholder="0412 345 678" />
        </label>
        <p className={styles.hint}>Use at least one — it becomes how you sign in. You&apos;ll join as {roleLabels[invite.role] || invite.role}.</p>
        {message && <p className={styles.message} role="status">{message}</p>}
        <div className={styles.actions}>
          <button className={styles.primary} type="submit">Continue</button>
          <button className={styles.switcher} type="button" onClick={() => { setMessage(''); setStep('code') }}>Back</button>
        </div>
      </form>
    </Shell>
  }

  if (step === 'password' && invite) {
    return <Shell eyebrow={`Join ${invite.shopName}`} step="Step 2 of 2" heading="Create password">
      <form key="password" onSubmit={capturePassword} className={styles.form}>
        <PasswordField name="password" label="Password" autoComplete="new-password" />
        <PasswordField name="confirmPassword" label="Repeat password" autoComplete="new-password" />
        <p className={styles.hint}>At least 8 characters.</p>
        {message && <p className={styles.message} role="status">{message}</p>}
        <div className={styles.actions}>
          <button className={styles.primary} type="submit">Continue</button>
          <button className={styles.switcher} type="button" onClick={() => { setMessage(''); setStep('details') }}>Back</button>
        </div>
      </form>
    </Shell>
  }

  if (step === 'review' && invite) {
    return <Shell eyebrow="Join a workshop — Review" heading="Review and join">
      <div className={styles.reviewList}>
        <ReviewRow label="Workshop" value={invite.shopName} />
        <ReviewRow label="Name" value={`${draft.firstName} ${draft.lastName}`.trim()} />
        <ReviewRow label="Role" value={roleLabels[invite.role] || invite.role} />
        <ReviewRow label="Email" value={draft.email} />
        <ReviewRow label="Mobile" value={draft.mobile} />
      </div>
      {message && <p className={styles.message} role="status">{message}</p>}
      <div className={styles.actions}>
        <button className={styles.primary} type="button" onClick={createAccount} disabled={busy}>{busy ? 'Joining…' : 'Join workshop'}</button>
        <button className={styles.switcher} type="button" onClick={() => { setMessage(''); setStep('password') }} disabled={busy}>Back</button>
      </div>
    </Shell>
  }

  return <Shell eyebrow="Workshop access" heading="You're in">
    <p className={styles.hint}>You&apos;ve joined {invite?.shopName}. Next time, sign in with your email or mobile and the password you just set.</p>
    <div className={styles.actions}>
      <button className={styles.primary} type="button" onClick={() => { router.replace('/dashboard'); router.refresh() }}>Go to app</button>
    </div>
  </Shell>
}

function Shell({ eyebrow, step, heading, children }: { eyebrow: string; step?: string; heading: string; children: React.ReactNode }) {
  return <main className={styles.page}>
    <section className={styles.panel}>
      <Image src="/argos-ui/assets/brand/argos-one-logo-yellow.svg" alt="Argos One" width={212} height={47} priority />
      <div>
        <p className={styles.eyebrow}><span>{eyebrow}</span>{step && <span className={styles.eyebrowStep}>{step}</span>}</p>
        <h1>{heading}</h1>
      </div>
      {children}
    </section>
  </main>
}
