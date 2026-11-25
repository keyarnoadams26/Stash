import { useEffect, useMemo, useState } from 'react'

type Sub = { id:string; name:string; price:number; currency:string; payment_date:string; status:'active'|'cancelled'; category?:string; frequency?:string; trial_end?:string|null }
type Props = { subscriptions:Sub[]; budgets:Record<string,string>; displayCurrency:string; leadDays:number }

const monthly = (s:Sub) => Number(s.price) * ({weekly:52/12,monthly:1,quarterly:1/3,yearly:1/12}[s.frequency || 'monthly'] || 1)
const dateText = (d:string) => new Date(d+'T12:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})

export default function PersonalExtras({subscriptions,budgets,displayCurrency,leadDays}:Props) {
  const [rates,setRates] = useState<Record<string,number>>({ZAR:1})
  const [rateDate,setRateDate] = useState('')
  const [permission,setPermission] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  const [notice,setNotice] = useState('')
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
      <h3>Cheaper alternatives</h3>
      <p>These are ideas to investigate, not live price comparisons. Check current prices, local availability and features before switching.</p>
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
      <p className="hub-footnote">Background push and scheduled email notifications still need a notification provider and server-side scheduler.</p>
    </section>
  </div>
}
