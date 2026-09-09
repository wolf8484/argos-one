import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: shops } = await db.from('shops').select('id,name,org_id')
for (const s of shops) {
  const { count } = await db.from('network_repair_contributions').select('id',{count:'exact',head:true}).eq('shop_id', s.id)
  const { count: jobs } = await db.from('jobs').select('id',{count:'exact',head:true}).eq('shop_id', s.id)
  console.log(`${s.name.padEnd(20)} netContributions=${String(count).padEnd(4)} jobs=${jobs}`)
}
