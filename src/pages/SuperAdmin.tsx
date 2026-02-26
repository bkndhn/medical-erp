import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Building2, Pause, Play, Trash2, Users, Search, AlertTriangle, CreditCard, Settings, Save } from "lucide-react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["hsl(187 72% 50%)", "hsl(37 95% 55%)", "hsl(152 60% 45%)", "hsl(0 72% 55%)", "hsl(270 60% 55%)"];

interface Tenant {
  id: string; name: string; industry: string; subscription: string;
  is_active: boolean; owner_id: string | null; created_at: string;
  max_users: number; max_branches: number; max_sessions: number; email: string | null; phone: string | null;
}

export default function SuperAdmin() {
  const { hasRole } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<"businesses" | "analytics" | "settings">("businesses");
  const [confirmAction, setConfirmAction] = useState<{ type: string; tenantId: string; tenantName: string } | null>(null);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const isSuperAdmin = hasRole("super_admin");

  const fetchData = async () => {
    setLoading(true);
    const [{ data: t }, { data: p }, { data: s }] = await Promise.all([
      supabase.from("tenants").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name, tenant_id, is_active, phone"),
      supabase.from("sales").select("tenant_id, grand_total, created_at").limit(1000),
    ]);
    setTenants((t as Tenant[]) || []);
    setProfiles(p || []);
    setSales(s || []);
    setLoading(false);
  };

  useEffect(() => { if (isSuperAdmin) fetchData(); }, [isSuperAdmin]);

  const getTenantUserCount = (tenantId: string) => profiles.filter(p => p.tenant_id === tenantId).length;

  const tenantRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    sales.forEach(s => { map[s.tenant_id] = (map[s.tenant_id] || 0) + Number(s.grand_total); });
    return map;
  }, [sales]);

  const industryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    tenants.forEach(t => { map[t.industry] = (map[t.industry] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [tenants]);

  const planBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    tenants.forEach(t => { map[t.subscription] = (map[t.subscription] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [tenants]);

  const totalRevenue = sales.reduce((s, x) => s + Number(x.grand_total), 0);

  const toggleTenant = async (tenantId: string, activate: boolean) => {
    const { error } = await supabase.from("tenants").update({ is_active: activate }).eq("id", tenantId);
    if (error) { toast.error(error.message); return; }
    if (!activate) {
      await supabase.from("profiles").update({ is_active: false }).eq("tenant_id", tenantId);
      toast.success("Business paused. All users deactivated.");
    } else {
      await supabase.from("profiles").update({ is_active: true }).eq("tenant_id", tenantId);
      toast.success("Business activated.");
    }
    setConfirmAction(null); fetchData();
  };

  const deleteTenant = async (tenantId: string) => {
    try {
      const tenantProfiles = profiles.filter(p => p.tenant_id === tenantId);
      const userIds = tenantProfiles.map(p => p.user_id);
      await supabase.from("payments").delete().eq("tenant_id", tenantId);
      await supabase.from("expenses").delete().eq("tenant_id", tenantId);
      await supabase.from("audit_logs").delete().eq("tenant_id", tenantId);
      await supabase.from("active_sessions").delete().eq("tenant_id", tenantId);
      await supabase.from("devices").delete().eq("tenant_id", tenantId);
      await supabase.from("items").delete().eq("tenant_id", tenantId);
      await supabase.from("categories").delete().eq("tenant_id", tenantId);
      await supabase.from("gst_rates").delete().eq("tenant_id", tenantId);
      await supabase.from("branches").delete().eq("tenant_id", tenantId);
      for (const uid of userIds) {
        await supabase.from("user_roles").delete().eq("user_id", uid);
        await supabase.from("user_page_access").delete().eq("user_id", uid);
        await supabase.from("profiles").update({ tenant_id: null, branch_id: null }).eq("user_id", uid);
      }
      await supabase.from("tenants").delete().eq("id", tenantId);
      toast.success("Business deleted permanently");
      setConfirmAction(null); fetchData();
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
  };

  const saveSessionLimit = async () => {
    if (!editingTenant) return;
    setSavingSettings(true);
    const { error } = await supabase.from("tenants").update({
      max_sessions: editingTenant.max_sessions,
      max_users: editingTenant.max_users,
      max_branches: editingTenant.max_branches,
    }).eq("id", editingTenant.id);
    if (error) toast.error(error.message);
    else { toast.success("Settings saved"); setEditingTenant(null); fetchData(); }
    setSavingSettings(false);
  };

  const filtered = tenants.filter(t => {
    const q = searchQuery.toLowerCase();
    return !q || t.name.toLowerCase().includes(q) || t.industry.includes(q) || t.email?.toLowerCase().includes(q);
  });

  if (!isSuperAdmin) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-destructive/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground">Super Admin privileges required.</p>
        </div>
      </div>
    );
  }

  const tooltipStyle = { backgroundColor: 'hsl(222 44% 10%)', border: '1px solid hsl(215 25% 18%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="ml-10 md:ml-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Super Admin
            </h1>
            <p className="text-sm text-muted-foreground">{tenants.length} businesses • {profiles.length} users • ₹{totalRevenue.toLocaleString()} revenue</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {(["businesses", "analytics", "settings"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all touch-manipulation ${tab === t ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"}`}>
              {t === "businesses" ? "🏢" : t === "analytics" ? "📊" : "⚙️"} {t}
            </button>
          ))}
        </div>
        {tab === "businesses" && (
          <div className="mt-3 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search businesses..." className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
        {loading ? <div className="text-center text-muted-foreground py-12">Loading...</div> : <>

          {tab === "settings" && (
            <div className="max-w-2xl mx-auto space-y-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Settings className="h-5 w-5 text-primary" /> Session & Limits per Business</h2>
              <p className="text-sm text-muted-foreground">Configure max concurrent logins, users, and branches for each tenant.</p>
              <div className="space-y-3">
                {tenants.map(t => (
                  <div key={t.id} className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">{t.name}</h3>
                      <p className="text-xs text-muted-foreground capitalize">{t.industry} • {t.subscription}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-muted-foreground">Sessions:</label>
                        <input type="number" min={1} max={100} value={editingTenant?.id === t.id ? editingTenant.max_sessions : t.max_sessions}
                          onChange={e => setEditingTenant({ ...(editingTenant?.id === t.id ? editingTenant : t), max_sessions: parseInt(e.target.value) || 1 })}
                          onFocus={() => { if (editingTenant?.id !== t.id) setEditingTenant(t); }}
                          className="w-14 px-2 py-1 rounded bg-muted border border-border text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary/50" />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-muted-foreground">Users:</label>
                        <input type="number" min={1} max={500} value={editingTenant?.id === t.id ? editingTenant.max_users : t.max_users}
                          onChange={e => setEditingTenant({ ...(editingTenant?.id === t.id ? editingTenant : t), max_users: parseInt(e.target.value) || 1 })}
                          onFocus={() => { if (editingTenant?.id !== t.id) setEditingTenant(t); }}
                          className="w-14 px-2 py-1 rounded bg-muted border border-border text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary/50" />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-muted-foreground">Branches:</label>
                        <input type="number" min={1} max={100} value={editingTenant?.id === t.id ? editingTenant.max_branches : t.max_branches}
                          onChange={e => setEditingTenant({ ...(editingTenant?.id === t.id ? editingTenant : t), max_branches: parseInt(e.target.value) || 1 })}
                          onFocus={() => { if (editingTenant?.id !== t.id) setEditingTenant(t); }}
                          className="w-14 px-2 py-1 rounded bg-muted border border-border text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary/50" />
                      </div>
                      {editingTenant?.id === t.id && (
                        <button onClick={saveSessionLimit} disabled={savingSettings} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
                          <Save className="h-3 w-3" /> {savingSettings ? "..." : "Save"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "analytics" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Businesses</p><p className="text-2xl font-bold text-foreground mt-1">{tenants.length}</p></div>
                <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Active</p><p className="text-2xl font-bold text-success mt-1">{tenants.filter(t => t.is_active).length}</p></div>
                <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Users</p><p className="text-2xl font-bold text-foreground mt-1">{profiles.length}</p></div>
                <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Total Revenue</p><p className="text-2xl font-bold text-primary mt-1">₹{totalRevenue.toLocaleString()}</p></div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">By Industry</h3>
                  {industryBreakdown.length > 0 && (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart><Pie data={industryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                        {industryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie><Tooltip contentStyle={tooltipStyle} /></PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="glass-card rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">By Plan</h3>
                  {planBreakdown.length > 0 && (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart><Pie data={planBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                        {planBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie><Tooltip contentStyle={tooltipStyle} /></PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Revenue by Business</h3>
                <div className="space-y-2">
                  {tenants.sort((a, b) => (tenantRevenue[b.id] || 0) - (tenantRevenue[a.id] || 0)).slice(0, 15).map(t => (
                    <div key={t.id} className="flex items-center justify-between py-2 border-b border-border/30">
                      <div><span className="text-sm text-foreground">{t.name}</span><span className="text-xs text-muted-foreground ml-2 capitalize">{t.industry}</span></div>
                      <span className="text-sm font-semibold text-primary">₹{(tenantRevenue[t.id] || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "businesses" && (
            filtered.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No businesses found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(t => (
                  <div key={t.id} className={`glass-card rounded-xl p-5 transition-all ${!t.is_active ? "opacity-60 border-destructive/30" : ""}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-foreground truncate">{t.name}</h3>
                        <p className="text-xs text-muted-foreground capitalize">{t.industry} • {t.subscription}</p>
                      </div>
                      <span className={`shrink-0 ml-2 px-2 py-0.5 rounded text-[10px] font-medium ${t.is_active ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                        {t.is_active ? "Active" : "Paused"}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground"><Users className="h-3 w-3" /> {getTenantUserCount(t.id)}/{t.max_users}</div>
                      <div className="flex items-center gap-1.5 text-muted-foreground" title="Max sessions"><Settings className="h-3 w-3" /> {t.max_sessions} sess</div>
                      <div className="flex items-center gap-1.5 text-muted-foreground"><CreditCard className="h-3 w-3" /> ₹{(tenantRevenue[t.id] || 0).toLocaleString()}</div>
                      {t.email && <div className="col-span-3 text-muted-foreground truncate">{t.email}</div>}
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-3">Created {new Date(t.created_at).toLocaleDateString()}</p>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmAction({ type: t.is_active ? "pause" : "activate", tenantId: t.id, tenantName: t.name })}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all touch-manipulation ${t.is_active ? "bg-accent/10 text-accent hover:bg-accent/20" : "bg-success/10 text-success hover:bg-success/20"}`}>
                        {t.is_active ? <><Pause className="h-3 w-3" /> Pause</> : <><Play className="h-3 w-3" /> Activate</>}
                      </button>
                      <button onClick={() => setConfirmAction({ type: "delete", tenantId: t.id, tenantName: t.name })}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all touch-manipulation">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </>}
      </div>

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setConfirmAction(null)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2.5 rounded-lg ${confirmAction.type === "delete" ? "bg-destructive/10" : "bg-accent/10"}`}>
                <AlertTriangle className={`h-5 w-5 ${confirmAction.type === "delete" ? "text-destructive" : "text-accent"}`} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground capitalize">{confirmAction.type} Business</h3>
                <p className="text-xs text-muted-foreground">{confirmAction.tenantName}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {confirmAction.type === "delete" ? "Permanently delete this business and all data. Cannot be undone." :
               confirmAction.type === "pause" ? "Pause business and force logout all users." :
               "Reactivate business and allow users to log in."}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium touch-manipulation">Cancel</button>
              <button onClick={() => {
                if (confirmAction.type === "delete") deleteTenant(confirmAction.tenantId);
                else toggleTenant(confirmAction.tenantId, confirmAction.type === "activate");
              }} className={`flex-1 py-2.5 rounded-lg text-sm font-medium touch-manipulation ${confirmAction.type === "delete" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
