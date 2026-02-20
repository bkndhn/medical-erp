import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Plus, Search, Eye, X } from "lucide-react";
import { toast } from "sonner";

export default function Purchases() {
  const { tenantId } = useAuth();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ supplier_id: "", invoice_number: "", subtotal: 0, tax_total: 0, grand_total: 0, notes: "" });
  const [saving, setSaving] = useState(false);

  const fetch_ = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from("purchases").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
      supabase.from("suppliers").select("id, name").eq("tenant_id", tenantId),
    ]);
    setPurchases((p as any) || []);
    setSuppliers((s as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, [tenantId]);

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("purchases").insert({
        tenant_id: tenantId, supplier_id: form.supplier_id || null,
        invoice_number: form.invoice_number, subtotal: form.subtotal,
        tax_total: form.tax_total, grand_total: form.grand_total, notes: form.notes,
      } as any);
      if (error) throw error;
      toast.success("Purchase recorded");
      setShowForm(false); fetch_();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const filtered = purchases.filter(p => {
    const q = search.toLowerCase();
    return !q || p.invoice_number?.toLowerCase().includes(q);
  });

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Truck className="h-6 w-6 text-primary" /> Purchases</h1>
            <p className="text-sm text-muted-foreground">{purchases.length} purchase orders</p>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New Purchase
          </button>
        </div>
        <div className="mt-3 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by invoice..." className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
      </header>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {loading ? <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div> :
        filtered.length === 0 ? <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><Truck className="h-12 w-12 mb-3 opacity-30" /><p>No purchases found</p></div> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border">
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Invoice #</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Date</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Status</th>
          <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Total</th>
        </tr></thead><tbody>
          {filtered.map(p => (
            <tr key={p.id} className="border-b border-border/30 hover:bg-muted/20">
              <td className="py-3 px-3 font-mono text-primary text-xs">{p.invoice_number || "—"}</td>
              <td className="py-3 px-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
              <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${p.status === "received" ? "bg-success/10 text-success" : "bg-accent/10 text-accent"}`}>{p.status}</span></td>
              <td className="py-3 px-3 text-right font-semibold text-foreground">₹{Number(p.grand_total).toFixed(0)}</td>
            </tr>
          ))}
        </tbody></table></div>}
      </div>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-foreground">New Purchase</h3><button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Supplier</label>
                <select value={form.supplier_id} onChange={e => setForm({...form, supplier_id: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="">Select supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {[{l:"Invoice Number",k:"invoice_number"},{l:"Subtotal",k:"subtotal",t:"number"},{l:"Tax",k:"tax_total",t:"number"},{l:"Grand Total",k:"grand_total",t:"number"},{l:"Notes",k:"notes"}].map(({l,k,t})=>(
                <div key={k}><label className="text-xs font-medium text-muted-foreground mb-1 block">{l}</label><input type={t||"text"} value={(form as any)[k]} onChange={e=>setForm({...form,[k]:t==="number"?parseFloat(e.target.value)||0:e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">{saving?"Saving...":"Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
