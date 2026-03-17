import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Settings as SettingsIcon, Save, User, Building2, LogOut, CreditCard, Plus, Edit2, Trash2, X, Sun, Moon, Palette, Printer, Bluetooth, Usb, Monitor } from "lucide-react";
import { toast } from "sonner";
import { getPrinterConfig, savePrinterConfig, connectUSBPrinter, connectBluetoothPrinter, isUSBConnected, isBTConnected, type PrinterConfig } from "@/lib/printService";

interface PaymentMethod {
  id: string; name: string; code: string; icon: string; is_active: boolean; sort_order: number;
}

const DEFAULT_METHODS = [
  { name: "Cash", code: "cash", icon: "💵" },
  { name: "UPI", code: "upi", icon: "📱" },
  { name: "Card", code: "card", icon: "💳" },
  { name: "Credit", code: "credit", icon: "📋" },
];

export default function Settings() {
  const { user, profile, signOut, refreshProfile, tenantId } = useAuth();
  const [tenant, setTenant] = useState<any>(null);
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"profile" | "payments" | "appearance" | "printer">("profile");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [showPmForm, setShowPmForm] = useState(false);
  const [pmForm, setPmForm] = useState<Partial<PaymentMethod>>({ name: "", code: "", icon: "💳", is_active: true, sort_order: 0 });
  const [pmSaving, setPmSaving] = useState(false);
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(getPrinterConfig());

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("app-theme") as "dark" | "light") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("app-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (tenantId) {
      supabase.from("tenants").select("*").eq("id", tenantId).single().then(({ data }) => setTenant(data));
      fetchPaymentMethods();
    }
  }, [tenantId]);

  useEffect(() => { setFullName(profile?.full_name || ""); setPhone(profile?.phone || ""); }, [profile]);

  const fetchPaymentMethods = async () => {
    if (!tenantId) return;
    const { data } = await supabase.from("payment_methods").select("*").eq("tenant_id", tenantId).order("sort_order");
    if (data && data.length > 0) { setPaymentMethods(data as any); } else {
      const inserts = DEFAULT_METHODS.map((m, i) => ({ ...m, tenant_id: tenantId, sort_order: i, is_active: true }));
      await supabase.from("payment_methods").insert(inserts as any);
      const { data: d2 } = await supabase.from("payment_methods").select("*").eq("tenant_id", tenantId).order("sort_order");
      setPaymentMethods((d2 as any) || []);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("user_id", user.id);
    if (error) toast.error(error.message);
    else { toast.success("Profile updated"); await refreshProfile(); }
    setSaving(false);
  };

  const savePm = async () => {
    if (!pmForm.name || !pmForm.code || !tenantId) return;
    setPmSaving(true);
    try {
      if (pmForm.id) {
        const { error } = await supabase.from("payment_methods").update({
          name: pmForm.name, code: pmForm.code, icon: pmForm.icon || "💳",
          is_active: pmForm.is_active ?? true, sort_order: pmForm.sort_order ?? 0,
        }).eq("id", pmForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payment_methods").insert({
          name: pmForm.name, code: pmForm.code, icon: pmForm.icon || "💳",
          is_active: pmForm.is_active ?? true, sort_order: pmForm.sort_order ?? 0, tenant_id: tenantId,
        } as any);
        if (error) throw error;
      }
      toast.success(pmForm.id ? "Updated" : "Added");
      setShowPmForm(false); setPmForm({ name: "", code: "", icon: "💳", is_active: true, sort_order: 0 }); fetchPaymentMethods();
    } catch (err: any) { toast.error(err.message); }
    setPmSaving(false);
  };

  const deletePm = async (id: string) => { if (!confirm("Delete?")) return; await supabase.from("payment_methods").delete().eq("id", id); toast.success("Deleted"); fetchPaymentMethods(); };
  const togglePm = async (pm: PaymentMethod) => { await supabase.from("payment_methods").update({ is_active: !pm.is_active }).eq("id", pm.id); fetchPaymentMethods(); };

  const updatePrinterConfig = (updates: Partial<PrinterConfig>) => {
    const newConfig = { ...printerConfig, ...updates };
    setPrinterConfig(newConfig);
    savePrinterConfig(newConfig);
    toast.success("Printer settings saved");
  };

  const handleConnectUSB = async () => {
    const ok = await connectUSBPrinter();
    if (ok) toast.success("USB printer connected!");
    else toast.error("Failed to connect USB printer");
  };

  const handleConnectBT = async () => {
    const ok = await connectBluetoothPrinter();
    if (ok) toast.success("Bluetooth printer connected!");
    else toast.error("Failed to connect Bluetooth printer");
  };

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "payments" as const, label: "Payments", icon: CreditCard },
    { id: "printer" as const, label: "Printer", icon: Printer },
    { id: "appearance" as const, label: "Theme", icon: Palette },
  ];

  return (
    <div className="h-screen overflow-y-auto scrollbar-thin pb-20 md:pb-0">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2 ml-10 md:ml-0">
          <SettingsIcon className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Settings
        </h1>
        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-thin">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all touch-manipulation ${tab === t.id ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"}`}>
              <t.icon className="h-3 w-3" /> {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="p-4 sm:p-6 space-y-6 max-w-2xl">
        {tab === "profile" && (
          <>
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
          </>
        )}

        {tab === "payments" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Payment Methods</h3>
                <p className="text-xs text-muted-foreground mt-1">These appear in POS billing.</p>
              </div>
              <button onClick={() => { setPmForm({ name: "", code: "", icon: "💳", is_active: true, sort_order: paymentMethods.length }); setShowPmForm(true); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 touch-manipulation">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {paymentMethods.map(pm => (
                <div key={pm.id} className={`glass-card rounded-xl p-4 flex items-center gap-3 transition-opacity ${!pm.is_active ? "opacity-50" : ""}`}>
                  <span className="text-2xl">{pm.icon}</span>
                  <div className="flex-1 min-w-0"><h4 className="text-sm font-semibold text-foreground">{pm.name}</h4><p className="text-xs text-muted-foreground font-mono">{pm.code}</p></div>
                  <button onClick={() => togglePm(pm)} className={`px-2 py-1 rounded text-[10px] font-medium ${pm.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{pm.is_active ? "Active" : "Off"}</button>
                  <button onClick={() => { setPmForm(pm); setShowPmForm(true); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Edit2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deletePm(pm.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "printer" && (
          <div className="space-y-4">
            <div className="glass-card rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Printer className="h-4 w-4 text-primary" /> Print Settings</h3>

              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-foreground">Enable Printing</p><p className="text-xs text-muted-foreground">Turn on/off bill printing</p></div>
                <button onClick={() => updatePrinterConfig({ enabled: !printerConfig.enabled })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${printerConfig.enabled ? "bg-success/10 text-success border border-success/30" : "bg-muted text-muted-foreground border border-border"}`}>
                  {printerConfig.enabled ? "Enabled" : "Disabled"}
                </button>
              </div>

              {/* Printer Type */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Connection Type</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { type: "browser" as const, icon: Monitor, label: "Browser", desc: "Standard print dialog" },
                    { type: "usb" as const, icon: Usb, label: "USB", desc: "Direct USB printer" },
                    { type: "bluetooth" as const, icon: Bluetooth, label: "Bluetooth", desc: "Wireless BT printer" },
                  ]).map(({ type, icon: Icon, label, desc }) => (
                    <button key={type} onClick={() => updatePrinterConfig({ type })}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all touch-manipulation ${printerConfig.type === type ? "border-primary bg-primary/5" : "border-border bg-muted/30"}`}>
                      <Icon className={`h-6 w-6 ${printerConfig.type === type ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="text-center">
                        <p className="text-xs font-semibold text-foreground">{label}</p>
                        <p className="text-[10px] text-muted-foreground">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Connect buttons */}
              {printerConfig.type === "usb" && (
                <button onClick={handleConnectUSB} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                  {isUSBConnected() ? "✅ USB Connected — Reconnect" : "🔌 Connect USB Printer"}
                </button>
              )}
              {printerConfig.type === "bluetooth" && (
                <button onClick={handleConnectBT} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                  {isBTConnected() ? "✅ BT Connected — Reconnect" : "📡 Connect Bluetooth Printer"}
                </button>
              )}

              {/* Paper Width */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Paper Width</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["58mm", "80mm"] as const).map(w => (
                    <button key={w} onClick={() => updatePrinterConfig({ paperWidth: w })}
                      className={`py-3 rounded-lg text-sm font-medium transition-all touch-manipulation ${printerConfig.paperWidth === w ? "bg-primary/15 text-primary border border-primary/40" : "bg-muted text-muted-foreground border border-transparent"}`}>
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto print */}
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-foreground">Auto Print on Complete</p><p className="text-xs text-muted-foreground">Print receipt automatically after completing sale</p></div>
                <button onClick={() => updatePrinterConfig({ autoPrint: !printerConfig.autoPrint })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${printerConfig.autoPrint ? "bg-success/10 text-success border border-success/30" : "bg-muted text-muted-foreground border border-border"}`}>
                  {printerConfig.autoPrint ? "On" : "Off"}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "appearance" && (
          <div className="space-y-4">
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4"><Palette className="h-4 w-4 text-primary" /> Theme</h3>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setTheme("dark")} className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all touch-manipulation ${theme === "dark" ? "border-primary bg-primary/5" : "border-border bg-muted/30"}`}>
                  <Moon className={`h-6 w-6 ${theme === "dark" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-left"><p className="text-sm font-semibold text-foreground">Dark</p><p className="text-[10px] text-muted-foreground">Easy on the eyes</p></div>
                </button>
                <button onClick={() => setTheme("light")} className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all touch-manipulation ${theme === "light" ? "border-primary bg-primary/5" : "border-border bg-muted/30"}`}>
                  <Sun className={`h-6 w-6 ${theme === "light" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-left"><p className="text-sm font-semibold text-foreground">Light</p><p className="text-[10px] text-muted-foreground">Bright look</p></div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment method form modal */}
      {showPmForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowPmForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">{pmForm.id ? "Edit" : "Add"} Payment Method</h3>
              <button onClick={() => setShowPmForm(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
                <input type="text" value={pmForm.name || ""} onChange={e => setPmForm({ ...pmForm, name: e.target.value })} placeholder="e.g., Cash" className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Code *</label>
                <input type="text" value={pmForm.code || ""} onChange={e => setPmForm({ ...pmForm, code: e.target.value.toLowerCase() })} placeholder="cash" className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Icon</label>
                <input type="text" value={pmForm.icon || ""} onChange={e => setPmForm({ ...pmForm, icon: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Sort Order</label>
                <input type="number" value={pmForm.sort_order ?? 0} onChange={e => setPmForm({ ...pmForm, sort_order: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowPmForm(false)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium">Cancel</button>
              <button onClick={savePm} disabled={pmSaving || !pmForm.name || !pmForm.code}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
                <Save className="h-4 w-4" /> {pmSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
