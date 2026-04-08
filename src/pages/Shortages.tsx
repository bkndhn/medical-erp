import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardList, Plus, Search, Trash2, CheckCircle2, Clock, Truck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface Shortage {
  id: string;
  item_name: string;
  requested_quantity: string;
  priority: "high" | "normal" | "low";
  status: "pending" | "ordered" | "fulfilled";
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  created_at: string;
}

export default function ShortageBook() {
  const { tenantId, hasRole } = useAuth();
  const isAdmin = hasRole("super_admin") || hasRole("admin");
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "ordered" | "fulfilled">("pending");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Shortage>>({
    item_name: "", requested_quantity: "1", priority: "normal", status: "pending", customer_name: "", customer_phone: "", notes: ""
  });

  useEffect(() => {
    if (!tenantId) return;
    loadShortages();

    const channel = supabase.channel('shortages-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shortage_book', filter: `tenant_id=eq.${tenantId}` }, () => {
        loadShortages();
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const loadShortages = async () => {
    try {
      const { data, error } = await supabase
        .from("shortage_book")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setShortages(data as Shortage[]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.item_name) return toast.error("Item name is required");

    setSaving(true);
    try {
      const { error } = formData.id
        ? await supabase.from("shortage_book").update(formData).eq("id", formData.id).eq("tenant_id", tenantId)
        : await supabase.from("shortage_book").insert([{ ...formData, tenant_id: tenantId }]);

      if (error) throw error;
      toast.success(formData.id ? "Updated successfully" : "Added to Shortage Book");
      setShowForm(false);
      setFormData({ item_name: "", requested_quantity: "1", priority: "normal", status: "pending", customer_name: "", customer_phone: "", notes: "" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this log?")) return;
    try {
      const { error } = await supabase.from("shortage_book").delete().eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
      toast.success("Deleted successfully");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase.from("shortage_book").update({ status: newStatus }).eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
      toast.success(`Marked as ${newStatus}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredShortages = shortages.filter(s => 
    s.status === activeTab && 
    (s.item_name.toLowerCase().includes(searchQuery.toLowerCase()) || (s.customer_name && s.customer_name.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  return (
    <div className="h-screen overflow-y-auto scrollbar-thin pb-20 md:pb-0">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="ml-10 md:ml-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" /> Shortage Book
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Track unavailable items and customer demands</p>
        </div>
        <button onClick={() => { setFormData({ item_name: "", requested_quantity: "1", priority: "normal", status: "pending" }); setShowForm(true); }} 
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all font-medium whitespace-nowrap shadow-lg shadow-primary/20 touch-manipulation">
          <Plus className="h-4 w-4" /> Log Demand
        </button>
      </header>

      <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex bg-muted/50 p-1 rounded-lg border border-border w-full sm:w-auto overflow-x-auto">
            {(["pending", "ordered", "fulfilled"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all capitalize whitespace-nowrap ${activeTab === tab ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"}`}>
                {tab === "pending" && <Clock className="h-4 w-4" />}
                {tab === "ordered" && <Truck className="h-4 w-4" />}
                {tab === "fulfilled" && <CheckCircle2 className="h-4 w-4" />}
                {tab}
                <span className="ml-1 px-2 py-0.5 rounded-full bg-muted text-[10px]">
                  {shortages.filter(s => s.status === tab).length}
                </span>
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search items or customers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground animate-pulse">Loading shortage book...</div>
        ) : filteredShortages.length === 0 ? (
          <div className="text-center py-12 glass-card rounded-xl border-dashed">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">No {activeTab} queries found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredShortages.map(item => (
              <div key={item.id} className="glass-card rounded-xl p-4 flex flex-col transition-all hover:border-primary/30">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-foreground text-lg line-clamp-1" title={item.item_name}>{item.item_name}</h3>
                  {item.priority === "high" && <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />}
                </div>
                
                <div className="text-sm text-muted-foreground mt-1 mb-4 flex-1">
                  <p><span className="font-medium text-foreground">Qty:</span> {item.requested_quantity || "N/A"}</p>
                  {item.customer_name && <p><span className="font-medium text-foreground">Customer:</span> {item.customer_name} {item.customer_phone}</p>}
                  {item.notes && <p className="mt-1 italic line-clamp-2 text-xs opacity-80">"{item.notes}"</p>}
                  <p className="text-[10px] mt-2 opacity-60">Logged: {new Date(item.created_at).toLocaleDateString()}</p>
                </div>

                <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
                  <div className="flex gap-2">
                    {activeTab === "pending" && (
                      <button onClick={() => updateStatus(item.id, "ordered")} className="text-xs px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 font-medium transition-colors">Mark Ordered</button>
                    )}
                    {activeTab === "ordered" && (
                      <button onClick={() => updateStatus(item.id, "fulfilled")} className="text-xs px-3 py-1.5 rounded-lg bg-success/10 border border-success/20 text-success hover:bg-success/20 font-medium transition-colors">Mark Fulfilled</button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setFormData(item); setShowForm(true); }} className="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground touch-manipulation"><Search className="h-4 w-4" /></button>
                    {isAdmin && (
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive touch-manipulation"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => !saving && setShowForm(false)}>
          <div className="bg-card border border-border shadow-2xl rounded-2xl p-6 w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground mb-4">{formData.id ? "Edit Demand" : "Log New Demand"}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Item Name / Medicine *</label>
                <input required type="text" value={formData.item_name || ""} onChange={e => setFormData({ ...formData, item_name: e.target.value })}
                  placeholder="e.g. Calpol 500mg" className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Quantity Needed</label>
                  <input type="text" value={formData.requested_quantity || ""} onChange={e => setFormData({ ...formData, requested_quantity: e.target.value })}
                    placeholder="e.g. 2 strips" className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Priority</label>
                  <select value={formData.priority || "normal"} onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="low">Low (Routine)</option>
                    <option value="normal">Normal</option>
                    <option value="high">High (Urgent)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Customer Name</label>
                  <input type="text" value={formData.customer_name || ""} onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone (To notify)</label>
                  <input type="text" value={formData.customer_phone || ""} onChange={e => setFormData({ ...formData, customer_phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes / Supplier</label>
                <input type="text" value={formData.notes || ""} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Request from Apollo distributor" className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50">
                  {saving ? "Saving..." : "Save Demand"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
