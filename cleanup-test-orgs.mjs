// One-off cleanup: removes the three leftover "My workshop" test orgs.
//
// Deliberately does NOT touch Dummy Shop A/B (test) -- those hold 18 of the
// 20 network_repair_contributions rows and exist so network_repair_patterns
// can clear its ">= 2 distinct shops" floor (see migration 0038). Deleting
// them would empty "Network cases" across the whole demo.
//
// Run from the project root:  node cleanup-test-orgs.mjs
// Then delete this file.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n')
  .filter(l => l.includes('='))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const TARGET_ORGS = [
  '4cd32114-94d0-4412-aaf8-85c1a92ccca8', // My workshop -> shop d010ea6a (7 jobs, 2 contributions)
  'a24240eb-3f00-4355-889b-c11613365d0d', // My workshop -> shop 9f7b8a0a (empty)
  'b90c75a1-c143-451c-bb16-5ff76179e421', // My workshop -> shop 58cefe32 (empty)
]

// Collect the logins first: profiles cascade away with the org, but the
// auth.users rows behind them do not, and a lingering user keeps its email
// and phone number reserved against a future signup.
const { data: shops } = await db.from('shops').select('id,name,org_id').in('org_id', TARGET_ORGS)
const shopIds = shops.map(s => s.id)
const { data: profs } = shopIds.length
  ? await db.from('profiles').select('id,full_name,shop_id').in('shop_id', shopIds)
  : { data: [] }

console.log('shops to remove :', shops.map(s => `${s.name} (${s.id.slice(0, 8)})`).join(', ') || '(none)')
console.log('logins to remove:', profs.map(p => p.full_name).join(', ') || '(none)')
console.log('')

for (const org of TARGET_ORGS) {
  const { error } = await db.from('organisations').delete().eq('id', org)
  console.log(error ? `FAIL org ${org.slice(0, 8)}: ${error.message}` : `deleted org ${org.slice(0, 8)}`)
}

for (const p of profs) {
  const { error } = await db.auth.admin.deleteUser(p.id)
  console.log(error ? `FAIL login ${p.full_name}: ${error.message}` : `deleted login ${p.full_name}`)
}

const { data: orgsLeft } = await db.from('organisations').select('name')
const { data: shopsLeft } = await db.from('shops').select('name')
const { count: contrib } = await db.from('network_repair_contributions').select('id', { count: 'exact', head: true })

console.log('\nORGS LEFT :', orgsLeft.map(o => o.name).join(' | '))
console.log('SHOPS LEFT:', shopsLeft.map(s => s.name).join(' | '))
console.log('network contributions remaining:', contrib, '(expect 18)')
