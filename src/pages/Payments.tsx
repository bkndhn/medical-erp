import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Search } from "lucide-react";

export default function Payments() {
  const { tenantId } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    supabase.from("payments").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false })
      .then(({ data }) => { setPayments((data as any) || []); setLoading(false); });
  }, [tenantId]);

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-6 py-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><CreditCard className="h-6 w-6 text-primary" /> Payments</h1>
        <p className="text-sm text-muted-foreground">{payments.length} transactions • Total: ₹{total.toLocaleString()}</p>
      </header>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {loading ? <div className="text-center text-muted-foreground py-12">Loading...</div> :
        payments.length === 0 ? <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><CreditCard className="h-12 w-12 mb-3 opacity-30" /><p>No payments recorded</p></div> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border">
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Date</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Mode</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Reference</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Notes</th>
          <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Amount</th>
        </tr></thead><tbody>
          {payments.map(p => (
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
