import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Shield, Building2, Pause, Play, Trash2, Users, Search, CreditCard, Settings, Save,
  Eye, AlertTriangle, Activity, UserPlus, BarChart3, Globe, Lock
} from "lucide-react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = ["hsl(187 72% 50%)", "hsl(37 95% 55%)", "hsl(152 60% 45%)", "hsl(0 72% 55%)", "hsl(270 60% 55%)"];

interface Tenant {
  id: string; name: string; industry: string; subscription: string;
  is_active: boolean; owner_id: string | null; created_at: string;
  max_users: number; max_branches: number; max_sessions: number; max_devices: number; max_items: number;
  email: string | null; phone: string | null; gst_number: string | null; address: string | null;
}

export default function SuperAdmin() {
  const { hasRole } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [masterAdminEmail, setMasterAdminEmail] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<"businesses" | "analytics" | "sessions" | "settings">("businesses");
  const [confirmAction, setConfirmAction] = useState<{ type: string; tenantId: string; tenantName: string } | null>(null);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [viewTenant, setViewTenant] = useState<Tenant | null>(null);

  const isSuperAdmin = hasRole("super_admin");

  const fetchData = async () => {
    setLoading(true);
    const [{ data: t }, { data: p }, { data: s }, { data: sess }, { data: settings }] = await Promise.all([
      supabase.from("tenants").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name, tenant_id, is_active, phone"),
      supabase.from("sales").select("tenant_id, grand_total, created_at").limit(1000),
      supabase.from("active_sessions").select("*").order("last_active_at", { ascending: false }),
      supabase.from("system_settings").select("*").eq("key", "master_admin_email").single()
    ]);
    setTenants((t as Tenant[]) || []);
    setProfiles(p || []);
    setSales(s || []);
    setSessions(sess || []);
    if (settings) setMasterAdminEmail(settings.value);
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

  // Monthly growth data
  const monthlyGrowth = useMemo(() => {
    const map: Record<string, number> = {};
    tenants.forEach(t => {
      const month = new Date(t.created_at).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      map[month] = (map[month] || 0) + 1;
    });
    return Object.entries(map).slice(-6).map(([month, count]) => ({ month, count }));
  }, [tenants]);

  const toggleTenant = async (tenantId: string, activate: boolean) => {
    const { error } = await supabase.from("tenants").update({ is_active: activate }).eq("id", tenantId);
    if (error) { toast.error(error.message); return; }
    if (!activate) {
      await supabase.from("profiles").update({ is_active: false }).eq("tenant_id", tenantId);
      await supabase.from("active_sessions").delete().eq("tenant_id", tenantId);
      toast.success("Business paused. All users deactivated & sessions cleared.");
    } else {
      await supabase.from("profiles").update({ is_active: true }).eq("tenant_id", tenantId);
      toast.success("Business activated.");
    }
    setConfirmAction(null); fetchData();
  };

  const deleteTenant = async (tenantId: string) => {
    if (confirmAction?.type === "delete" && deleteConfirmText !== "delete permanantly") {
      toast.error('Please type "delete permanantly" to confirm.');
      return;
    }
    try {
      const tenantProfiles = profiles.filter(p => p.tenant_id === tenantId);
      const userIds = tenantProfiles.map(p => p.user_id);
      for (const table of ["payments", "expenses", "audit_logs", "active_sessions", "devices", "payment_methods", "items", "categories", "gst_rates", "branches"]) {
        await supabase.from(table as any).delete().eq("tenant_id", tenantId);
      }
      for (const uid of userIds) {
        await supabase.from("user_roles").delete().eq("user_id", uid);
        await supabase.from("user_page_access").delete().eq("user_id", uid);
        await supabase.from("profiles").update({ tenant_id: null, branch_id: null }).eq("user_id", uid);
      }
      await supabase.from("tenants").delete().eq("id", tenantId);
      toast.success("Business deleted permanently");
      setConfirmAction(null); 
      setDeleteConfirmText("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
  };

  const saveMasterAdminEmail = async () => {
    if (!masterAdminEmail) return;
    setSavingSettings(true);
    const { error } = await supabase.from("system_settings").upsert({ key: "master_admin_email", value: masterAdminEmail }, { onConflict: "key" });
    if (error) toast.error(error.message);
    else toast.success("Master admin email updated");
    setSavingSettings(false);
  };

  const saveSettings = async () => {
    if (!editingTenant) return;
    setSavingSettings(true);
    const { error } = await supabase.from("tenants").update({
      max_sessions: editingTenant.max_sessions,
      max_users: editingTenant.max_users,
      max_branches: editingTenant.max_branches,
      max_devices: editingTenant.max_devices,
      max_items: editingTenant.max_items,
      subscription: editingTenant.subscription as any,
    }).eq("id", editingTenant.id);
    if (error) toast.error(error.message);
    else { toast.success("Settings saved"); setEditingTenant(null); fetchData(); }
    setSavingSettings(false);
  };

  const terminateSession = async (sessionId: string) => {
    await supabase.from("active_sessions").delete().eq("id", sessionId);
    toast.success("Session terminated");
    fetchData();
  };

  const filtered = tenants.filter(t => {
    const q = searchQuery.toLowerCase();
    return !q || t.name.toLowerCase().includes(q) || t.industry.includes(q) || t.email?.toLowerCase().includes(q) || t.subscription.includes(q);
  });

  if (!isSuperAdmin) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-destructive/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground">Super Admin privileges required.</p>
          <div className="mt-4 glass-card rounded-xl p-4 max-w-sm mx-auto">
            <p className="text-xs text-muted-foreground">To become a Super Admin, an existing Super Admin must assign the <code className="text-primary">super_admin</code> role to your account via the Supabase dashboard → <code className="text-primary">user_roles</code> table.</p>
          </div>
        </div>
      </div>
    );
  }

  const tooltipStyle = { backgroundColor: 'hsl(222 44% 10%)', border: '1px solid hsl(215 25% 18%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' };

  const TABS = [
    { key: "businesses", label: "Businesses", icon: "🏢" },
    { key: "analytics", label: "Analytics", icon: "📊" },
    { key: "sessions", label: "Sessions", icon: "🔗" },
    { key: "settings", label: "Settings", icon: "⚙️" },
  ] as const;

  return (
    <div className="h-screen flex flex-col overflow-hidden pb-20 md:pb-0">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="ml-10 md:ml-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Super Admin
            </h1>
            <p className="text-sm text-muted-foreground">{tenants.length} businesses • {profiles.length} users • ₹{totalRevenue.toLocaleString()} revenue</p>
          </div>
        </div>
        <div className="flex gap-1.5 mt-3 overflow-x-auto scrollbar-thin">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all touch-manipulation ${tab === t.key ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"}`}>
              {t.icon} {t.label}
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

          {/* Sessions Tab */}
          {tab === "sessions" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Active Sessions</p><p className="text-2xl font-bold text-foreground mt-1">{sessions.length}</p></div>
                <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Online Now</p><p className="text-2xl font-bold text-success mt-1">{sessions.filter(s => new Date(s.last_active_at) > new Date(Date.now() - 5 * 60000)).length}</p></div>
                <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Unique Tenants</p><p className="text-2xl font-bold text-primary mt-1">{new Set(sessions.map(s => s.tenant_id)).size}</p></div>
              </div>
              <div className="space-y-2">
                {sessions.map(s => {
                  const tenant = tenants.find(t => t.id === s.tenant_id);
                  const profile = profiles.find(p => p.user_id === s.user_id);
                  const isOnline = new Date(s.last_active_at) > new Date(Date.now() - 5 * 60000);
                  return (
                    <div key={s.id} className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                          <span className="text-sm font-medium text-foreground">{profile?.full_name || "Unknown"}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${isOnline ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{isOnline ? "Online" : "Idle"}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{tenant?.name || "—"} • {s.device_name} • {new Date(s.last_active_at).toLocaleString()}</p>
                      </div>
                      <button onClick={() => terminateSession(s.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 touch-manipulation shrink-0">
                        Terminate
                      </button>
                    </div>
                  );
                })}
                {sessions.length === 0 && <p className="text-center text-muted-foreground py-12">No active sessions</p>}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {tab === "settings" && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="glass-card rounded-xl p-5 mb-4">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-3"><Shield className="h-5 w-5 text-primary" /> Master Super Admin</h2>
                <p className="text-xs text-muted-foreground mb-3">This email automatically receives super_admin status upon signup. Secondary admins can still be managed in Supabase table editor.</p>
                <div className="flex gap-2">
                  <input type="email" value={masterAdminEmail} onChange={e => setMasterAdminEmail(e.target.value)} placeholder="admin@domain.com" className="flex-1 px-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  <button onClick={saveMasterAdminEmail} disabled={savingSettings} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 touch-manipulation flex items-center gap-2">
                    <Save className="h-4 w-4" /> Save
                  </button>
                </div>
              </div>
              
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Settings className="h-5 w-5 text-primary" /> Tenant Limits & Plans</h2>
              <div className="space-y-3">
                {tenants.map(t => {
                  const isEditing = editingTenant?.id === t.id;
                  const current = isEditing ? editingTenant : t;
                  return (
                    <div key={t.id} className="glass-card rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">{t.name}</h3>
                          <p className="text-xs text-muted-foreground capitalize">{t.industry} • {t.subscription}</p>
                        </div>
                        {isEditing && (
                          <button onClick={saveSettings} disabled={savingSettings} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
                            <Save className="h-3 w-3" /> {savingSettings ? "..." : "Save"}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                          { label: "Sessions", key: "max_sessions" as const },
                          { label: "Users", key: "max_users" as const },
                          { label: "Branches", key: "max_branches" as const },
                          { label: "Devices", key: "max_devices" as const },
                          { label: "Items", key: "max_items" as const },
                        ].map(({ label, key }) => (
                          <div key={key} className="flex flex-col gap-1">
                            <label className="text-[10px] text-muted-foreground">{label}</label>
                            <input type="number" min={1} value={(current as any)[key]}
                              onChange={e => setEditingTenant({ ...(isEditing ? editingTenant : t), [key]: parseInt(e.target.value) || 1 } as Tenant)}
                              onFocus={() => { if (!isEditing) setEditingTenant(t); }}
                              className="px-2 py-1.5 rounded bg-muted border border-border text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary/50" />
                          </div>
                        ))}
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-muted-foreground">Plan</label>
                          <select value={current.subscription}
                            onChange={e => setEditingTenant({ ...(isEditing ? editingTenant : t), subscription: e.target.value } as Tenant)}
                            onFocus={() => { if (!isEditing) setEditingTenant(t); }}
                            className="px-2 py-1.5 rounded bg-muted border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                            {["free", "starter", "business", "enterprise"].map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {tab === "analytics" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Businesses</p><p className="text-2xl font-bold text-foreground mt-1">{tenants.length}</p></div>
                <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Active</p><p className="text-2xl font-bold text-success mt-1">{tenants.filter(t => t.is_active).length}</p></div>
                <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Users</p><p className="text-2xl font-bold text-foreground mt-1">{profiles.length}</p></div>
                <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Revenue</p><p className="text-2xl font-bold text-primary mt-1">₹{totalRevenue.toLocaleString()}</p></div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="glass-card rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">By Industry</h3>
                  {industryBreakdown.length > 0 && (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart><Pie data={industryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, value }) => `${name} (${value})`}>
                        {industryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie><Tooltip contentStyle={tooltipStyle} /></PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="glass-card rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">By Plan</h3>
                  {planBreakdown.length > 0 && (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart><Pie data={planBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, value }) => `${name} (${value})`}>
                        {planBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie><Tooltip contentStyle={tooltipStyle} /></PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="glass-card rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Growth</h3>
                  {monthlyGrowth.length > 0 && (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={monthlyGrowth}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 18%)" />
                        <XAxis dataKey="month" tick={{ fill: 'hsl(210 40% 60%)', fontSize: 10 }} />
                        <YAxis tick={{ fill: 'hsl(210 40% 60%)', fontSize: 10 }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="count" fill="hsl(152 60% 45%)" radius={[4, 4, 0, 0]} name="New Businesses" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Revenue by Business</h3>
                <div className="space-y-2">
                  {[...tenants].sort((a, b) => (tenantRevenue[b.id] || 0) - (tenantRevenue[a.id] || 0)).slice(0, 10).map(t => (
                    <div key={t.id} className="flex items-center justify-between py-2 border-b border-border/30">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${t.is_active ? "bg-success" : "bg-destructive"}`} />
                        <span className="text-sm text-foreground">{t.name}</span>
                        <span className="text-xs text-muted-foreground capitalize">{t.industry}</span>
                      </div>
                      <span className="text-sm font-semibold text-primary">₹{(tenantRevenue[t.id] || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Businesses Tab */}
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
                      <div className="flex items-center gap-1.5 text-muted-foreground"><Activity className="h-3 w-3" /> {sessions.filter(s => s.tenant_id === t.id).length} sess</div>
                      <div className="flex items-center gap-1.5 text-muted-foreground"><CreditCard className="h-3 w-3" /> ₹{(tenantRevenue[t.id] || 0).toLocaleString()}</div>
                    </div>
                    {t.email && <p className="text-[10px] text-muted-foreground truncate mb-1">{t.email}</p>}
                    <p className="text-[10px] text-muted-foreground mb-3">Created {new Date(t.created_at).toLocaleDateString()}</p>
                    <div className="flex gap-2">
                      <button onClick={() => setViewTenant(t)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 touch-manipulation">
                        <Eye className="h-3 w-3" /> View
                      </button>
                      <button onClick={() => setConfirmAction({ type: t.is_active ? "pause" : "activate", tenantId: t.id, tenantName: t.name })}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all touch-manipulation ${t.is_active ? "bg-accent/10 text-accent hover:bg-accent/20" : "bg-success/10 text-success hover:bg-success/20"}`}>
                        {t.is_active ? <><Pause className="h-3 w-3" /> Pause</> : <><Play className="h-3 w-3" /> Activate</>}
                      </button>
                      <button onClick={() => setConfirmAction({ type: "delete", tenantId: t.id, tenantName: t.name })}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 touch-manipulation">
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

      {/* View Tenant Detail */}
      {viewTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setViewTenant(null)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto scrollbar-thin animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">{viewTenant.name}</h3>
              <button onClick={() => setViewTenant(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Industry</p><p className="font-medium text-foreground capitalize">{viewTenant.industry}</p></div>
              <div><p className="text-xs text-muted-foreground">Plan</p><p className="font-medium text-foreground capitalize">{viewTenant.subscription}</p></div>
              <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium text-foreground">{viewTenant.email || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium text-foreground">{viewTenant.phone || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">GST</p><p className="font-medium text-foreground">{viewTenant.gst_number || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p><p className={`font-medium ${viewTenant.is_active ? "text-success" : "text-destructive"}`}>{viewTenant.is_active ? "Active" : "Paused"}</p></div>
              <div className="col-span-2"><p className="text-xs text-muted-foreground">Address</p><p className="font-medium text-foreground">{viewTenant.address || "—"}</p></div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              <div className="glass-card rounded-lg p-3 text-center"><p className="text-lg font-bold text-foreground">{getTenantUserCount(viewTenant.id)}</p><p className="text-[10px] text-muted-foreground">Users</p></div>
              <div className="glass-card rounded-lg p-3 text-center"><p className="text-lg font-bold text-foreground">{viewTenant.max_sessions}</p><p className="text-[10px] text-muted-foreground">Sessions</p></div>
              <div className="glass-card rounded-lg p-3 text-center"><p className="text-lg font-bold text-foreground">{viewTenant.max_branches}</p><p className="text-[10px] text-muted-foreground">Branches</p></div>
              <div className="glass-card rounded-lg p-3 text-center"><p className="text-lg font-bold text-primary">₹{(tenantRevenue[viewTenant.id] || 0).toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Revenue</p></div>
            </div>
            <h4 className="text-sm font-semibold text-foreground mt-4 mb-2">Team Members</h4>
            <div className="space-y-1">
              {profiles.filter(p => p.tenant_id === viewTenant.id).map(p => (
                <div key={p.user_id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/20">
                  <span className="text-sm text-foreground">{p.full_name || "Unnamed"}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.is_active ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{p.is_active ? "Active" : "Inactive"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => { setConfirmAction(null); setDeleteConfirmText(""); }}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()}>
            <AlertTriangle className={`h-10 w-10 mx-auto mb-3 ${confirmAction.type === "delete" ? "text-destructive" : "text-accent"}`} />
            <h3 className="text-lg font-bold text-foreground text-center mb-1">
              {confirmAction.type === "delete" ? "Delete" : confirmAction.type === "pause" ? "Pause" : "Activate"} Business?
            </h3>
            <p className="text-sm text-muted-foreground text-center mb-4">{confirmAction.tenantName}</p>
            {confirmAction.type === "delete" && (
              <div className="mb-4 text-center">
                <p className="text-xs text-destructive mb-2">This will permanently delete all data including users, items, sales, and configurations.</p>
                <p className="text-xs text-muted-foreground mb-1">Type <strong>delete permanantly</strong> to confirm:</p>
                <input 
                  type="text" 
                  value={deleteConfirmText} 
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="delete permanantly"
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-center text-foreground focus:outline-none focus:ring-1 focus:ring-destructive/50" 
                />
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setConfirmAction(null); setDeleteConfirmText(""); }} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium touch-manipulation">Cancel</button>
              <button 
                onClick={() => confirmAction.type === "delete" ? deleteTenant(confirmAction.tenantId) : toggleTenant(confirmAction.tenantId, confirmAction.type === "activate")}
                disabled={confirmAction.type === "delete" && deleteConfirmText !== "delete permanantly"}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium touch-manipulation disabled:opacity-50 ${confirmAction.type === "delete" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
                {confirmAction.type === "delete" ? "Delete Forever" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
