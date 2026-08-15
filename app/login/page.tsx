'use client'

import Image from 'next/image'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

import { createBrowserSupabaseClient } from '@/lib/supabase/browser'
import styles from './login.module.css'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '')
    const password = String(form.get('password') || '')
    const supabase = createBrowserSupabaseClient()
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: {
        full_name: String(form.get('fullName') || ''), shop_name: String(form.get('shopName') || ''),
      } } })
      setBusy(false)
      if (error) return setMessage(error.message)
      if (!data.session) return setMessage('Check your email to confirm the account, then sign in.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setBusy(false)
      if (error) return setMessage(error.message)
    }
    const next = new URLSearchParams(window.location.search).get('next')
    router.replace(next || '/dashboard')
    router.refresh()
  }

  return <main className={styles.page}>
    <section className={styles.panel}>
      <Image src="/argos-ui/assets/brand/argos-one-logo-yellow.svg" alt="Argos One" width={212} height={47} priority />
      <div><p className={styles.eyebrow}>Workshop access</p><h1>{mode === 'login' ? 'Sign in' : 'Create workshop'}</h1></div>
      <form onSubmit={submit} className={styles.form}>
        {mode === 'signup' && <>
          <label>Full name<input name="fullName" autoComplete="name" required /></label>
          <label>Workshop name<input name="shopName" autoComplete="organization" required /></label>
        </>}
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required /></label>
        {message && <p className={styles.message} role="status">{message}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
      </form>
      <button className={styles.switcher} type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}>
        {mode === 'login' ? 'Create a workshop account' : 'I already have an account'}
      </button>
    </section>
  </main>
}
