import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { FileSpreadsheet, Download, Calendar, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type Mode = "gstr1" | "gstr3b" | "simple";

export default function GstReports() {
  const { tenantId, activeBranchId } = useAuth();
  const [mode, setMode] = useState<Mode>("gstr1");
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [tenant, setTenant] = useState<any>(null);

  useEffect(() => { if (tenantId) supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle().then(({ data }) => setTenant(data)); }, [tenantId]);

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const fromIso = new Date(from).toISOString();
      const toIso = new Date(to + "T23:59:59").toISOString();
      let q = supabase.from("sales").select("id, total, subtotal, tax_total, customer_id, branch_id, created_at, payment_mode, status")
        .eq("tenant_id", tenantId).gte("created_at", fromIso).lte("created_at", toIso);
      if (activeBranchId) q = q.eq("branch_id", activeBranchId);
      const { data: salesData } = await q;
      setSales((salesData as any[]) || []);
      if (salesData?.length) {
        const ids = salesData.map((s: any) => s.id);
        const { data: si } = await supabase.from("sale_items").select("*").in("sale_id", ids);
        setItems((si as any[]) || []);
      } else setItems([]);
    } catch (err: any) { toast.error(err.message); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [tenantId, activeBranchId]);

  // Group items by GST rate
  const rateSummary = useMemo(() => {
    const map = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number; total: number; count: number }>();
    items.forEach(it => {
      const rate = Number(it.gst_rate || 0);
      const total = Number(it.total || 0);
      const taxable = total / (1 + rate / 100);
      const tax = total - taxable;
      const cur = map.get(rate) || { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0, count: 0 };
      cur.taxable += taxable;
      cur.cgst += tax / 2;
      cur.sgst += tax / 2;
      cur.total += total;
      cur.count++;
      map.set(rate, cur);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([rate, v]) => ({ rate, ...v }));
  }, [items]);

  const totalTax = rateSummary.reduce((s, r) => s + r.cgst + r.sgst + r.igst, 0);
  const totalTaxable = rateSummary.reduce((s, r) => s + r.taxable, 0);
  const totalSales = rateSummary.reduce((s, r) => s + r.total, 0);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    if (mode === "gstr1" || mode === "simple") {
      const summary = rateSummary.map(r => ({
        "GST Rate (%)": r.rate, "Taxable Value": r.taxable.toFixed(2),
        "CGST": r.cgst.toFixed(2), "SGST": r.sgst.toFixed(2), "IGST": r.igst.toFixed(2),
        "Total Tax": (r.cgst + r.sgst + r.igst).toFixed(2), "Invoice Total": r.total.toFixed(2),
        "Invoices": r.count,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Rate-wise Summary");
    }

    if (mode === "gstr1") {
      const b2c = sales.filter(s => !s.customer_id).map(s => ({
        "Invoice No": s.id.slice(0, 8), "Invoice Date": new Date(s.created_at).toLocaleDateString(),
        "Total Value": Number(s.total).toFixed(2), "Taxable": Number(s.subtotal || 0).toFixed(2),
        "Tax Amount": Number(s.tax_total || 0).toFixed(2),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(b2c), "B2C Sales");
      const itemBreakup = items.map(it => ({
        "HSN": it.hsn_code || "", "Description": it.item_name, "Qty": it.quantity,
        "Rate": Number(it.unit_price).toFixed(2), "Total": Number(it.total).toFixed(2),
        "GST %": it.gst_rate || 0,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemBreakup), "Item-wise (HSN)");
    }

    if (mode === "gstr3b") {
      const summary3b = [
        { Section: "3.1(a) Outward taxable supplies", "Total Taxable": totalTaxable.toFixed(2),
          "Integrated": rateSummary.reduce((s, r) => s + r.igst, 0).toFixed(2),
          "Central": rateSummary.reduce((s, r) => s + r.cgst, 0).toFixed(2),
          "State/UT": rateSummary.reduce((s, r) => s + r.sgst, 0).toFixed(2),
          "Cess": "0.00",
        },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary3b), "GSTR-3B 3.1");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rateSummary.map(r => ({
        Rate: r.rate, Taxable: r.taxable.toFixed(2), "Total Tax": (r.cgst + r.sgst).toFixed(2),
      }))), "Rate-wise");
    }

    XLSX.writeFile(wb, `${mode}_${from}_to_${to}.xlsx`);
    toast.success("Exported");
  };

  const exportJson = () => {
    const payload = {
      gstin: tenant?.gst_number || "",
      legal_name: tenant?.business_name || "",
      period: { from, to },
      mode,
      summary: rateSummary,
      totals: { taxable: totalTaxable, tax: totalTax, sales: totalSales, invoices: sales.length },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${mode}_${from}_to_${to}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON exported");
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden pb-20 md:pb-0">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="ml-10 md:ml-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> GST Reports
            </h1>
            <p className="text-sm text-muted-foreground">{tenant?.business_name || "Your Business"} • GSTIN: {tenant?.gst_number || "—"}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
          <select value={mode} onChange={e => setMode(e.target.value as Mode)} className="col-span-2 sm:col-span-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm">
            <option value="gstr1">GSTR-1 (Outward)</option>
            <option value="gstr3b">GSTR-3B (Summary)</option>
            <option value="simple">Simple Tax Summary</option>
          </select>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full pl-8 pr-2 py-2 rounded-lg bg-muted border border-border text-sm" />
          </div>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full pl-8 pr-2 py-2 rounded-lg bg-muted border border-border text-sm" />
          </div>
          <button onClick={fetchData} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Refresh</button>
          <button onClick={exportExcel} className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-success text-white text-sm font-medium hover:bg-success/90">
            <Download className="h-4 w-4" /> Excel
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
        ) : (
          <div className="max-w-5xl space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="glass-card rounded-xl p-4">
                <div className="text-xs text-muted-foreground mb-1">Total Sales</div>
                <div className="text-xl font-bold flex items-center"><IndianRupee className="h-4 w-4" />{totalSales.toFixed(0)}</div>
              </div>
              <div className="glass-card rounded-xl p-4">
                <div className="text-xs text-muted-foreground mb-1">Taxable Value</div>
                <div className="text-xl font-bold flex items-center"><IndianRupee className="h-4 w-4" />{totalTaxable.toFixed(0)}</div>
              </div>
              <div className="glass-card rounded-xl p-4">
                <div className="text-xs text-muted-foreground mb-1">Total Tax</div>
                <div className="text-xl font-bold flex items-center text-primary"><IndianRupee className="h-4 w-4" />{totalTax.toFixed(0)}</div>
              </div>
              <div className="glass-card rounded-xl p-4">
                <div className="text-xs text-muted-foreground mb-1">Invoices</div>
                <div className="text-xl font-bold">{sales.length}</div>
              </div>
            </div>

            <div className="glass-card rounded-xl p-4 overflow-x-auto">
              <h3 className="font-semibold mb-3">Rate-wise Tax Summary</h3>
              <table className="w-full text-sm min-w-[600px]">
                <thead><tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 px-2">Rate</th>
                  <th className="text-right py-2 px-2">Taxable</th>
                  <th className="text-right py-2 px-2">CGST</th>
                  <th className="text-right py-2 px-2">SGST</th>
                  <th className="text-right py-2 px-2">Total Tax</th>
                  <th className="text-right py-2 px-2">Total</th>
                  <th className="text-right py-2 px-2">Invoices</th>
                </tr></thead>
                <tbody>
                  {rateSummary.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No sales in this period</td></tr>
                  ) : rateSummary.map(r => (
                    <tr key={r.rate} className="border-b border-border/30">
                      <td className="py-2 px-2 font-medium">{r.rate}%</td>
                      <td className="py-2 px-2 text-right">₹{r.taxable.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">₹{r.cgst.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">₹{r.sgst.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right font-semibold text-primary">₹{(r.cgst + r.sgst).toFixed(2)}</td>
                      <td className="py-2 px-2 text-right">₹{r.total.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <button onClick={exportJson} className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 border border-border">
                Export JSON
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
