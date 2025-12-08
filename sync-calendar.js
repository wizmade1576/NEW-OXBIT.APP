import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

// ✅ .env 에서 읽음
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
const COINMARKETCAL_KEY = process.env.COINMARKETCAL_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !COINMARKETCAL_KEY) {
  console.error('❌ ENV 누락됨. .env 설정 확인 필요')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function mapCategory(category = '') {
  if (category.includes('Listing') || category.includes('Exchange')) {
    return '상장일정'
  }
  if (
    category.includes('Token') ||
    category.includes('Mainnet') ||
    category.includes('Burn') ||
    category.includes('Airdrop') ||
    category.includes('Upgrade')
  ) {
    return '코인이벤트'
  }
  return '기타'
}

async function run() {
  const url = `https://developers.coinmarketcal.com/v1/events?access_token=${COINMARKETCAL_KEY}&max=50`
  const res = await fetch(url)
  const json = await res.json()

  let inserted = 0

  for (const ev of json.body || []) {
    const payload = {
      title: ev.title,
      coin: ev.coins?.[0]?.name || '',
      symbol: ev.coins?.[0]?.symbol || '',
      event_date: ev.date_event,
      category: ev.categories?.[0]?.name || '',
      ui_category: mapCategory(ev.categories?.[0]?.name || ''),
      description: ev.description || '',
      source: ev.source || ''
    }

    const { error } = await supabase.from('crypto_events').insert(payload)
    if (!error) inserted++
  }

  console.log('✅ 동기화 완료:', inserted)
}

run()
