import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const rows = (value:any):any[] => Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : Array.isArray(value?.data?.transactions) ? value.data.transactions : []

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })
  const auth = req.headers.get('Authorization')
  if (!auth) return new Response('Unauthorized', { status: 401, headers: cors })
  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  const key = Deno.env.get('BANKLINK_TEST_API_KEY')
  if (!url || !anon || !key || !key.startsWith('sk_test_')) {
    return new Response(JSON.stringify({ error: 'Bank sandbox is not configured. A test-only provider key is required.' }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
  const client = createClient(url, anon, { global: { headers: { Authorization: auth } } })
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) return new Response('Unauthorized', { status: 401, headers: cors })

  // Sandbox-only: no live bank credentials or real account data can be requested here.
  const headers = { Authorization: 'Bearer '+key, Accept: 'application/json' }
  const accountsResponse = await fetch('https://api.banklink.co.za/v1/accounts', { headers })
  if (!accountsResponse.ok) return new Response(await accountsResponse.text(), { status: accountsResponse.status, headers: cors })
  const accountPayload = await accountsResponse.json()
  const accounts = rows(accountPayload)
  const allTransactions:any[] = []
  for (const account of accounts) {
    const id = account.id || account.account_id
    if (!id) continue
    const txResponse = await fetch('https://api.banklink.co.za/v1/accounts/'+encodeURIComponent(String(id))+'/transactions', { headers })
    if (!txResponse.ok) continue
    const payload = await txResponse.json()
    for (const tx of rows(payload)) allTransactions.push({ ...tx, _account: account.name || account.display_name || 'Sandbox account' })
  }

  const grouped = new Map<string, any[]>()
  for (const tx of allTransactions) {
    const description = String(tx.description || tx.reference || tx.merchant || '').trim()
    const amount = Number(tx.amount)
    const date = String(tx.date || tx.transaction_date || tx.posted_at || '').slice(0,10)
    if (!description || !Number.isFinite(amount) || !date) continue
    const key = description.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()+'|'+Math.abs(amount).toFixed(2)+'|'+String(tx.currency || '')
    grouped.set(key,[...(grouped.get(key)||[]),{description,amount,currency:tx.currency || '',date,account:tx._account}])
  }
  const recurringCandidates:any[] = []
  for (const group of grouped.values()) {
    const sorted = group.sort((a,b)=>a.date.localeCompare(b.date))
    if (sorted.length < 2) continue
    const gaps = sorted.slice(1).map((x,i)=>Math.round((new Date(x.date+'T12:00:00Z').getTime()-new Date(sorted[i].date+'T12:00:00Z').getTime())/86400000))
    const monthly = gaps.every(n=>n>=25&&n<=35)
    const weekly = gaps.every(n=>n>=6&&n<=8)
    const quarterly = gaps.every(n=>n>=85&&n<=95)
    if (monthly||weekly||quarterly) recurringCandidates.push({name:sorted[0].description,amount:Math.abs(sorted[0].amount),currency:sorted[0].currency,frequency:monthly?'monthly':weekly?'weekly':'quarterly',occurrences:sorted.length,lastSeen:sorted[sorted.length-1].date,account:sorted[0].account,source:'synthetic sandbox transactions'})
  }
  return new Response(JSON.stringify({mode:'sandbox',accounts,transactionCount:allTransactions.length,recurringCandidates}), {
    headers: { ...cors, 'Content-Type':'application/json', 'Cache-Control':'no-store' },
  })
})
