import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Settings as SettingsIcon, Save, User, Building2, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { user, profile, signOut, refreshProfile, tenantId } = useAuth();
  const [tenant, setTenant] = useState<any>(null);
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tenantId) {
      supabase.from("tenants").select("*").eq("id", tenantId).single().then(({ data }) => setTenant(data));
    }
  }, [tenantId]);

  useEffect(() => {
    setFullName(profile?.full_name || "");
    setPhone(profile?.phone || "");
  }, [profile]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("user_id", user.id);
    if (error) toast.error(error.message);
    else { toast.success("Profile updated"); await refreshProfile(); }
    setSaving(false);
  };

  return (
    <div className="h-screen overflow-y-auto scrollbar-thin">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2 ml-10 md:ml-0"><SettingsIcon className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Settings</h1>
      </header>
      <div className="p-4 sm:p-6 space-y-6 max-w-2xl">
        <div className="glass-card rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Profile</h3>
          <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label><input type="email" value={user?.email || ""} disabled className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground" /></div>
          <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Full Name</label><input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
          <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Phone</label><input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
          <button onClick={saveProfile} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"><Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}</button>
        </div>

        {tenant && (
          <div className="glass-card rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Business</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Name</p><p className="font-medium text-foreground">{tenant.name}</p></div>
              <div><p className="text-xs text-muted-foreground">Industry</p><p className="font-medium text-foreground capitalize">{tenant.industry}</p></div>
              <div><p className="text-xs text-muted-foreground">Plan</p><p className="font-medium text-foreground capitalize">{tenant.subscription}</p></div>
              <div><p className="text-xs text-muted-foreground">GST</p><p className="font-medium text-foreground">{tenant.gst_number || "—"}</p></div>
            </div>
          </div>
        )}

        <button onClick={signOut} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20"><LogOut className="h-4 w-4" /> Sign Out</button>
      </div>
    </div>
  );
}
