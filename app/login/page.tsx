'use client'

import Image from 'next/image'
import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { normalizePhone } from '@/lib/identity'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser'
import { Notice, PasswordField, PhoneField, ReviewRow } from './fields'
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
  const [view, setView] = useState<'signin' | 'create' | 'created' | 'register' | 'pair' | 'paired'>('signin')
  // Set by the pairing screen so the success page can name the branch back to
  // whoever just typed the code -- "registered to Blacktown" is the only
  // confirmation they get that they were read the right one.
  const [pairedBranch, setPairedBranch] = useState('')
  // Null until checked. Once a device is registered the setup entry disappears
  // entirely -- with no unpair flow yet, that is what stops a workshop tablet
  // being repointed to another branch by whoever is holding it.
  const [deviceBranch, setDeviceBranch] = useState<string | null>(null)
  const [deviceChecked, setDeviceChecked] = useState(false)
  // The workshop just created, held only long enough to offer registering the
  // device it was created on. Null whenever there is nothing to offer.
  const [registerOffer, setRegisterOffer] = useState<{ name: string; code: string } | null>(null)

  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  // Set by the dashboard when it signs a revoked session out and sends it
  // here, so the arrival reads as an explanation rather than a random logout.
  const [message, setMessage] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('revoked') === '1'
      ? 'Your access to this workshop has been deactivated. Contact your manager for more information.'
      : '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/devices/pair')
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return
        setDeviceBranch(payload?.registered ? (payload.branchName ?? '') : null)
        setDeviceChecked(true)
      })
      .catch(() => { if (!cancelled) setDeviceChecked(true) })
    return () => { cancelled = true }
  }, [])

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

  function startPairing() {
    setMessage('')
    setView('pair')
  }

  /**
   * Registering the tablet itself, before anyone signs in on it.
   *
   * Deliberately reachable signed out: a branch that has just been created may
   * have no accounts at all, so the hardware has to be able to say where it is
   * without a human authenticating first. It grants nothing on its own -- the
   * next person still needs a login that works at that branch.
   */
  async function pairDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch('/api/devices/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: String(form.get('code') || '') }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not set up this device')
      setBusy(false)
      setPairedBranch(payload.device?.branchName || '')
      setView('paired')
    } catch (error) {
      setBusy(false)
      setMessage((error as Error).message)
    }
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
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setBusy(false); return setMessage(error.message) }

    // The password was right, but being suspended has to stop the sign-in
    // itself rather than dropping them into an app that can reach nothing.
    // /api/me is the same membership check every other request goes through.
    const me = await fetch('/api/me')
    if (me.status === 403) {
      const payload = await me.json().catch(() => ({}))
      await supabase.auth.signOut()
      setBusy(false)
      return setMessage(payload.error || 'Your access to this workshop has been deactivated. Contact your manager for more information.')
    }

    setBusy(false)
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
    // The workshop carries a Registration ID from the moment its row exists, so
    // this is the one moment the owner has it in hand without signing out to
    // reach the registration screen. Offer it here; a failed lookup just skips
    // the offer, since registering is optional and recoverable either way.
    const offer = await fetch('/api/branches')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const shops: { name?: string; registration_code?: string | null; isCurrent?: boolean }[] = payload?.branches ?? []
        const shop = shops.find((branch) => branch.isCurrent) ?? shops[0]
        return shop?.registration_code && shop.name
          ? { name: shop.name, code: shop.registration_code }
          : null
      })
      .catch(() => null)
    setBusy(false)
    if (offer) {
      setRegisterOffer(offer)
      return setView('register')
    }
    setView('created')
  }

  /** The same registration as the signed-out screen, with the code filled in. */
  async function registerNewWorkshop() {
    if (!registerOffer) return
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/devices/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: registerOffer.code }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not register this device')
      setBusy(false)
      setDeviceBranch(payload.device?.branchName || registerOffer.name)
      setView('created')
    } catch (error) {
      setBusy(false)
      setMessage((error as Error).message)
    }
  }

  if (view === 'register' && registerOffer) {
    return <Shell heading={`Register this device to ${registerOffer.name}?`} eyebrow="Device registration">
      <p className={styles.hint}>
        Registering pins this device to this workshop, so anyone signing in here
        lands in it. Skip it if this is your own phone or laptop &mdash; you can
        register the workshop&apos;s tablet later with the Registration ID in
        Business details.
      </p>
      {message && <p className={styles.message} role="status">{message}</p>}
      <div className={styles.actions}>
        <button className={styles.primary} type="button" onClick={registerNewWorkshop} disabled={busy}>{busy ? 'Registering…' : 'Register this device'}</button>
        <button className={styles.switcher} type="button" onClick={() => { setMessage(''); setView('created') }} disabled={busy}>Not now</button>
      </div>
    </Shell>
  }

  if (view === 'paired') {
    return <Shell heading="Registration successful" eyebrow="Device registration">
      <p className={styles.hint}>
        {pairedBranch
          ? `This device has been registered to ${pairedBranch}. Everyone who signs in here will work in that branch.`
          : 'This device has been registered. Everyone who signs in here will work in that branch.'}
      </p>
      <div className={styles.actions}>
        <button className={styles.primary} type="button" onClick={backToSignIn}>Continue to sign in</button>
      </div>
    </Shell>
  }

  if (view === 'pair') {
    return <Shell heading="Register this device" eyebrow="Device registration">
      <form key="pair" onSubmit={pairDevice} className={styles.form}>
        <p className={styles.hint}>
          Enter the Registration ID for this workshop, found on its profile under
          Workshop &amp; branches. Once registered, anyone who signs in on this
          device works in that branch without being asked.
        </p>
        {/* The ID is the only input there is. Which branch this device belongs
            to travels with the ID, so there is nothing here for the person
            holding the tablet to get wrong or to contradict. */}
        <label>Registration ID
          <input name="code" type="text" inputMode="text" autoCapitalize="characters" autoComplete="off" placeholder="e.g. K4M7QP2X" required />
        </label>
        {message && <p className={styles.message} role="status">{message}</p>}
        <div className={styles.actions}>
          <button className={styles.primary} type="submit" disabled={busy}>{busy ? 'Registering…' : 'Register device'}</button>
          <button className={styles.switcher} type="button" onClick={backToSignIn} disabled={busy}>Back to sign in</button>
        </div>
      </form>
    </Shell>
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
        {deviceBranch && <ReviewRow label="This device" value={`Registered to ${deviceBranch}`} />}
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
          <Notice title="Create your personal login">
            These are the details you are gonna need to login on your account, not the workshop details from the previous step.
          </Notice>
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

    return <Shell heading="Review and create" eyebrow="Create workshop: Review">
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
      {/* Last, because it is the rarest path -- and gone entirely once this
          device is registered, since it happens once and never again. */}
      {deviceChecked && deviceBranch === null && (
        <button className={styles.switcher} type="button" onClick={startPairing}>
          Register this device
          <small>For a shared workshop tablet</small>
        </button>
      )}
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
