import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type Sub = { id:string; name:string; price:number; currency:string; payment_date:string; status:'active'|'cancelled'; category?:string; frequency?:string; trial_end?:string|null }
type Props = { subscriptions:Sub[]; budgets:Record<string,string>; displayCurrency:string; leadDays:number; session:Session|null; isDemo:boolean }

const monthly = (s:Sub) => Number(s.price) * ({weekly:52/12,monthly:1,quarterly:1/3,yearly:1/12}[s.frequency || 'monthly'] || 1)
const dateText = (d:string) => new Date(d+'T12:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})

export default function PersonalExtras({subscriptions,budgets,displayCurrency,leadDays,session,isDemo}:Props) {
  const [rates,setRates] = useState<Record<string,number>>({ZAR:1})
  const [rateDate,setRateDate] = useState('')
  const [permission,setPermission] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  const [notice,setNotice] = useState('')
  const [emailEnabled,setEmailEnabled] = useState(false)
  const [bankResult,setBankResult] = useState('')
  const [busy,setBusy] = useState(false)
  const [pushEnabled,setPushEnabled] = useState(false)
  const [priceOffers,setPriceOffers] = useState<any[]>([])
  const [priceLoadMessage,setPriceLoadMessage] = useState('Loading verified provider offers…')
  useEffect(() => {
    if(!session || !supabase || isDemo) return
    supabase.from('stash_notification_preferences').select('email_enabled,push_enabled').eq('user_id',session.user.id).maybeSingle().then(({data})=>{if(data){setEmailEnabled(Boolean(data.email_enabled));setPushEnabled(Boolean(data.push_enabled))}})
  },[session,isDemo])
  useEffect(() => {
    if(!supabase) return
    supabase.from('stash_price_comparisons').select('id,category,provider,plan,price,currency,billing_period,region,source_url,verified_at').eq('active',true).order('verified_at',{ascending:false}).limit(50)
      .then(({data,error}) => {
        if(error){setPriceLoadMessage('Price catalogue is not available yet.');return}
        setPriceOffers(data||[])
        setPriceLoadMessage(data?.length?'Offers supplied to STASH. Check the source and date before switching.':'No verified provider prices have been added yet.')
      })
  },[])
  const saveEmailPreference = async (enabled:boolean) => {
    setEmailEnabled(enabled)
    if(!supabase || !session || isDemo){setNotice('Sign in to save email reminder preferences.');return}
    const {error}=await supabase.from('stash_notification_preferences').upsert({user_id:session.user.id,email_enabled:enabled,push_enabled:pushEnabled,reminder_days:leadDays,updated_at:new Date().toISOString()},{onConflict:'user_id'})
    if(error){setEmailEnabled(!enabled);setNotice(error.message)}else setNotice(enabled?'Email reminders enabled.':'Email reminders disabled.')
  }
  const enablePush = async () => {
    if(!supabase || !session || isDemo){setNotice('Sign in to enable push notifications.');return}
    const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
    if(!publicKey){setNotice('Push service is not configured yet.');return}
    if(!('serviceWorker' in navigator) || !('PushManager' in window)){setNotice('This browser does not support web push.');return}
    try {
      const permissionResult = await Notification.requestPermission()
      if(permissionResult!=='granted'){setNotice('Notification permission was not granted.');return}
      const registration = await navigator.serviceWorker.ready
      const keyBytes = Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')),ch=>ch.charCodeAt(0))
      const subscription = await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes})
      const json = subscription.toJSON()
      const {error} = await supabase.from('stash_push_subscriptions').upsert({user_id:session.user.id,endpoint:json.endpoint,p256dh:json.keys?.p256dh,auth_key:json.keys?.auth},{onConflict:'user_id,endpoint'})
      if(error) throw error
      await supabase.from('stash_notification_preferences').upsert({user_id:session.user.id,email_enabled:emailEnabled,push_enabled:true,reminder_days:leadDays,updated_at:new Date().toISOString()},{onConflict:'user_id'})
      setPushEnabled(true);setNotice('This device is registered for push notifications. Server-side delivery still needs its VAPID private key and scheduler.')
    } catch(error) { setNotice(error instanceof Error?error.message:'Could not enable push notifications.') }
  }
  const sendEmailReminders = async () => {
    if(!supabase || !session || isDemo){setNotice('Sign in to use email reminders.');return}
    setBusy(true);const {data,error}=await supabase.functions.invoke('send-reminders');setBusy(false)
    setNotice(error?error.message:(data?.sent?data.sent+' reminder email(s) sent.':'No reminders due, or email provider is not configured.'))
  }
  const disablePush = async () => {
    if(!supabase || !session || isDemo) return
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if(subscription) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()
        const {error} = await supabase.from('stash_push_subscriptions').delete().eq('user_id',session.user.id).eq('endpoint',endpoint)
        if(error) throw error
      }
      const {error} = await supabase.from('stash_notification_preferences').upsert({user_id:session.user.id,email_enabled:emailEnabled,push_enabled:false,reminder_days:leadDays,updated_at:new Date().toISOString()},{onConflict:'user_id'})
      if(error) throw error
      setPushEnabled(false);setNotice('Push notifications disabled on this device.')
    } catch(error) { setNotice(error instanceof Error?error.message:'Could not disable push notifications.') }
  }
  const testBankSandbox = async () => {
    if(!supabase || !session || isDemo){setBankResult('Sign in to test the bank sandbox.');return}
    setBusy(true);const {data,error}=await supabase.functions.invoke('banklink-sandbox',{body:{}});setBusy(false)
    setBankResult(error?error.message:JSON.stringify(data).slice(0,1200))
  }
  useEffect(() => {
    let active = true
    fetch('https://api.frankfurter.app/latest?from=ZAR&to=USD,GBP,EUR')
      .then(r => { if(!r.ok) throw new Error('Rates unavailable'); return r.json() })
      .then(data => { if(active) { setRates({ZAR:1,...data.rates}); setRateDate(data.date || '') } })
      .catch(() => { if(active) setRates({ZAR:1}) })
    return () => { active = false }
  },[])
  const convert = (amount:number,from:string,to:string) => {
    if(from===to) return amount
    if(!rates[from] || !rates[to]) return null
    return amount / rates[from] * rates[to]
  }
  const activeSubs = subscriptions.filter(s => s.status==='active')
  const budgetsList = useMemo(() => Object.entries(budgets),[budgets])
  const requestNotifications = async () => {
    if(typeof Notification==='undefined') { setNotice('This browser does not support notifications.'); return }
    const result = await Notification.requestPermission()
    setPermission(result)
    setNotice(result==='granted'?'Browser reminders enabled while STASH is open.':'Notification permission was not granted.')
  }
  useEffect(() => {
    if(typeof Notification==='undefined' || Notification.permission!=='granted') return
    const check = () => {
      const today = new Date().toISOString().slice(0,10)
      const items = activeSubs.flatMap(s => {
        const due = Math.ceil((new Date(s.payment_date+'T12:00:00').getTime()-new Date(today+'T12:00:00').getTime())/86400000)
        const trial = s.trial_end ? Math.ceil((new Date(s.trial_end+'T12:00:00').getTime()-new Date(today+'T12:00:00').getTime())/86400000) : null
        const output:{key:string;title:string;body:string}[] = []
        if(due>=0 && due<=leadDays) output.push({key:'pay-'+s.id+'-'+s.payment_date,title:'Upcoming STASH payment',body:s.name+' is due '+dateText(s.payment_date)})
        if(trial!==null && trial>=0 && trial<=leadDays) output.push({key:'trial-'+s.id+'-'+s.trial_end,title:'STASH free trial ending',body:s.name+' trial ends '+dateText(s.trial_end!)})
        return output
      })
      items.forEach(item => {
        const key='stash-notification-'+item.key
        if(!localStorage.getItem(key)) {
          new Notification(item.title,{body:item.body})
          localStorage.setItem(key,'sent')
        }
      })
    }
    check()
    const timer=window.setInterval(check,60*60*1000)
    return () => window.clearInterval(timer)
  },[subscriptions,leadDays])
  return <div className="personal-extras">
    <section className="hub-card">
      <h3>Budget tracking</h3>
      <p>Estimated monthly subscription costs compared with your saved category limits.</p>
      {budgetsList.length ? budgetsList.map(([category,limit]) => {
        const spend=activeSubs.filter(s=>(s.category||'Other')===category).reduce((sum,s)=>sum+(convert(monthly(s),s.currency,displayCurrency) ?? 0),0)
        const cap=Number(limit)
        const percent=cap>0?Math.min(100,spend/cap*100):0
        return <div className="budget-progress" key={category}>
          <div className="budget-progress-heading"><b>{category}</b><span>{new Intl.NumberFormat(undefined,{style:'currency',currency:displayCurrency}).format(spend)} / {new Intl.NumberFormat(undefined,{style:'currency',currency:displayCurrency}).format(cap)}</span></div>
          <div className="budget-track"><span style={{width:percent+'%'}} /></div>
          <small>{spend>cap?'Over budget':new Intl.NumberFormat(undefined,{style:'currency',currency:displayCurrency}).format(cap-spend)+' remaining'} · monthly estimate</small>
        </div>
      }) : <p className="muted">Add a category budget above to see spending comparisons.</p>}
      <p className="hub-footnote">Conversion rates are reference rates from {rateDate || 'the latest available update'}. If rates cannot load, comparisons in other currencies may be incomplete.</p>
    </section>
    <section className="hub-card">
      <h3>Cheaper alternatives and price comparisons</h3>
      <p>Prices below are shown only when a verified offer has been added to the STASH catalogue. Availability and plan features can vary by country.</p>
      {priceOffers.length ? <div className="recommendation-list">{priceOffers.map(offer=><div className="recommendation-row" key={offer.id}><b>{offer.provider} · {offer.plan}</b><span>{offer.category} · {offer.region||'Region not specified'}</span><strong>{offer.currency} {offer.price} / {offer.billing_period}</strong><small>Last verified: {offer.verified_at?new Date(offer.verified_at).toLocaleDateString():'Not recorded'} · <a href={offer.source_url} target="_blank" rel="noreferrer">Check provider source</a></small></div>)}</div>:<p className="muted">{priceLoadMessage}</p>}
      <div className="recommendation-list">
        <div className="recommendation-row"><b>Music subscriptions</b><span>Compare Spotify, Apple Music and YouTube Music</span><small>Check student, family and free plan options.</small></div>
        <div className="recommendation-row"><b>Video streaming</b><span>Compare Netflix, Disney+ and Prime Video</span><small>Consider rotating services instead of keeping several at once.</small></div>
        <div className="recommendation-row"><b>Cloud storage</b><span>Compare iCloud+, Google One and OneDrive</span><small>Check whether an existing device or productivity plan includes storage.</small></div>
        <div className="recommendation-row"><b>Productivity tools</b><span>Compare Microsoft 365, Google and Canva</span><small>Look for free tiers and overlapping features.</small></div>
      </div>
    </section>
    <section className="hub-card">
      <h3>Payment and trial notifications</h3>
      <p>STASH can show browser notifications for upcoming payments and trial end dates while the app is open.</p>
      <button type="button" className="primary" onClick={() => void requestNotifications()}>{permission==='granted'?'Browser notifications enabled':'Enable browser notifications'}</button>
      {notice && <p className="hub-message">{notice}</p>}
      <label className="hub-toggle"><input type="checkbox" checked={pushEnabled} onChange={e=>{if(e.target.checked)void enablePush();else void disablePush()}}/> Enable background push on this device</label><label className="hub-toggle"><input type="checkbox" checked={emailEnabled} onChange={e=>void saveEmailPreference(e.target.checked)}/> Email payment and trial reminders</label><button type="button" onClick={()=>void sendEmailReminders()} disabled={busy}>Send due email reminders</button><p className="hub-footnote">Email delivery requires a Resend API key and verified sender configured securely in Supabase. The button checks reminders when pressed; automatic daily scheduling still needs setup.</p>
    </section>
    <section className="hub-card"><h3>Bank connection (sandbox)</h3><p>Test STASH's bank-data integration using synthetic sample accounts only. This does not connect a real bank account.</p><button type="button" onClick={()=>void testBankSandbox()} disabled={busy}>Test bank sandbox</button>{bankResult&&<pre className="hub-code">{bankResult}</pre>}<p className="hub-footnote">Requires a test-only Banklink key configured as a Supabase secret. Real bank connections are not enabled in this build.</p></section>
  </div>
}
