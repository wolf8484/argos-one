'use client'

import Image from 'next/image'
import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

import { normalizePhone } from '@/lib/identity'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser'
import { PasswordField, PhoneField, ReviewRow } from './fields'
import styles from './login.module.css'

type Draft = {
  shopName: string
  shopPhone: string
  shopEmail: string
  firstName: string
  lastName: string
  ownerEmail: string
  ownerPhone: string
  password: string
}

const emptyDraft: Draft = {
  shopName: '', shopPhone: '', shopEmail: '',
  firstName: '', lastName: '', ownerEmail: '', ownerPhone: '', password: '',
}

export default function LoginPage() {
  const router = useRouter()
  // 'signin' is the only screen anyone sees twice; creating a workshop is a
  // one-time path, so it is broken into steps rather than one long form.
  const [view, setView] = useState<'signin' | 'create' | 'created'>('signin')
  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  function goToStep(next: number) {
    setMessage('')
    setStep(next)
  }

  function startCreate() {
    setMessage('')
    setDraft(emptyDraft)
    setStep(1)
    setView('create')
  }

  function backToSignIn() {
    setMessage('')
    setView('signin')
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const form = new FormData(event.currentTarget)
    const identifier = String(form.get('identifier') || '').trim()
    const password = String(form.get('password') || '')
    // One field, two credential types. Which email a mobile belongs to can only
    // be answered server-side -- staff who joined with a mobile *and* an email
    // are keyed on the real one -- so resolve it before signing in rather than
    // guessing the placeholder form here and locking half of them out.
    let email: string
    try {
      const response = await fetch('/api/auth/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not check those details')
      email = payload.email
    } catch (error) {
      setBusy(false)
      return setMessage((error as Error).message)
    }
    const { error } = await createBrowserSupabaseClient().auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) return setMessage(error.message)
    const next = new URLSearchParams(window.location.search).get('next')
    router.replace(next || '/dashboard')
    router.refresh()
  }

  function captureStep(event: FormEvent<HTMLFormElement>, fields: (keyof Draft)[], nextStep: number) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const patch = Object.fromEntries(fields.map((field) => [field, String(form.get(field) || '').trim()]))
    if (fields.includes('password')) {
      const password = String(form.get('password') || '')
      if (password !== String(form.get('confirmPassword') || '')) return setMessage("Those passwords don't match.")
      patch.password = password
    }
    setDraft((current) => ({ ...current, ...patch }))
    goToStep(nextStep)
  }

  async function createWorkshop() {
    setBusy(true)
    setMessage('')
    const supabase = createBrowserSupabaseClient()
    const { data, error } = await supabase.auth.signUp({
      email: draft.ownerEmail,
      password: draft.password,
      options: { data: {
        full_name: `${draft.firstName} ${draft.lastName}`.trim(),
        shop_name: draft.shopName,
        shop_phone: draft.shopPhone,
        shop_email: draft.shopEmail,
        owner_phone: normalizePhone(draft.ownerPhone) ?? draft.ownerPhone,
      } },
    })
    if (error) {
      setBusy(false)
      return setMessage(error.message)
    }
    // Without a session Supabase is set to require email confirmation, so the
    // account exists but cannot be used yet -- say so instead of dead-ending
    // on a "Go to app" button that would bounce straight back here.
    if (!data.session) {
      setBusy(false)
      setView('created')
      return setMessage('Check your email to confirm the account, then sign in.')
    }
    // Attaching the mobile to the login is what makes "Email or mobile" true
    // for owners too; failing here is not worth blocking the signup over.
    if (draft.ownerPhone.trim()) {
      await fetch('/api/me/phone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: draft.ownerPhone }),
      }).catch(() => {})
    }
    setBusy(false)
    setView('created')
  }

  if (view === 'created') {
    const confirmationPending = Boolean(message)
    return <Shell heading="Workshop created" eyebrow="Workshop access">
      <p className={styles.hint}>
        {confirmationPending ? message : `${draft.shopName} is ready. You're signed in as the Owner.`}
      </p>
      <div className={styles.reviewList}>
        <ReviewRow label="Workshop" value={draft.shopName} />
        <ReviewRow label="Owner" value={`${draft.firstName} ${draft.lastName}`.trim()} />
        <ReviewRow label="Email" value={draft.ownerEmail} />
      </div>
      <div className={styles.actions}>
        {confirmationPending
          ? <button className={styles.primary} type="button" onClick={backToSignIn}>Go to sign in</button>
          : <button className={styles.primary} type="button" onClick={() => { router.replace('/dashboard'); router.refresh() }}>Go to app</button>}
      </div>
    </Shell>
  }

  if (view === 'create') {
    if (step === 1) {
      return <Shell heading="Workshop details" eyebrow="Create workshop" step="Step 1 of 3">
        <form key="step-1" onSubmit={(event) => captureStep(event, ['shopName', 'shopPhone', 'shopEmail'], 2)} className={styles.form}>
          <label>Workshop name<input name="shopName" defaultValue={draft.shopName} autoComplete="organization" required /></label>
          <PhoneField name="shopPhone" label="Workshop phone" defaultValue={draft.shopPhone} placeholder="02 9000 0000" optional />
          <label><span className={styles.labelText}>Workshop email <span className={styles.optional}>(optional)</span></span><input name="shopEmail" type="email" inputMode="email" defaultValue={draft.shopEmail} placeholder="shop@workshop.com.au" /></label>
          <p className={styles.hint}>You can add these later from Workshop profile in Settings.</p>
          {message && <p className={styles.message} role="status">{message}</p>}
          <div className={styles.actions}>
            <button className={styles.primary} type="submit">Continue</button>
            <button className={styles.switcher} type="button" onClick={backToSignIn}>Back to sign in</button>
          </div>
        </form>
      </Shell>
    }

    if (step === 2) {
      return <Shell heading="Owner details" eyebrow="Create workshop" step="Step 2 of 3">
        <form key="step-2" onSubmit={(event) => captureStep(event, ['firstName', 'lastName', 'ownerEmail', 'ownerPhone'], 3)} className={styles.form}>
          <label>First name<input name="firstName" defaultValue={draft.firstName} autoComplete="given-name" required /></label>
          <label>Last name<input name="lastName" defaultValue={draft.lastName} autoComplete="family-name" required /></label>
          <label>Your email<input name="ownerEmail" type="email" inputMode="email" defaultValue={draft.ownerEmail} autoComplete="email" required /></label>
          <PhoneField name="ownerPhone" label="Your mobile" defaultValue={draft.ownerPhone} placeholder="0412 345 678" required />
          {message && <p className={styles.message} role="status">{message}</p>}
          <div className={styles.actions}>
            <button className={styles.primary} type="submit">Continue</button>
            <button className={styles.switcher} type="button" onClick={() => goToStep(1)}>Back</button>
          </div>
        </form>
      </Shell>
    }

    if (step === 3) {
      return <Shell heading="Create password" eyebrow="Create workshop" step="Step 3 of 3">
        <form key="step-3" onSubmit={(event) => captureStep(event, ['password'], 4)} className={styles.form}>
          <PasswordField name="password" label="Password" autoComplete="new-password" rule />
          <PasswordField name="confirmPassword" label="Repeat password" autoComplete="new-password" />
          {message && <p className={styles.message} role="status">{message}</p>}
          <div className={styles.actions}>
            <button className={styles.primary} type="submit">Continue</button>
            <button className={styles.switcher} type="button" onClick={() => goToStep(2)}>Back</button>
          </div>
        </form>
      </Shell>
    }

    return <Shell heading="Review and create" eyebrow="Create workshop — Review">
      <div className={styles.reviewList}>
        <ReviewRow label="Workshop" value={draft.shopName} />
        <ReviewRow label="Workshop phone" value={draft.shopPhone} />
        <ReviewRow label="Workshop email" value={draft.shopEmail} />
        <ReviewRow label="Owner" value={`${draft.firstName} ${draft.lastName}`.trim()} />
        <ReviewRow label="Owner email" value={draft.ownerEmail} />
        <ReviewRow label="Owner mobile" value={draft.ownerPhone} />
      </div>
      {message && <p className={styles.message} role="status">{message}</p>}
      <div className={styles.actions}>
        <button className={styles.primary} type="button" onClick={createWorkshop} disabled={busy}>{busy ? 'Creating…' : 'Create workshop'}</button>
        <button className={styles.switcher} type="button" onClick={() => goToStep(3)} disabled={busy}>Back</button>
      </div>
    </Shell>
  }

  return <Shell heading="Sign in" eyebrow="Workshop access">
    <form key="signin" onSubmit={signIn} className={styles.form}>
      <label>Email or mobile
        <input name="identifier" type="text" autoComplete="username" placeholder="name@email.com or 0412 345 678" required />
      </label>
      <PasswordField name="password" label="Password" autoComplete="current-password" />
      {message && <p className={styles.message} role="status">{message}</p>}
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Sign in'}</button>
      </div>
    </form>
    {/* Ordered by how often each is used: everyone signs in, some staff join
        once, and creating a workshop happens a single time per business. */}
    <div className={styles.alternatives}>
      <Link className={styles.tertiary} href="/join">Have an invite? <strong>Join a workshop</strong></Link>
      <button className={styles.switcher} type="button" onClick={startCreate}>
        Create a workshop
        <small>For workshop owners</small>
      </button>
    </div>
  </Shell>
}

function Shell({ heading, eyebrow, step, children }: { heading: string; eyebrow: string; step?: string; children: React.ReactNode }) {
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
