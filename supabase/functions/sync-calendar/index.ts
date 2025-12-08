import { serve } from "https://deno.land/std@0.203.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

function mapUiCategory(title = "") {
  const text = title.toLowerCase()

  if (text.includes("list")) return "상장일정"
  if (text.includes("futures")) return "상장일정"
  if (
    text.includes("mainnet") ||
    text.includes("airdrop") ||
    text.includes("burn") ||
    text.includes("upgrade") ||
    text.includes("unlock")
  ) return "코인이벤트"

  return "기타"
}

serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing environment variables" }),
        { status: 500, headers: { "content-type": "application/json" } }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    })

    // ✅ Binance 공식 공지
    const url =
      "https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&pageNo=1&pageSize=20"

    const res = await fetch(url, {
      headers: {
        "accept": "application/json",
        "user-agent": "Mozilla/5.0",
        "accept-language": "en-US,en;q=0.9"
      }
    })

    const json = await res.json()

    const catalogs = json?.data?.catalogs || []
    const articles = catalogs.flatMap((c: any) => c?.articles || [])

    // ✅ ✅ ✅ 최근 30일(1개월) 필터 기준
    const now = Date.now()
    const MAX_DAYS = 30
    const MAX_MS = MAX_DAYS * 24 * 60 * 60 * 1000

    let inserted = 0

    for (const ev of articles) {
      const release = Number(ev?.releaseDate || 0)

      // ✅ 최근 1개월 지난 데이터는 전부 스킵
      if (!release || now - release > MAX_MS) {
        continue
      }

      const payload = {
        title: ev?.title || "",
        coin: ev?.title || "",
        symbol: "",
        event_date: ev?.releaseDate
          ? new Date(ev.releaseDate).toISOString()
          : "",
        category: ev?.type || "",
        ui_category: mapUiCategory(ev?.title || ""),
        description: ev?.description || ev?.summary || "",
        source: `https://www.binance.com/en/support/announcement/${ev?.code}`
      }

      const { error } = await supabase
        .from("crypto_events")
        .upsert(payload, {
          onConflict: "title,event_date"
        })

      if (!error) inserted++
    }

    return new Response(
      JSON.stringify({
        success: true,
        fetched: articles.length,
        inserted
      }),
      { headers: { "content-type": "application/json" } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"

    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { "content-type": "application/json" } }
    )
  }
})
