import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowRight, Bell, CalendarDays, Check, CreditCard, Eye, EyeOff, LockKeyhole, LogOut, Mail, ShieldCheck, Wallet } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type Mode = 'login' | 'signup' | 'forgot'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setError(''); setNotice('')
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() } } })
        if (error) throw error
        setNotice('Account created. Check your email to verify your address.')
        setMode('login')
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
        if (error) throw error
        setNotice('If an account exists for that email, a password reset link has been sent.')
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.') }
    finally { setBusy(false) }
  }

  if (loading) return <main className="center"><div className="spinner" />Loading STASH…</main>

  if (!isSupabaseConfigured) return <main className="center"><section className="setup"><div className="mark">S</div><p className="eyebrow">INITIAL SETUP</p><h1>Connect STASH to Supabase</h1><p>Add your Supabase project URL and anon/publishable key to a local <code>.env</code> file to activate accounts.</p><ol><li>Create a Supabase project.</li><li>Copy the project URL and anon key.</li><li>Copy <code>.env.example</code> to <code>.env</code>, add the values and restart.</li></ol><small>Never put your service-role key in the browser.</small></section></main>

  if (!session) return <main className="auth">
    <aside className="hero"><div className="brand"><div className="mark">S</div>STASH</div><div className="hero-copy"><p className="eyebrow">YOUR MONEY. YOUR OVERVIEW.</p><h1>Know what’s coming.<br/><span>Stay in control.</span></h1><p>One clear place to keep track of your subscriptions and recurring payments.</p></div><div className="secure"><ShieldCheck size={16}/> Secure account access</div></aside>
    <section className="auth-panel"><div className="form-wrap"><div className="mobile-brand"><div className="mark">S</div>STASH</div><p className="eyebrow">{mode === 'signup' ? 'GET STARTED' : mode === 'forgot' ? 'ACCOUNT RECOVERY' : 'WELCOME BACK'}</p><h2>{mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Sign in to STASH'}</h2><p className="sub">{mode === 'signup' ? 'Set up your personal subscription space.' : mode === 'forgot' ? 'We’ll email you a secure reset link.' : 'Your subscriptions, all in one place.'}</p>
    {notice && <div className="notice"><Check size={16}/>{notice}</div>}{error && <div className="error">{error}</div>}
    <form onSubmit={submit}>
      {mode === 'signup' && <label>Full name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" autoComplete="name"/></label>}
      <label>Email address<div className="input-wrap"><Mail size={17}/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/></div></label>
      {mode !== 'forgot' && <label>Password<div className="input-wrap"><LockKeyhole size={17}/><input required minLength={8} type={visible?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={mode==='signup'?'new-password':'current-password'}/><button className="eye" type="button" onClick={()=>setVisible(!visible)} aria-label="Toggle password visibility">{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}
      {mode === 'login' && <button type="button" className="link forgot" onClick={()=>{setMode('forgot');setError('');setNotice('')}}>Forgot password?</button>}
      <button className="primary" disabled={busy}>{busy?'Please wait…':mode==='signup'?'Create account':mode==='forgot'?'Send reset link':'Sign in'} <ArrowRight size={17}/></button>
    </form><p className="switch">{mode==='forgot'?'Remembered your password?':mode==='signup'?'Already have an account?':'New to STASH?'} <button className="link" onClick={()=>{setMode(mode==='signup'||mode==='forgot'?'login':'signup');setError('');setNotice('')}}>{mode==='signup'||mode==='forgot'?'Sign in':'Create account'}</button></p><p className="legal">Terms and Privacy details will be added before public launch.</p></div></section>
  </main>

  const displayName = session.user.user_metadata.full_name || 'there'
  return <main className="app"><aside className="sidebar"><div className="brand"><div className="mark">S</div>STASH</div><p className="nav-title">WORKSPACE</p><div className="nav active"><Wallet size={18}/>Overview</div><div className="nav"><CreditCard size={18}/>Subscriptions <small>SOON</small></div><div className="nav"><CalendarDays size={18}/>Payments <small>SOON</small></div><div className="nav"><Bell size={18}/>Reminders <small>SOON</small></div><div className="profile"><div className="avatar">{displayName[0].toUpperCase()}</div><div><b>{displayName}</b><small>{session.user.email}</small></div><button className="logout" onClick={()=>supabase?.auth.signOut()} aria-label="Sign out"><LogOut size={17}/></button></div></aside><section className="dashboard"><header><div><p className="eyebrow">PERSONAL WORKSPACE</p><h1>Overview</h1></div><span className="secure"><ShieldCheck size={15}/> Account secured</span></header><section className="welcome"><div><p className="eyebrow">YOUR STASH</p><h2>Welcome, {displayName.split(' ')[0]}.</h2><p>Your personal subscription dashboard is ready.</p></div><Wallet size={28}/></section><div className="stats"><article><CreditCard/><p>Active subscriptions</p><strong>—</strong><small>Coming in the next phase</small></article><article><CalendarDays/><p>Next payment</p><strong>—</strong><small>Upcoming payments will show here</small></article><article><Bell/><p>Monthly total</p><strong>—</strong><small>Your recurring spend at a glance</small></article></div><section className="empty"><div className="empty-icon"><CreditCard/></div><h3>Your subscriptions will live here</h3><p>Track services, payment dates and spending in one place. Subscription tracking is the next phase.</p></section><footer>STASH · PERSONAL <button className="link" onClick={()=>setError('Account deletion needs a secure server-side function. It is not enabled yet.')}>Account deletion</button></footer>{error&&<div className="error">{error}</div>}</section></main>
}