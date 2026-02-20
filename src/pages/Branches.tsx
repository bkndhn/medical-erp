import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Plus, Edit2, Trash2, X, Save } from "lucide-react";
import { toast } from "sonner";

export default function Branches() {
  const { tenantId } = useAuth();
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ name: "", code: "", address: "", phone: "", email: "", gst_number: "" });
  const [saving, setSaving] = useState(false);

  const fetch_ = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase.from("branches").select("*").eq("tenant_id", tenantId).order("name");
    setBranches((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, [tenantId]);

  const handleSave = async () => {
    if (!form.name || !tenantId) return;
    setSaving(true);
    try {
      if (form.id) {
        const { error } = await supabase.from("branches").update({ name: form.name, code: form.code, address: form.address, phone: form.phone, email: form.email, gst_number: form.gst_number }).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("branches").insert({ ...form, tenant_id: tenantId });
        if (error) throw error;
      }
      toast.success(form.id ? "Branch updated" : "Branch added");
      setShowForm(false); setForm({ name: "", code: "", address: "", phone: "", email: "", gst_number: "" }); fetch_();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this branch?")) return;
    await supabase.from("branches").delete().eq("id", id);
    toast.success("Deleted"); fetch_();
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" /> Branches</h1><p className="text-sm text-muted-foreground">{branches.length} branches</p></div>
          <button onClick={() => { setForm({ name: "", code: "", address: "", phone: "", email: "", gst_number: "" }); setShowForm(true); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"><Plus className="h-4 w-4" /> Add Branch</button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {loading ? <div className="text-center text-muted-foreground py-12">Loading...</div> :
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map(b => (
            <div key={b.id} className="glass-card rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div><h3 className="text-sm font-semibold text-foreground">{b.name}</h3>{b.code && <p className="text-xs text-muted-foreground font-mono">{b.code}</p>}</div>
                <div className="flex gap-1">
                  <button onClick={() => { setForm(b); setShowForm(true); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Edit2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              {b.address && <p className="text-xs text-muted-foreground mb-1">{b.address}</p>}
              {b.phone && <p className="text-xs text-muted-foreground">{b.phone}</p>}
              <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-medium ${b.is_active ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{b.is_active ? "Active" : "Inactive"}</span>
            </div>
          ))}
        </div>}
      </div>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-foreground">{form.id ? "Edit" : "New"} Branch</h3><button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button></div>
            <div className="space-y-3">
              {[{l:"Name *",k:"name"},{l:"Code",k:"code"},{l:"Address",k:"address"},{l:"Phone",k:"phone"},{l:"Email",k:"email"},{l:"GST Number",k:"gst_number"}].map(({l,k})=>(
                <div key={k}><label className="text-xs font-medium text-muted-foreground mb-1 block">{l}</label><input type="text" value={form[k]||""} onChange={e=>setForm({...form,[k]:e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium">Cancel</button>
              <button onClick={handleSave} disabled={saving||!form.name} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"><Save className="h-4 w-4" />{saving?"Saving...":"Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
