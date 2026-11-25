import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const auth = req.headers.get('Authorization')
  if (!auth) return new Response('Unauthorized', { status: 401 })
  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('STASH_FROM_EMAIL')
  if (!resendKey || !from) return new Response(JSON.stringify({ error: 'Email provider is not configured.' }), { status: 503, headers: { 'Content-Type': 'application/json' } })

  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user?.email || !user.email_confirmed_at) return new Response('Verified email required', { status: 401 })
  const { data: prefs } = await userClient.from('stash_notification_preferences').select('*').eq('user_id', user.id).maybeSingle()
  if (!prefs?.email_enabled) return new Response(JSON.stringify({ sent: 0, reason: 'Email reminders are disabled.' }), { headers: { 'Content-Type': 'application/json' } })

  const { data: subscriptions, error } = await userClient.from('subscriptions').select('id,name,price,currency,payment_date,trial_end,status').eq('status','active')
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  const today = new Date()
  const dateOnly = today.toISOString().slice(0,10)
  const due = (subscriptions || []).flatMap((s: any) => {
    const events: any[] = []
    const days = Math.ceil((new Date(s.payment_date+'T12:00:00Z').getTime()-new Date(dateOnly+'T12:00:00Z').getTime())/86400000)
    if (days >= 0 && days <= prefs.reminder_days) events.push({ key: 'payment:'+s.id+':'+s.payment_date, title: s.name+' payment due '+s.payment_date, amount: s.price+' '+s.currency })
    if (s.trial_end) {
      const trialDays = Math.ceil((new Date(s.trial_end+'T12:00:00Z').getTime()-new Date(dateOnly+'T12:00:00Z').getTime())/86400000)
      if (trialDays >= 0 && trialDays <= prefs.reminder_days) events.push({ key: 'trial:'+s.id+':'+s.trial_end, title: s.name+' free trial ends '+s.trial_end, amount: '' })
    }
    return events
  })
  if (!due.length) return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json' } })

  const admin = createClient(url, service)
  let sent = 0
  for (const item of due) {
    const { data: existing } = await admin.from('stash_notification_log').select('id').eq('user_id',user.id).eq('event_key',item.key).eq('channel','email').maybeSingle()
    if (existing) continue
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer '+resendKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [user.email], subject: 'STASH reminder: '+item.title, text: item.title+(item.amount?' — '+item.amount:'')+'\n\nOpen STASH to review your subscription.' }),
    })
    if (!response.ok) continue
    await admin.from('stash_notification_log').insert({ user_id:user.id, event_key:item.key, channel:'email' })
    sent++
  }
  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
})
