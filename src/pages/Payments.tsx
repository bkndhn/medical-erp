import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Search } from "lucide-react";
import DateFilterExport, { exportToExcel, exportToPDF } from "@/components/DateFilterExport";

export default function Payments() {
  const { tenantId } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    supabase.from("payments").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false })
      .then(({ data }) => { setPayments((data as any) || []); setLoading(false); });
  }, [tenantId]);

  const filtered = useMemo(() => {
    let result = payments;
    if (dateRange.from) result = result.filter(p => new Date(p.created_at) >= dateRange.from!);
    if (dateRange.to) result = result.filter(p => new Date(p.created_at) <= dateRange.to!);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.payment_mode?.toLowerCase().includes(q) ||
        p.reference_number?.toLowerCase().includes(q) ||
        p.notes?.toLowerCase().includes(q) ||
        String(p.amount).includes(q)
      );
    }
    return result;
  }, [payments, dateRange, searchQuery]);

  const total = filtered.reduce((s, p) => s + Number(p.amount), 0);

  const handleExportExcel = () => {
    exportToExcel(filtered.map(p => ({
      Date: new Date(p.created_at).toLocaleDateString(),
      Mode: p.payment_mode,
      Reference: p.reference_number || "—",
      Notes: p.notes || "—",
      Amount: Number(p.amount).toFixed(2),
    })), "payments");
  };

  const handleExportPDF = () => {
    exportToPDF("Payments Report",
      ["Date", "Mode", "Reference", "Notes", "Amount"],
      filtered.map(p => [
        new Date(p.created_at).toLocaleDateString(),
        p.payment_mode,
        p.reference_number || "—",
        p.notes || "—",
        `₹${Number(p.amount).toFixed(2)}`,
      ])
    );
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2 ml-10 md:ml-0">
          <CreditCard className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Payments
        </h1>
        <p className="text-sm text-muted-foreground">{filtered.length} transactions • Total: ₹{total.toLocaleString()}</p>
        <div className="mt-3 space-y-2">
          <DateFilterExport onFilter={(from, to) => setDateRange({ from, to })} onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} />
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by mode, reference, notes..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
        {loading ? <div className="text-center text-muted-foreground py-12">Loading...</div> :
        filtered.length === 0 ? <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><CreditCard className="h-12 w-12 mb-3 opacity-30" /><p>No payments found</p></div> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border">
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Date</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Mode</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Reference</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Notes</th>
          <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Amount</th>
        </tr></thead><tbody>
          {filtered.map(p => (
            <tr key={p.id} className="border-b border-border/30 hover:bg-muted/20">
              <td className="py-3 px-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary uppercase">{p.payment_mode}</span></td>
              <td className="py-3 px-3 text-muted-foreground font-mono text-xs">{p.reference_number || "—"}</td>
              <td className="py-3 px-3 text-muted-foreground">{p.notes || "—"}</td>
              <td className="py-3 px-3 text-right font-semibold text-foreground">₹{Number(p.amount).toFixed(0)}</td>
            </tr>
          ))}
        </tbody></table></div>}
      </div>
    </div>
  );
}
