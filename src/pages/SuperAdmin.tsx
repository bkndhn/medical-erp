import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Building2, Pause, Play, Trash2, Users, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Tenant {
  id: string;
  name: string;
  industry: string;
  subscription: string;
  is_active: boolean;
  owner_id: string | null;
  created_at: string;
  max_users: number;
  max_branches: number;
  email: string | null;
  phone: string | null;
}

export default function SuperAdmin() {
  const { hasRole } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ type: string; tenantId: string; tenantName: string } | null>(null);

  const isSuperAdmin = hasRole("super_admin");

  const fetchData = async () => {
    setLoading(true);
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from("tenants").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name, tenant_id, is_active, phone"),
    ]);
    setTenants((t as Tenant[]) || []);
    setProfiles(p || []);
    setLoading(false);
  };

  useEffect(() => { if (isSuperAdmin) fetchData(); }, [isSuperAdmin]);

  const getTenantUserCount = (tenantId: string) => profiles.filter(p => p.tenant_id === tenantId).length;

  const toggleTenant = async (tenantId: string, activate: boolean) => {
    const { error } = await supabase.from("tenants").update({ is_active: activate }).eq("id", tenantId);
    if (error) { toast.error(error.message); return; }

    // Deactivate all users in that tenant when pausing
    if (!activate) {
      await supabase.from("profiles").update({ is_active: false }).eq("tenant_id", tenantId);
      toast.success("Business paused. All users have been deactivated and will be forced to log out.");
    } else {
      await supabase.from("profiles").update({ is_active: true }).eq("tenant_id", tenantId);
      toast.success("Business activated. Users can log in again.");
    }
    setConfirmAction(null);
    fetchData();
  };

  const deleteTenant = async (tenantId: string) => {
    // Delete in order: sale_items, sales, purchase_items, purchases, payments, expenses, items, categories, devices, branches, user_roles (for tenant users), profiles, audit_logs, then tenant
    try {
      const tenantProfiles = profiles.filter(p => p.tenant_id === tenantId);
      const userIds = tenantProfiles.map(p => p.user_id);
      
      // Delete dependent data
      await supabase.from("payments").delete().eq("tenant_id", tenantId);
      await supabase.from("expenses").delete().eq("tenant_id", tenantId);
      await supabase.from("audit_logs").delete().eq("tenant_id", tenantId);
      await supabase.from("devices").delete().eq("tenant_id", tenantId);
      await supabase.from("items").delete().eq("tenant_id", tenantId);
      await supabase.from("categories").delete().eq("tenant_id", tenantId);
      await supabase.from("gst_rates").delete().eq("tenant_id", tenantId);
      await supabase.from("branches").delete().eq("tenant_id", tenantId);
      
      // Remove roles and profiles for tenant users
      for (const uid of userIds) {
        await supabase.from("user_roles").delete().eq("user_id", uid);
        await supabase.from("profiles").update({ tenant_id: null, branch_id: null }).eq("user_id", uid);
      }
      
      await supabase.from("tenants").delete().eq("id", tenantId);
      toast.success("Business deleted permanently");
      setConfirmAction(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
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
          <p className="text-sm text-muted-foreground">You need Super Admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Super Admin
            </h1>
            <p className="text-sm text-muted-foreground">{tenants.length} businesses • {profiles.length} total users</p>
          </div>
        </div>
        <div className="mt-3 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search businesses..." className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading businesses...</div>
        ) : filtered.length === 0 ? (
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
                    <p className="text-xs text-muted-foreground capitalize">{t.industry} • {t.subscription} plan</p>
                  </div>
                  <span className={`shrink-0 ml-2 px-2 py-0.5 rounded text-[10px] font-medium ${t.is_active ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    {t.is_active ? "Active" : "Paused"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3 w-3" /> {getTenantUserCount(t.id)} / {t.max_users} users
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Building2 className="h-3 w-3" /> {t.max_branches} branches
                  </div>
                  {t.email && <div className="col-span-2 text-muted-foreground truncate">{t.email}</div>}
                </div>

                <p className="text-[10px] text-muted-foreground mb-3">Created {new Date(t.created_at).toLocaleDateString()}</p>

                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmAction({ type: t.is_active ? "pause" : "activate", tenantId: t.id, tenantName: t.name })}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all touch-manipulation ${
                      t.is_active ? "bg-accent/10 text-accent hover:bg-accent/20" : "bg-success/10 text-success hover:bg-success/20"
                    }`}
                  >
                    {t.is_active ? <><Pause className="h-3 w-3" /> Pause</> : <><Play className="h-3 w-3" /> Activate</>}
                  </button>
                  <button
                    onClick={() => setConfirmAction({ type: "delete", tenantId: t.id, tenantName: t.name })}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all touch-manipulation"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
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
              {confirmAction.type === "delete"
                ? "This will permanently delete the business and all its data. This action cannot be undone."
                : confirmAction.type === "pause"
                  ? "This will pause the business and force logout all its users immediately."
                  : "This will reactivate the business and allow users to log in again."
              }
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium touch-manipulation">Cancel</button>
              <button
                onClick={() => {
                  if (confirmAction.type === "delete") deleteTenant(confirmAction.tenantId);
                  else toggleTenant(confirmAction.tenantId, confirmAction.type === "activate");
                }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium touch-manipulation ${
                  confirmAction.type === "delete" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
                }`}
              >
                Confirm {confirmAction.type === "delete" ? "Delete" : confirmAction.type === "pause" ? "Pause" : "Activate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
