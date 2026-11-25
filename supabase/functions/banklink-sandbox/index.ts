import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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

  // Deliberately test-only: this endpoint refuses production credentials.
  const upstream = await fetch('https://api.banklink.co.za/v1/accounts', {
    headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
  })
  const body = await upstream.text()
  return new Response(body, {
    status: upstream.status,
    headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') || 'application/json', 'Cache-Control': 'no-store' },
  })
})
