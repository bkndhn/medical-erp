// Rx OCR edge function — extracts medicines from a prescription image using Lovable AI vision.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface RxBody {
  image_base64: string;        // data URL or raw base64
  mime_type?: string;          // e.g. image/jpeg
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as RxBody;
    if (!body?.image_base64) {
      return new Response(JSON.stringify({ error: "image_base64 required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const dataUrl = body.image_base64.startsWith("data:")
      ? body.image_base64
      : `data:${body.mime_type || "image/jpeg"};base64,${body.image_base64}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a pharmacy OCR assistant. Extract medicines from a doctor's prescription image. Reply ONLY with strict JSON: {medicines:[{name, strength, dosage, duration, quantity}], doctor, patient, date, notes}. Use empty string when unknown." },
          { role: "user", content: [
            { type: "text", text: "Extract structured prescription data." },
            { type: "image_url", image_url: { url: dataUrl } },
          ]},
        ],
      }),
    });
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: `AI gateway ${aiRes.status}`, detail: txt }), {
        status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const j = await aiRes.json();
    const raw = j?.choices?.[0]?.message?.content || "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    let parsed: any = {};
    try { parsed = JSON.parse(match ? match[0] : raw); } catch { parsed = { raw }; }
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
