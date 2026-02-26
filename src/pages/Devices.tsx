import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Monitor, Plus, Edit2, Trash2, X, Save, Users, Wifi, WifiOff, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function Devices() {
  const { tenantId } = useAuth();
  const [devices, setDevices] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ name: "", device_identifier: "", branch_id: "", status: "active" });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"devices" | "sessions">("devices");

  const fetch_ = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: d }, { data: b }, { data: sessions }, { data: profs }] = await Promise.all([
      supabase.from("devices").select("*").eq("tenant_id", tenantId).order("name"),
      supabase.from("branches").select("id, name").eq("tenant_id", tenantId),
      supabase.from("active_sessions").select("*").eq("tenant_id", tenantId).order("last_active_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name, phone").eq("tenant_id", tenantId),
    ]);
    setDevices((d as any) || []);
    setBranches((b as any) || []);
    setActiveSessions((sessions as any) || []);
    setProfiles((profs as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, [tenantId]);

  const getProfileName = (userId: string) => profiles.find(p => p.user_id === userId)?.full_name || "Unknown";

  const handleSave = async () => {
    if (!form.name || !tenantId) return;
    setSaving(true);
    try {
      if (form.id) {
        const { error } = await supabase.from("devices").update({ name: form.name, device_identifier: form.device_identifier, branch_id: form.branch_id || null, status: form.status }).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("devices").insert({ name: form.name, device_identifier: form.device_identifier, branch_id: form.branch_id || null, status: form.status, tenant_id: tenantId } as any);
        if (error) throw error;
      }
      toast.success(form.id ? "Device updated" : "Device added");
      setShowForm(false); setForm({ name: "", device_identifier: "", branch_id: "", status: "active" }); fetch_();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete?")) return;
    await supabase.from("devices").delete().eq("id", id);
    toast.success("Deleted"); fetch_();
  };

  const terminateSession = async (sessionId: string) => {
    await supabase.from("active_sessions").delete().eq("id", sessionId);
    toast.success("Session terminated");
    fetch_();
  };

  const isOnline = (lastActive: string) => {
    const diff = Date.now() - new Date(lastActive).getTime();
    return diff < 5 * 60 * 1000; // 5 minutes
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="ml-10 md:ml-0"><h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2"><Monitor className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Devices & Sessions</h1><p className="text-sm text-muted-foreground">{devices.length} devices • {activeSessions.length} active sessions</p></div>
          <button onClick={() => { setForm({ name: "", device_identifier: "", branch_id: "", status: "active" }); setShowForm(true); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 touch-manipulation"><Plus className="h-4 w-4" /> Add Device</button>
        </div>
        <div className="flex gap-2 mt-3">
          {(["devices", "sessions"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all touch-manipulation ${tab === t ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"}`}>
              {t === "devices" ? <Monitor className="h-3 w-3 inline mr-1" /> : <Users className="h-3 w-3 inline mr-1" />}{t === "devices" ? "Devices" : "Active Sessions"}
            </button>
          ))}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
        {loading ? <div className="text-center text-muted-foreground py-12">Loading...</div> : <>

          {tab === "sessions" && (
            <div>
              {activeSessions.length === 0 ? (
                <div className="text-center text-muted-foreground py-12"><Users className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No active sessions</p></div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeSessions.map(s => (
                    <div key={s.id} className="glass-card rounded-xl p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isOnline(s.last_active_at) ? "bg-success/10" : "bg-muted"}`}>
                            {isOnline(s.last_active_at) ? <Wifi className="h-5 w-5 text-success" /> : <WifiOff className="h-5 w-5 text-muted-foreground" />}
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">{getProfileName(s.user_id)}</h3>
                            <p className="text-xs text-muted-foreground">{s.device_name || "Unknown Device"}</p>
                          </div>
                        </div>
                        <button onClick={() => terminateSession(s.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Terminate session">
                          <LogOut className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className={`px-2 py-0.5 rounded font-medium ${isOnline(s.last_active_at) ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                          {isOnline(s.last_active_at) ? "Online" : "Idle"}
                        </span>
                        <span className="text-muted-foreground">Last: {new Date(s.last_active_at).toLocaleString()}</span>
                      </div>
                      {s.ip_address && <p className="text-[10px] text-muted-foreground mt-2 font-mono">IP: {s.ip_address}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "devices" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {devices.map(d => (
                <div key={d.id} className="glass-card rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10"><Monitor className="h-5 w-5 text-primary" /></div>
                      <div><h3 className="text-sm font-semibold text-foreground">{d.name}</h3>{d.device_identifier && <p className="text-xs text-muted-foreground font-mono">{d.device_identifier}</p>}</div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setForm(d); setShowForm(true); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${d.status === "active" ? "bg-success/10 text-success" : d.status === "blocked" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{d.status}</span>
                  {d.last_active_at && <p className="text-xs text-muted-foreground mt-2">Last active: {new Date(d.last_active_at).toLocaleString()}</p>}
                </div>
              ))}
            </div>
          )}
        </>}
      </div>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-foreground">{form.id ? "Edit" : "New"} Device</h3><button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label><input type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Identifier</label><input type="text" value={form.device_identifier||""} onChange={e=>setForm({...form,device_identifier:e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Branch</label>
                <select value={form.branch_id||""} onChange={e=>setForm({...form,branch_id:e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="">Unassigned</option>
                  {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="active">Active</option><option value="inactive">Inactive</option><option value="blocked">Blocked</option>
                </select>
              </div>
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
