import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

export interface ZReportConfig {
  enabled: boolean;
  recipient_email: string;
  send_hour: number;
  send_minute: number;
}

const KEY_PREFIX = "z_report_config_";

export function getZReportConfig(tenantId: string): ZReportConfig {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + tenantId);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { enabled: false, recipient_email: "", send_hour: 9, send_minute: 0 };
}

export function saveZReportConfig(tenantId: string, cfg: ZReportConfig) {
  localStorage.setItem(KEY_PREFIX + tenantId, JSON.stringify(cfg));
}

export interface ZReportData {
  date: string;
  total_sales: number;
  total_invoices: number;
  cash: number;
  upi: number;
  card: number;
  credit: number;
  other: number;
  total_tax: number;
  total_discount: number;
  total_profit: number;
  top_items: { name: string; qty: number; revenue: number }[];
  expenses: number;
  net: number;
}

export async function generateZReport(tenantId: string, branchId: string | null, dateOverride?: Date): Promise<ZReportData> {
  const target = dateOverride || (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d; })();
  const start = new Date(target); start.setHours(0, 0, 0, 0);
  const end = new Date(target); end.setHours(23, 59, 59, 999);

  let salesQ = supabase.from("sales").select("id, total, tax_total, discount_total, payment_mode, cost_total, status")
    .eq("tenant_id", tenantId).gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
  if (branchId) salesQ = salesQ.eq("branch_id", branchId);
  const { data: sales } = await salesQ;
  const salesArr = (sales as any[]) || [];

  const totals = { cash: 0, upi: 0, card: 0, credit: 0, other: 0 };
  let totalSales = 0, totalTax = 0, totalDiscount = 0, totalCost = 0;
  salesArr.forEach(s => {
    totalSales += Number(s.total || 0);
    totalTax += Number(s.tax_total || 0);
    totalDiscount += Number(s.discount_total || 0);
    totalCost += Number(s.cost_total || 0);
    const pm = (s.payment_mode || "other") as string;
    if (pm in totals) (totals as any)[pm] += Number(s.total || 0);
    else totals.other += Number(s.total || 0);
  });

  // Top items
  let topItems: ZReportData["top_items"] = [];
  if (salesArr.length) {
    const ids = salesArr.map(s => s.id);
    const { data: si } = await supabase.from("sale_items").select("item_name, quantity, total").in("sale_id", ids);
    const map = new Map<string, { qty: number; revenue: number }>();
    ((si as any[]) || []).forEach(it => {
      const cur = map.get(it.item_name) || { qty: 0, revenue: 0 };
      cur.qty += Number(it.quantity || 0);
      cur.revenue += Number(it.total || 0);
      map.set(it.item_name, cur);
    });
    topItems = Array.from(map.entries()).map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }

  // Expenses
  let expQ = supabase.from("expenses").select("amount").eq("tenant_id", tenantId)
    .gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
  if (branchId) expQ = expQ.eq("branch_id", branchId);
  const { data: exps } = await expQ;
  const expenses = ((exps as any[]) || []).reduce((s, e) => s + Number(e.amount || 0), 0);

  return {
    date: target.toISOString().split("T")[0],
    total_sales: totalSales,
    total_invoices: salesArr.length,
    ...totals,
    total_tax: totalTax,
    total_discount: totalDiscount,
    total_profit: totalSales - totalCost - totalTax,
    top_items: topItems,
    expenses,
    net: totalSales - expenses,
  };
}

export function downloadZReportExcel(z: ZReportData, businessName: string) {
  const wb = XLSX.utils.book_new();
  const summary = [
    { Metric: "Date", Value: z.date },
    { Metric: "Total Sales", Value: z.total_sales },
    { Metric: "Total Invoices", Value: z.total_invoices },
    { Metric: "Cash", Value: z.cash },
    { Metric: "UPI", Value: z.upi },
    { Metric: "Card", Value: z.card },
    { Metric: "Credit", Value: z.credit },
    { Metric: "Other", Value: z.other },
    { Metric: "Total Tax", Value: z.total_tax },
    { Metric: "Total Discount", Value: z.total_discount },
    { Metric: "Estimated Profit", Value: z.total_profit },
    { Metric: "Expenses", Value: z.expenses },
    { Metric: "Net", Value: z.net },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(z.top_items), "Top Items");
  XLSX.writeFile(wb, `Z-Report_${businessName.replace(/\s+/g, "_")}_${z.date}.xlsx`);
}

// Try to send via edge function; falls back to manual download
export async function sendZReportEmail(tenantId: string, branchId: string | null, recipientEmail: string, businessName: string): Promise<boolean> {
  try {
    const z = await generateZReport(tenantId, branchId);
    const { error } = await supabase.functions.invoke("send-z-report", {
      body: { recipient_email: recipientEmail, business_name: businessName, report: z },
    });
    if (error) throw error;
    return true;
  } catch (err: any) {
    console.error("Z-report email send failed:", err);
    return false;
  }
}
