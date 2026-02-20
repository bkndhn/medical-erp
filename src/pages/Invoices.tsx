import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Search, Eye } from "lucide-react";

export default function Invoices() {
  const { tenantId } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    supabase.from("sales").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false })
      .then(({ data }) => { setSales((data as any) || []); setLoading(false); });
  }, [tenantId]);

  const filtered = sales.filter(s => !search || s.invoice_number?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-6 py-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><FileText className="h-6 w-6 text-primary" /> Invoices</h1>
        <p className="text-sm text-muted-foreground">{sales.length} invoices</p>
        <div className="mt-3 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..." className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
      </header>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {loading ? <div className="text-center text-muted-foreground py-12">Loading...</div> :
        filtered.length === 0 ? <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><FileText className="h-12 w-12 mb-3 opacity-30" /><p>No invoices yet</p></div> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border">
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Invoice #</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Date</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Payment</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Status</th>
          <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Amount</th>
        </tr></thead><tbody>
          {filtered.map(s => (
            <tr key={s.id} className="border-b border-border/30 hover:bg-muted/20">
              <td className="py-3 px-3 font-mono text-primary text-xs">{s.invoice_number}</td>
              <td className="py-3 px-3 text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground uppercase">{s.payment_mode}</span></td>
              <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${s.status === "completed" ? "bg-success/10 text-success" : s.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent"}`}>{s.status}</span></td>
              <td className="py-3 px-3 text-right font-semibold text-foreground">₹{Number(s.grand_total).toFixed(0)}</td>
            </tr>
          ))}
        </tbody></table></div>}
      </div>
    </div>
  );
}
