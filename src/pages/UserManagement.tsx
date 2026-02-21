import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Users, Plus, Shield, Edit2, Trash2, X, Save, UserPlus } from "lucide-react";
import { toast } from "sonner";

const ROLES = ["admin", "manager", "cashier", "staff"] as const;

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-primary/10 text-primary",
  admin: "bg-accent/10 text-accent",
  manager: "bg-success/10 text-success",
  cashier: "bg-secondary text-secondary-foreground",
  staff: "bg-muted text-muted-foreground",
};

const PAGE_PERMISSIONS: Record<string, string[]> = {
  admin: ["dashboard", "pos", "inventory", "purchases", "customers", "suppliers", "accounting", "reports", "invoices", "branches", "devices", "payments", "whatsapp", "settings", "users"],
  manager: ["dashboard", "pos", "inventory", "purchases", "customers", "suppliers", "accounting", "reports", "invoices", "payments"],
  cashier: ["dashboard", "pos", "customers", "invoices"],
  staff: ["dashboard", "inventory"],
};

export default function UserManagement() {
  const { tenantId, hasRole, user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [inviteForm, setInviteForm] = useState({ email: "", password: "", fullName: "", role: "cashier" as string, branchId: "" });
  const [saving, setSaving] = useState(false);

  const isAdmin = hasRole("admin") || hasRole("super_admin");

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: profiles }, { data: userRoles }, { data: br }] = await Promise.all([
      supabase.from("profiles").select("*").eq("tenant_id", tenantId),
      supabase.from("user_roles").select("*"),
      supabase.from("branches").select("id, name").eq("tenant_id", tenantId),
    ]);

    const usersWithRoles = (profiles || []).map(p => ({
      ...p,
      roles: (userRoles || []).filter(r => r.user_id === p.user_id).map(r => r.role),
    }));

    setUsers(usersWithRoles);
    setRoles(userRoles || []);
    setBranches(br || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [tenantId]);

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.password || !tenantId) return;
    setSaving(true);
    try {
      // Create user via Supabase auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: inviteForm.email,
        password: inviteForm.password,
        options: { data: { full_name: inviteForm.fullName } },
      });
      if (authErr) throw authErr;
      if (!authData.user) throw new Error("User creation failed");

      // Wait a moment for the trigger to create the profile
      await new Promise(r => setTimeout(r, 1000));

      // Update profile with tenant and branch
      await supabase.from("profiles").update({
        tenant_id: tenantId,
        branch_id: inviteForm.branchId || null,
        full_name: inviteForm.fullName,
      }).eq("user_id", authData.user.id);

      // Assign role
      await supabase.from("user_roles").insert({
        user_id: authData.user.id,
        role: inviteForm.role as any,
      });

      toast.success(`User ${inviteForm.fullName} added as ${inviteForm.role}`);
      setShowInvite(false);
      setInviteForm({ email: "", password: "", fullName: "", role: "cashier", branchId: "" });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to add user");
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async (userId: string, newRole: string) => {
    try {
      // Delete existing roles for user
      await supabase.from("user_roles").delete().eq("user_id", userId);
      // Insert new role
      await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
      toast.success("Role updated");
      setEditUser(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleActive = async (userId: string, isActive: boolean) => {
    await supabase.from("profiles").update({ is_active: !isActive }).eq("user_id", userId);
    toast.success(isActive ? "User deactivated" : "User activated");
    fetchData();
  };

  const removeUser = async (userId: string) => {
    if (!confirm("Remove this user from your business?")) return;
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("profiles").update({ tenant_id: null, branch_id: null }).eq("user_id", userId);
    toast.success("User removed");
    fetchData();
  };

  if (!isAdmin) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-destructive/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground">Only admins can manage users.</p>
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
              <Users className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Team Management
            </h1>
            <p className="text-sm text-muted-foreground">{users.length} members</p>
          </div>
          <button onClick={() => setShowInvite(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 touch-manipulation">
            <UserPlus className="h-4 w-4" /> Add Member
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading team...</div>
        ) : (
          <>
            {/* Role permissions reference */}
            <div className="glass-card rounded-xl p-4 mb-6">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Page Access by Role</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {Object.entries(PAGE_PERMISSIONS).map(([role, pages]) => (
                  <div key={role} className="p-3 rounded-lg bg-muted/30">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase mb-2 ${ROLE_COLORS[role]}`}>{role}</span>
                    <div className="flex flex-wrap gap-1">
                      {pages.map(p => (
                        <span key={p} className="px-1.5 py-0.5 rounded text-[9px] bg-muted text-muted-foreground capitalize">{p}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Users list */}
            <div className="space-y-3">
              {users.map(u => (
                <div key={u.user_id} className={`glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-all ${!u.is_active ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                      {(u.full_name || "U")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{u.full_name || "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground">{u.phone || "No phone"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {u.roles.map((r: string) => (
                      <span key={r} className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${ROLE_COLORS[r] || ROLE_COLORS.staff}`}>{r}</span>
                    ))}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${u.is_active ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {u.user_id !== user?.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEditUser(u)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground touch-manipulation">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => toggleActive(u.user_id, u.is_active)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground touch-manipulation">
                        {u.is_active ? <Shield className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5 text-success" />}
                      </button>
                      <button onClick={() => removeUser(u.user_id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive touch-manipulation">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add Member Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setShowInvite(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">Add Team Member</h3>
              <button onClick={() => setShowInvite(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Full Name</label>
                <input type="text" value={inviteForm.fullName} onChange={e => setInviteForm({ ...inviteForm, fullName: e.target.value })} placeholder="John Doe" className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
                <input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="user@business.com" className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Password</label>
                <input type="password" value={inviteForm.password} onChange={e => setInviteForm({ ...inviteForm, password: e.target.value })} placeholder="Min 6 characters" minLength={6} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(r => (
                    <button key={r} onClick={() => setInviteForm({ ...inviteForm, role: r })} className={`py-2 rounded-lg text-xs font-medium capitalize transition-all touch-manipulation ${inviteForm.role === r ? "bg-primary/15 text-primary border border-primary/40" : "bg-muted text-muted-foreground border border-transparent"}`}>{r}</button>
                  ))}
                </div>
              </div>
              {branches.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Branch</label>
                  <select value={inviteForm.branchId} onChange={e => setInviteForm({ ...inviteForm, branchId: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="">All Branches</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowInvite(false)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium touch-manipulation">Cancel</button>
              <button onClick={handleInvite} disabled={saving || !inviteForm.email || !inviteForm.password} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 touch-manipulation">
                <Save className="h-4 w-4" /> {saving ? "Adding..." : "Add User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setEditUser(null)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground mb-1">Change Role</h3>
            <p className="text-sm text-muted-foreground mb-4">{editUser.full_name}</p>
            <div className="space-y-2">
              {ROLES.map(r => (
                <button key={r} onClick={() => updateRole(editUser.user_id, r)} className={`w-full py-3 rounded-lg text-sm font-medium capitalize transition-all touch-manipulation ${editUser.roles.includes(r) ? "bg-primary/15 text-primary border border-primary/40" : "bg-muted text-muted-foreground border border-transparent hover:border-primary/20"}`}>{r}</button>
              ))}
            </div>
            <button onClick={() => setEditUser(null)} className="w-full mt-3 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium touch-manipulation">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
