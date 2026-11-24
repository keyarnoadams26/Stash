import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound, Check, Wallet, CreditCard, CalendarDays, Bell, LogOut } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type Mode = 'login' | 'signup' | 'forgot'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  function changeMode(next: Mode) {
    setMode(next)
    setError('')
    setNotice('')
    setPassword('')
    setConfirmPassword('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) throw new Error('Your passwords do not match.')
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        })
        if (error) throw error
        setNotice('Your account has been created. Check your email to verify your address.')
        changeMode('login')
        setNotice('Your account has been created. Check your email to verify your address.')
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setNotice('If an account exists for that email, a password reset link has been sent.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function googleSignIn() {
    if (!supabase) return
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setError(error.message)
      setBusy(false)
    }
  }

  if (loading) return <main className="center"><div className="spinner" />Loading STASH…</main>

  if (!isSupabaseConfigured) return <main className="center"><section className="setup">
    <div className="wordmark">Stash</div><p className="eyebrow">INITIAL SETUP</p>
    <h1>Connect STASH to Supabase</h1>
    <p>Add your Supabase project URL and publishable key to a local <code>.env.local</code> file to activate accounts.</p>
    <small>Never put your service-role key in the browser or GitHub.</small>
  </section></main>

  if (!session) return <main className="auth-shell">
    <div className="auth-decoration auth-decoration-top" />
    <div className="auth-decoration auth-decoration-bottom" />
    <section className="auth-card">
      <header className="auth-brand">
        <div className="wordmark">Stash</div>
        <p>Your money. Organised.</p>
      </header>

      <div className="auth-content">
        <h1>{mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Welcome back'}</h1>
        <p className="auth-subtitle">{mode === 'signup' ? 'Get started in seconds' : mode === 'forgot' ? 'We’ll send you a password reset link' : 'Sign in to continue'}</p>

        {notice && <div className="notice"><Check size={16} />{notice}</div>}
        {error && <div className="error" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={submit}>
          {mode === 'signup' && <div className="field">
            <UserRound size={21} />
            <input required value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" autoComplete="name" aria-label="Full name" />
          </div>}
          <div className="field">
            <Mail size={21} />
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" autoComplete="email" aria-label="Email address" />
          </div>
          {mode !== 'forgot' && <>
            <div className="field">
              <LockKeyhole size={21} />
              <input required minLength={8} type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} aria-label="Password" />
              <button className="visibility-button" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button>
            </div>
            {mode === 'signup' && <div className="field">
              <LockKeyhole size={21} />
              <input required minLength={8} type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm Password" autoComplete="new-password" aria-label="Confirm password" />
              <button className="visibility-button" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button>
            </div>}
          </>}
          {mode === 'login' && <div className="form-utility"><label className="remember"><input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} /> Remember me</label><button type="button" className="text-button" onClick={() => changeMode('forgot')}>Forgot password?</button></div>}
          <button className="primary-button" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Send Reset Link' : 'Sign In'} <ArrowRight size={20} /></button>
        </form>

        {mode !== 'forgot' && <>
          <div className="or-divider"><span />or<span /></div>
          <button className="google-button" type="button" onClick={googleSignIn} disabled={busy}><span className="google-g">G</span>Continue with Google</button>
        </>}

        <p className="auth-switch">
          {mode === 'signup' ? 'Already have an account?' : mode === 'forgot' ? 'Remembered your password?' : 'Don’t have an account?'}
          {' '}<button className="text-button" onClick={() => changeMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Sign Up' : 'Sign In'}</button>
        </p>
      </div>
    </section>
  </main>

  const displayName = session.user.user_metadata.full_name || 'there'
  return <main className="app">
    <aside className="sidebar">
      <div className="wordmark">Stash</div>
      <p className="nav-title">WORKSPACE</p>
      <div className="nav active"><Wallet size={18} />Overview</div>
      <div className="nav"><CreditCard size={18} />Subscriptions <small>SOON</small></div>
      <div className="nav"><CalendarDays size={18} />Payments <small>SOON</small></div>
      <div className="nav"><Bell size={18} />Reminders <small>SOON</small></div>
      <div className="profile"><div className="avatar">{displayName[0].toUpperCase()}</div><div><b>{displayName}</b><small>{session.user.email}</small></div><button className="logout" onClick={() => supabase?.auth.signOut()} aria-label="Sign out"><LogOut size={17} /></button></div>
    </aside>
    <section className="dashboard">
      <header><div><p className="eyebrow">PERSONAL WORKSPACE</p><h1>Overview</h1></div></header>
      <section className="welcome"><div><p className="eyebrow">YOUR STASH</p><h2>Welcome, {displayName.split(' ')[0]}.</h2><p>Your personal subscription dashboard is ready.</p></div><Wallet size={28} /></section>
      <div className="stats">
        <article><CreditCard /><p>Active subscriptions</p><strong>—</strong><small>Coming in the next phase</small></article>
        <article><CalendarDays /><p>Next payment</p><strong>—</strong><small>Upcoming payments will show here</small></article>
        <article><Bell /><p>Monthly total</p><strong>—</strong><small>Your recurring spend at a glance</small></article>
      </div>
      <section className="empty"><div className="empty-icon"><CreditCard /></div><h3>Your subscriptions will live here</h3><p>Track services, payment dates and spending in one place. Subscription tracking is the next phase.</p></section>
    </section>
  </main>
}
