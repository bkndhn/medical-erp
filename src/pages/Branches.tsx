import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Plus, Edit2, Trash2, X, Save, Search, Users, Package, ToggleLeft, ToggleRight, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function Branches() {
  const { tenantId } = useAuth();
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [form, setForm] = useState<any>({ name: "", code: "", address: "", phone: "", email: "", gst_number: "" });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [maxBranches, setMaxBranches] = useState<number>(1);
  const [tenantPlan, setTenantPlan] = useState<string>("free");
  const [branchStats, setBranchStats] = useState<Record<string, { users: number; devices: number; items: number }>>({});

  const fetch_ = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: b }, { data: profiles }, { data: devices }, { data: items }, { data: tenant }] = await Promise.all([
      supabase.from("branches").select("*").eq("tenant_id", tenantId).order("name"),
      supabase.from("profiles").select("branch_id").eq("tenant_id", tenantId),
      supabase.from("devices").select("branch_id").eq("tenant_id", tenantId),
      supabase.from("items").select("branch_id").eq("tenant_id", tenantId),
      supabase.from("tenants").select("max_branches, subscription").eq("id", tenantId).single(),
    ]);
    setBranches((b as any) || []);
    if (tenant?.max_branches) setMaxBranches(tenant.max_branches);
    if (tenant?.subscription) setTenantPlan(tenant.subscription);

    const stats: Record<string, { users: number; devices: number; items: number }> = {};
    (b || []).forEach((br: any) => { stats[br.id] = { users: 0, devices: 0, items: 0 }; });
    (profiles || []).forEach((p: any) => { if (p.branch_id && stats[p.branch_id]) stats[p.branch_id].users++; });
    (devices || []).forEach((d: any) => { if (d.branch_id && stats[d.branch_id]) stats[d.branch_id].devices++; });
    (items || []).forEach((i: any) => { if (i.branch_id && stats[i.branch_id]) stats[i.branch_id].items++; });
    setBranchStats(stats);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, [tenantId]);

  const atLimit = branches.length >= maxBranches;
  const usagePct = Math.min(100, Math.round((branches.length / maxBranches) * 100));
  const quotaColor = usagePct >= 100 ? "bg-destructive" : usagePct >= 80 ? "bg-accent" : "bg-success";

  const filtered = branches.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return b.name.toLowerCase().includes(q) || b.code?.toLowerCase().includes(q) || b.address?.toLowerCase().includes(q);
  });

  const handleSave = async () => {
    if (!form.name || !tenantId) return;
    setSaving(true);
    try {
      if (form.id) {
        const { error } = await supabase.from("branches").update({
          name: form.name, code: form.code, address: form.address,
          phone: form.phone, email: form.email, gst_number: form.gst_number, is_active: form.is_active,
        }).eq("id", form.id);
        if (error) throw error;
      } else {
        if (atLimit) { setShowLimitModal(true); setSaving(false); return; }
        const { error } = await supabase.from("branches").insert({ ...form, tenant_id: tenantId });
        if (error) throw error;
      }
      toast.success(form.id ? "Branch updated" : "Branch added");
      setShowForm(false);
      setForm({ name: "", code: "", address: "", phone: "", email: "", gst_number: "" });
      fetch_();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (branch: any) => {
    await supabase.from("branches").update({ is_active: !branch.is_active }).eq("id", branch.id);
    toast.success(branch.is_active ? "Branch deactivated" : "Branch activated");
    fetch_();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this branch? This may affect assigned users and devices.")) return;
    await supabase.from("branches").delete().eq("id", id);
    toast.success("Deleted");
    fetch_();
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden pb-20 md:pb-0">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="ml-10 md:ml-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Branches
            </h1>
            <p className="text-sm text-muted-foreground">
              {branches.length} / {maxBranches} branches • {branches.filter(b => b.is_active).length} active
            </p>
          </div>
          <button
            onClick={() => {
              if (atLimit) { setShowLimitModal(true); return; }
              setForm({ name: "", code: "", address: "", phone: "", email: "", gst_number: "", is_active: true });
              setShowForm(true);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium touch-manipulation transition-all ${
              atLimit
                ? "bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {atLimit ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {atLimit ? "Limit Reached" : "Add Branch"}
          </button>
        </div>

        {/* Quota progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Branch quota</span>
            <span className={usagePct >= 100 ? "text-destructive font-semibold" : usagePct >= 80 ? "text-accent font-semibold" : ""}>
              {branches.length}/{maxBranches} used ({usagePct}%)
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${quotaColor}`} style={{ width: `${usagePct}%` }} />
          </div>
          {atLimit && (
            <p className="text-[10px] text-destructive mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Branch limit reached. Contact your admin to upgrade your plan.
            </p>
          )}
        </div>

        <div className="mt-3 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search branches..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(b => {
              const stats = branchStats[b.id] || { users: 0, devices: 0, items: 0 };
              return (
                <div key={b.id} className={`glass-card rounded-xl p-5 transition-opacity ${!b.is_active ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{b.name}</h3>
                      {b.code && <p className="text-xs text-muted-foreground font-mono">{b.code}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => toggleActive(b)} className="p-1.5 rounded hover:bg-muted text-muted-foreground" title={b.is_active ? "Deactivate" : "Activate"}>
                        {b.is_active ? <ToggleRight className="h-3.5 w-3.5 text-success" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => { setForm(b); setShowForm(true); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {b.address && <p className="text-xs text-muted-foreground mb-1">{b.address}</p>}
                  {b.phone && <p className="text-xs text-muted-foreground mb-1">📞 {b.phone}</p>}
                  {b.gst_number && <p className="text-xs text-muted-foreground font-mono mb-2">GST: {b.gst_number}</p>}
                  <div className="flex gap-3 mt-2">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> {stats.users} users</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" /> {stats.items} items</span>
                  </div>
                  <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-medium ${b.is_active ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    {b.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Branch Limit Reached Modal ─────────────────────────────── */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setShowLimitModal(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="w-16 h-16 rounded-full bg-accent/10 border-2 border-accent/30 flex items-center justify-center mx-auto mb-4">
                <Lock className="h-8 w-8 text-accent" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Branch Limit Reached</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your current plan allows <strong className="text-foreground">{maxBranches}</strong> branch{maxBranches === 1 ? "" : "es"}.
              </p>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 mb-4 space-y-2.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Current Plan</span>
                <span className="font-semibold text-foreground capitalize">{tenantPlan}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Branches Used</span>
                <span className="font-semibold text-destructive">{branches.length} / {maxBranches}</span>
              </div>
              <div className="h-2 bg-background rounded-full overflow-hidden mt-1">
                <div className="h-full rounded-full bg-destructive" style={{ width: "100%" }} />
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-5 text-center">
              <p className="text-xs text-muted-foreground">
                To add more branches, ask your <strong className="text-foreground">Super Admin</strong> to upgrade the branch limit in the Admin Panel.
              </p>
            </div>

            <button
              onClick={() => setShowLimitModal(false)}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium touch-manipulation hover:bg-primary/90 transition-colors"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* ── Add/Edit Branch Form Modal ─────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">{form.id ? "Edit" : "New"} Branch</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              {[
                { l: "Name *", k: "name" }, { l: "Code", k: "code" }, { l: "Address", k: "address" },
                { l: "Phone", k: "phone" }, { l: "Email", k: "email" }, { l: "GST Number", k: "gst_number" },
              ].map(({ l, k }) => (
                <div key={k}>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{l}</label>
                  <input
                    type="text"
                    value={form[k] || ""}
                    onChange={e => setForm({ ...form, [k]: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                <Save className="h-4 w-4" />{saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
