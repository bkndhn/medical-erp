import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Users, Shield, Edit2, Trash2, X, Save, UserPlus, ToggleLeft, ToggleRight, Eye, EyeOff, Clock, Plus } from "lucide-react";
import { toast } from "sonner";

const ROLES = ["admin", "manager", "cashier", "staff"] as const;

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-primary/10 text-primary",
  admin: "bg-accent/10 text-accent",
  manager: "bg-success/10 text-success",
  cashier: "bg-secondary text-secondary-foreground",
  staff: "bg-muted text-muted-foreground",
};

const ALL_PAGES = ["dashboard", "pos", "inventory", "shortages", "purchases", "customers", "suppliers", "accounting", "reports", "invoices", "transfers", "returns", "branches", "devices", "payments", "whatsapp", "settings", "users"];

const DEFAULT_PAGE_PERMISSIONS: Record<string, string[]> = {
  admin: ALL_PAGES,
  manager: ["dashboard", "pos", "inventory", "shortages", "purchases", "customers", "suppliers", "accounting", "reports", "invoices", "transfers", "returns", "payments"],
  cashier: ["dashboard", "pos", "shortages", "customers", "invoices"],
  staff: ["dashboard", "inventory", "shortages"],
};

export default function UserManagement() {
  const { tenantId, hasRole, user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [pageAccessMap, setPageAccessMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [editAccess, setEditAccess] = useState<any>(null);
  const [inviteForm, setInviteForm] = useState({ email: "", password: "", fullName: "", role: "cashier" as string, branchId: "" });
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isAdmin = hasRole("admin") || hasRole("super_admin");

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: profiles }, { data: userRoles }, { data: br }, { data: pageAccess }] = await Promise.all([
      supabase.from("profiles").select("*").eq("tenant_id", tenantId),
      supabase.from("user_roles").select("*"),
      supabase.from("branches").select("id, name").eq("tenant_id", tenantId),
      supabase.from("user_page_access").select("*").eq("tenant_id", tenantId),
    ]);

    const usersWithRoles = (profiles || []).map(p => ({
      ...p,
      roles: (userRoles || []).filter(r => r.user_id === p.user_id).map(r => r.role),
    }));

    const accessMap: Record<string, string[]> = {};
    (pageAccess || []).forEach((pa: any) => { accessMap[pa.user_id] = pa.pages || []; });

    setUsers(usersWithRoles);
    setRoles(userRoles || []);
    setBranches(br || []);
    setPageAccessMap(accessMap);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [tenantId]);

  const getUserPages = (u: any): string[] => {
    if (pageAccessMap[u.user_id]?.length > 0) return pageAccessMap[u.user_id];
    const primaryRole = u.roles[0] || "staff";
    return DEFAULT_PAGE_PERMISSIONS[primaryRole] || DEFAULT_PAGE_PERMISSIONS.staff;
  };

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.password || !inviteForm.fullName || !tenantId) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (inviteForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    try {
      const { data: funcData, error: funcErr } = await supabase.functions.invoke('create-user', {
        body: {
          email: inviteForm.email,
          password: inviteForm.password,
          fullName: inviteForm.fullName,
          tenantId: tenantId,
          role: inviteForm.role,
          branchId: inviteForm.branchId || null,
        }
      });

      if (funcErr) throw funcErr;
      if (funcData?.error) throw new Error(funcData.error);

      toast.success(`✅ ${inviteForm.fullName} added as ${inviteForm.role}. They can log in now.`);
      setShowInvite(false);
      setInviteForm({ email: "", password: "", fullName: "", role: "cashier", branchId: "" });
      // Small delay to let DB writes propagate before re-fetch
      setTimeout(() => fetchData(), 600);
    } catch (err: any) {
      toast.error(err.message || "Failed to add user");
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async (userId: string, newRole: string) => {
    try {
      await supabase.from("user_roles").delete().eq("user_id", userId);
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
    await supabase.from("user_page_access").delete().eq("user_id", userId);
    await supabase.from("profiles").update({ tenant_id: null, branch_id: null }).eq("user_id", userId);
    toast.success("User removed");
    fetchData();
  };

  const savePageAccess = async (userId: string, pages: string[]) => {
    try {
      const existing = pageAccessMap[userId];
      if (existing !== undefined) {
        await supabase.from("user_page_access").update({ pages }).eq("user_id", userId).eq("tenant_id", tenantId!);
      } else {
        await supabase.from("user_page_access").insert({ user_id: userId, tenant_id: tenantId!, pages } as any);
      }
      toast.success("Page access updated");
      setEditAccess(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const togglePage = (page: string) => {
    if (!editAccess) return;
    const current: string[] = editAccess.pages || [];
    const updated = current.includes(page) ? current.filter(p => p !== page) : [...current, page];
    setEditAccess({ ...editAccess, pages: updated });
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
          <div className="ml-10 md:ml-0">
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
          <div className="space-y-3">
            {users.map(u => (
              <div key={u.user_id} className={`glass-card rounded-xl p-4 transition-all ${!u.is_active ? "opacity-50" : ""}`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                      {(u.full_name || "U")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{u.full_name || "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground">{u.email || "No email"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {u.roles.map((r: string) => (
                      <span key={r} className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${ROLE_COLORS[r] || ROLE_COLORS.staff}`}>{r}</span>
                    ))}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${u.is_active ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                    {!u.last_sign_in_at && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                        <Clock className="h-3 w-3" /> Pending
                      </span>
                    )}
                  </div>

                  {u.user_id !== user?.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEditUser(u)} title="Change role" className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground touch-manipulation">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setEditAccess({ userId: u.user_id, name: u.full_name, pages: getUserPages(u) })} title="Page access" className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary touch-manipulation">
                        <ToggleRight className="h-3.5 w-3.5" />
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

                <div className="flex flex-wrap gap-1 mt-2 pl-13">
                  {getUserPages(u).map(p => (
                    <span key={p} className="px-1.5 py-0.5 rounded text-[9px] bg-muted text-muted-foreground capitalize">{p}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={inviteForm.password}
                    onChange={e => setInviteForm({ ...inviteForm, password: e.target.value })}
                    placeholder="Min 6 characters"
                    minLength={6}
                    className="w-full px-3 py-2 pr-10 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground touch-manipulation"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
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

      {editAccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setEditAccess(null)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md animate-fade-in max-h-[80vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground mb-1">Page Access</h3>
            <p className="text-sm text-muted-foreground mb-4">{editAccess.name}</p>

            <div className="flex gap-2 mb-4">
              <button onClick={() => setEditAccess({ ...editAccess, pages: [...ALL_PAGES] })} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 touch-manipulation">Select All</button>
              <button onClick={() => setEditAccess({ ...editAccess, pages: [] })} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 touch-manipulation">Clear All</button>
            </div>

            <div className="space-y-1">
              {ALL_PAGES.map(page => {
                const active = editAccess.pages.includes(page);
                return (
                  <button key={page} onClick={() => togglePage(page)} className={`w-full flex items-center justify-between py-3 px-3 rounded-lg text-sm transition-all touch-manipulation ${active ? "bg-primary/10 text-primary" : "bg-muted/30 text-muted-foreground"}`}>
                    <span className="capitalize font-medium">{page}</span>
                    {active ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5" />}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setEditAccess(null)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium touch-manipulation">Cancel</button>
              <button onClick={() => savePageAccess(editAccess.userId, editAccess.pages)} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium touch-manipulation">Save Access</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
