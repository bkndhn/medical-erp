import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Users, Plus, Search, Edit2, Trash2, X, Save } from "lucide-react";
import { toast } from "sonner";

interface Customer {
  id: string; name: string; phone: string | null; email: string | null;
  address: string | null; gst_number: string | null; credit_limit: number; outstanding: number;
}

export default function Customers() {
  const { tenantId } = useAuth();
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Partial<Customer> | null>(null);
  const [saving, setSaving] = useState(false);

  const fetch_ = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase.from("customers").select("*").eq("tenant_id", tenantId).order("name");
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, [tenantId]);

  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    return !q || i.name.toLowerCase().includes(q) || i.phone?.includes(q) || i.email?.toLowerCase().includes(q);
  });

  const handleSave = async () => {
    if (!editItem?.name || !tenantId) return;
    setSaving(true);
    try {
      if (editItem.id) {
        const { error } = await supabase.from("customers").update({ name: editItem.name, phone: editItem.phone, email: editItem.email, address: editItem.address, gst_number: editItem.gst_number, credit_limit: editItem.credit_limit || 0 }).eq("id", editItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert({ ...editItem, tenant_id: tenantId } as any);
        if (error) throw error;
      }
      toast.success(editItem.id ? "Customer updated" : "Customer added");
      setShowForm(false); setEditItem(null); fetch_();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this customer?")) return;
    await supabase.from("customers").delete().eq("id", id);
    toast.success("Deleted"); fetch_();
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="ml-10 md:ml-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2"><Users className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Customers</h1>
            <p className="text-sm text-muted-foreground">{items.length} customers</p>
          </div>
          <button onClick={() => { setEditItem({ name: "", phone: "", email: "", address: "", gst_number: "", credit_limit: 0, outstanding: 0 }); setShowForm(true); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Add Customer
          </button>
        </div>
        <div className="mt-3 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..." className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
      </header>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {loading ? <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div> :
        filtered.length === 0 ? <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><Users className="h-12 w-12 mb-3 opacity-30" /><p>No customers found</p></div> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border">
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Name</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Phone</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Email</th>
          <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Credit Limit</th>
          <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Outstanding</th>
          <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Actions</th>
        </tr></thead><tbody>
          {filtered.map(c => (
            <tr key={c.id} className="border-b border-border/30 hover:bg-muted/20">
              <td className="py-3 px-3 font-medium text-foreground">{c.name}</td>
              <td className="py-3 px-3 text-muted-foreground">{c.phone || "—"}</td>
              <td className="py-3 px-3 text-muted-foreground">{c.email || "—"}</td>
              <td className="py-3 px-3 text-right text-foreground">₹{Number(c.credit_limit).toFixed(0)}</td>
              <td className="py-3 px-3 text-right"><span className={Number(c.outstanding) > 0 ? "text-accent font-semibold" : "text-muted-foreground"}>₹{Number(c.outstanding).toFixed(0)}</span></td>
              <td className="py-3 px-3 text-right"><div className="flex items-center justify-end gap-1">
                <button onClick={() => { setEditItem(c); setShowForm(true); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="h-3.5 w-3.5" /></button>
                <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div></td>
            </tr>
          ))}
        </tbody></table></div>}
      </div>
      {showForm && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-foreground">{editItem.id ? "Edit" : "New"} Customer</h3><button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button></div>
            <div className="space-y-3">
              {[{l:"Name *",k:"name"},{l:"Phone",k:"phone"},{l:"Email",k:"email"},{l:"Address",k:"address"},{l:"GST Number",k:"gst_number"},{l:"Credit Limit",k:"credit_limit",t:"number"}].map(({l,k,t})=>(
                <div key={k}><label className="text-xs font-medium text-muted-foreground mb-1 block">{l}</label><input type={t||"text"} value={(editItem as any)[k]??""} onChange={e=>setEditItem({...editItem,[k]:t==="number"?parseFloat(e.target.value)||0:e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium">Cancel</button>
              <button onClick={handleSave} disabled={saving||!editItem.name} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"><Save className="h-4 w-4" />{saving?"Saving...":"Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
