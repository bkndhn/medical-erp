// AI demand forecasting edge function
// Pulls sales history for items, computes statistical forecast (rolling avg + trend),
// and optionally enriches with Lovable AI seasonality classification.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface ForecastBody {
  tenant_id: string;
  branch_id?: string | null;
  item_ids: string[];
  target_days?: number; // horizon to cover, default 15
  use_ai?: boolean;     // whether to call Lovable AI for trend label
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as ForecastBody;
    if (!body?.tenant_id || !Array.isArray(body.item_ids) || body.item_ids.length === 0) {
      return new Response(JSON.stringify({ error: "tenant_id and item_ids required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const targetDays = Math.max(1, Math.min(90, body.target_days ?? 15));
    const useAi = !!body.use_ai;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 90-day window
    const since = new Date(); since.setDate(since.getDate() - 90);
    const sinceIso = since.toISOString();

    let q = supabase
      .from("sale_items")
      .select("item_id, quantity, created_at, sales!inner(tenant_id, branch_id, created_at)")
      .eq("sales.tenant_id", body.tenant_id)
      .in("item_id", body.item_ids)
      .gte("sales.created_at", sinceIso);
    if (body.branch_id) q = q.eq("sales.branch_id", body.branch_id);

    const { data: rows, error } = await q.limit(50000);
    if (error) throw error;

    // Aggregate per item per day
    type DayMap = Map<string, number>;
    const perItem = new Map<string, DayMap>();
    for (const r of (rows as any[]) || []) {
      const id = r.item_id as string;
      if (!id) continue;
      const day = (r.sales?.created_at || r.created_at || "").slice(0, 10);
      if (!day) continue;
      if (!perItem.has(id)) perItem.set(id, new Map());
      const m = perItem.get(id)!;
      m.set(day, (m.get(day) || 0) + Number(r.quantity || 0));
    }

    const todayMs = Date.now();
    const forecasts = body.item_ids.map((id) => {
      const m = perItem.get(id) || new Map<string, number>();
      let sum7 = 0, sum30 = 0, sum90 = 0, daysWithSales = 0, total = 0;
      for (const [day, qty] of m) {
        const ageDays = Math.floor((todayMs - new Date(day).getTime()) / 86400000);
        total += qty; if (qty > 0) daysWithSales++;
        if (ageDays <= 7) sum7 += qty;
        if (ageDays <= 30) sum30 += qty;
        if (ageDays <= 90) sum90 += qty;
      }
      const avg7 = sum7 / 7;
      const avg30 = sum30 / 30;
      const avg90 = sum90 / 90;
      // Weighted blend: recent activity weighted heavier
      const dailyForecast = 0.5 * avg7 + 0.3 * avg30 + 0.2 * avg90;
      const trend = avg7 > avg30 * 1.15 ? "rising" : avg7 < avg30 * 0.85 ? "falling" : "stable";
      const recommended = Math.ceil(dailyForecast * targetDays);
      return {
        item_id: id,
        daily_avg_7d: +avg7.toFixed(2),
        daily_avg_30d: +avg30.toFixed(2),
        daily_avg_90d: +avg90.toFixed(2),
        days_with_sales_90d: daysWithSales,
        total_sold_90d: total,
        trend,
        recommended_qty: recommended,
        target_days: targetDays,
      };
    });

    // Optional AI seasonality enrichment
    let aiNotes: Record<string, string> = {};
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (useAi && apiKey && forecasts.length > 0) {
      try {
        const compact = forecasts.slice(0, 20).map(f => ({
          id: f.item_id, d7: f.daily_avg_7d, d30: f.daily_avg_30d, d90: f.daily_avg_90d, trend: f.trend,
        }));
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "You analyse pharmacy sales velocity. Reply ONLY with valid JSON: {notes:{item_id:short_advice_<=80chars}}." },
              { role: "user", content: `Items velocity (units/day): ${JSON.stringify(compact)}. Give 1-line restocking advice per item.` },
            ],
          }),
        });
        if (aiRes.ok) {
          const j = await aiRes.json();
          const txt = j?.choices?.[0]?.message?.content || "";
          const match = txt.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            aiNotes = parsed.notes || {};
          }
        }
      } catch (_) { /* AI is best-effort */ }
    }

    return new Response(
      JSON.stringify({
        forecasts: forecasts.map(f => ({ ...f, ai_note: aiNotes[f.item_id] || null })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
