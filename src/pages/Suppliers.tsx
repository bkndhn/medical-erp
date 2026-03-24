import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Plus, Search, Edit2, Trash2, X, Save, Eye, FileText } from "lucide-react";
import { toast } from "sonner";
import DateFilterExport, { exportToExcel, exportToPDF } from "@/components/DateFilterExport";

interface Supplier {
  id: string; name: string; phone: string | null; email: string | null;
  address: string | null; gst_number: string | null; outstanding: number;
  created_at: string;
}

export default function Suppliers() {
  const { tenantId } = useAuth();
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Partial<Supplier> | null>(null);
  const [saving, setSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);

  const fetch_ = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase.from("suppliers").select("*").eq("tenant_id", tenantId).order("name");
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, [tenantId]);

  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    if (q && !i.name.toLowerCase().includes(q) && !i.phone?.includes(q) && !i.gst_number?.toLowerCase().includes(q)) return false;
    if (dateFrom && new Date(i.created_at) < dateFrom) return false;
    if (dateTo && new Date(i.created_at) > dateTo) return false;
    return true;
  });

  const totalOutstanding = filtered.reduce((s, i) => s + Number(i.outstanding || 0), 0);

  const handleSave = async () => {
    if (!editItem?.name || !tenantId) return;
    setSaving(true);
    try {
      if (editItem.id) {
        const { error } = await supabase.from("suppliers").update({ name: editItem.name, phone: editItem.phone, email: editItem.email, address: editItem.address, gst_number: editItem.gst_number }).eq("id", editItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert({ ...editItem, tenant_id: tenantId } as any);
        if (error) throw error;
      }
      toast.success(editItem.id ? "Supplier updated" : "Supplier added");
      setShowForm(false); setEditItem(null); fetch_();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete?")) return;
    await supabase.from("suppliers").delete().eq("id", id);
    toast.success("Deleted"); fetch_();
  };

  const viewHistory = async (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setLoadingPurchases(true);
    const { data } = await supabase.from("purchases").select("*").eq("supplier_id", supplier.id).order("created_at", { ascending: false });
    setPurchases((data as any) || []);
    setLoadingPurchases(false);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden pb-20 md:pb-0">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="ml-10 md:ml-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2"><Truck className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Suppliers</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} suppliers • Outstanding: ₹{totalOutstanding.toLocaleString()}</p>
          </div>
          <button onClick={() => { setEditItem({ name: "", phone: "", email: "", address: "", gst_number: "", outstanding: 0 }); setShowForm(true); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Add Supplier
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers..." className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <DateFilterExport
            defaultPreset="all_time"
            onFilter={(from, to) => { setDateFrom(from); setDateTo(to); }}
            onExportExcel={() => exportToExcel(filtered.map(s => ({ Name: s.name, Phone: s.phone || "", Email: s.email || "", GST: s.gst_number || "", Outstanding: Number(s.outstanding).toFixed(2) })), "suppliers")}
            onExportPDF={() => exportToPDF("Suppliers", ["Name", "Phone", "Email", "GST", "Outstanding"], filtered.map(s => [s.name, s.phone || "—", s.email || "—", s.gst_number || "—", `₹${Number(s.outstanding).toFixed(0)}`]))}
          />
        </div>
      </header>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
        {loading ? <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div> :
        filtered.length === 0 ? <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><Truck className="h-12 w-12 mb-3 opacity-30" /><p>No suppliers found</p></div> :
        <>
          <div className="hidden sm:block overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border">
            <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Name</th>
            <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Phone</th>
            <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Email</th>
            <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">GST</th>
            <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Outstanding</th>
            <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Actions</th>
          </tr></thead><tbody>
            {filtered.map(s => (
              <tr key={s.id} className="border-b border-border/30 hover:bg-muted/20">
                <td className="py-3 px-3 font-medium text-foreground">{s.name}</td>
                <td className="py-3 px-3 text-muted-foreground">{s.phone || "—"}</td>
                <td className="py-3 px-3 text-muted-foreground">{s.email || "—"}</td>
                <td className="py-3 px-3 text-muted-foreground font-mono text-xs">{s.gst_number || "—"}</td>
                <td className="py-3 px-3 text-right"><span className={Number(s.outstanding) > 0 ? "text-accent font-semibold" : "text-muted-foreground"}>₹{Number(s.outstanding).toFixed(0)}</span></td>
                <td className="py-3 px-3 text-right"><div className="flex items-center justify-end gap-1">
                  <button onClick={() => viewHistory(s)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary" title="Purchase history"><Eye className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { setEditItem(s); setShowForm(true); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div></td>
              </tr>
            ))}
          </tbody></table></div>
          <div className="sm:hidden space-y-2">
            {filtered.map(s => (
              <div key={s.id} className="glass-card rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div><h4 className="text-sm font-semibold text-foreground">{s.name}</h4><p className="text-xs text-muted-foreground">{s.phone || "No phone"}</p></div>
                  <div className="flex gap-1">
                    <button onClick={() => viewHistory(s)} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Eye className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { setEditItem(s); setShowForm(true); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Edit2 className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                {s.gst_number && <p className="text-xs text-muted-foreground font-mono">GST: {s.gst_number}</p>}
                <p className={`text-sm font-semibold mt-1 ${Number(s.outstanding) > 0 ? "text-accent" : "text-muted-foreground"}`}>Outstanding: ₹{Number(s.outstanding).toFixed(0)}</p>
              </div>
            ))}
          </div>
        </>}
      </div>

      {/* Add/Edit Form */}
      {showForm && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-foreground">{editItem.id ? "Edit" : "New"} Supplier</h3><button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button></div>
            <div className="space-y-3">
              {[{l:"Name *",k:"name"},{l:"Phone",k:"phone"},{l:"Email",k:"email"},{l:"Address",k:"address"},{l:"GST Number",k:"gst_number"}].map(({l,k})=>(
                <div key={k}><label className="text-xs font-medium text-muted-foreground mb-1 block">{l}</label><input type="text" value={(editItem as any)[k]??""} onChange={e=>setEditItem({...editItem,[k]:e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium">Cancel</button>
              <button onClick={handleSave} disabled={saving||!editItem.name} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"><Save className="h-4 w-4" />{saving?"Saving...":"Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase History Modal */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setSelectedSupplier(null)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto scrollbar-thin animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">{selectedSupplier.name}</h3>
                <p className="text-xs text-muted-foreground">Purchase History • {purchases.length} orders</p>
              </div>
              <button onClick={() => setSelectedSupplier(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            {loadingPurchases ? <div className="text-center text-muted-foreground py-8">Loading...</div> :
            purchases.length === 0 ? <p className="text-muted-foreground text-center py-8">No purchases from this supplier</p> :
            <div className="space-y-2">
              {purchases.map(p => (
                <div key={p.id} className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-primary">{p.invoice_number || "—"}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${p.status === "received" ? "bg-success/10 text-success" : "bg-accent/10 text-accent"}`}>{p.status}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                    <span className="text-sm font-semibold text-foreground">₹{Number(p.grand_total).toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>}
          </div>
        </div>
      )}
    </div>
  );
}
