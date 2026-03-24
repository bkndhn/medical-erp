import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Send, FileText, Bell, Plus, X, Save, Edit2, Trash2, Clock, Users, Search, Phone } from "lucide-react";
import { toast } from "sonner";

interface Template {
  id: string;
  name: string;
  type: "invoice" | "reminder" | "report" | "custom";
  body: string;
}

const DEFAULT_TEMPLATES: Template[] = [
  { id: "1", name: "Invoice Share", type: "invoice", body: "Hi {{customer_name}}, your invoice {{invoice_number}} for ₹{{amount}} has been generated. Thank you for your business!" },
  { id: "2", name: "Payment Reminder", type: "reminder", body: "Dear {{customer_name}}, this is a gentle reminder that your payment of ₹{{amount}} is due on {{due_date}}. Please settle at your earliest convenience." },
  { id: "3", name: "Daily Report", type: "report", body: "📊 Daily Summary\nDate: {{date}}\nTotal Sales: ₹{{total_sales}}\nTransactions: {{transaction_count}}\nTop Item: {{top_item}}" },
];

const TYPE_COLORS: Record<string, string> = {
  invoice: "bg-primary/10 text-primary",
  reminder: "bg-accent/10 text-accent",
  report: "bg-success/10 text-success",
  custom: "bg-muted text-muted-foreground",
};

export default function WhatsApp() {
  const { tenantId } = useAuth();
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [showForm, setShowForm] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Template>>({ name: "", type: "custom", body: "" });
  const [tab, setTab] = useState<"templates" | "quick_send" | "logs">("templates");
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [sendPhone, setSendPhone] = useState("");
  const [sendName, setSendName] = useState("");

  useEffect(() => {
    if (!tenantId) {
      setCustomers([]);
      return;
    }
    supabase.from("customers").select("id, name, phone").eq("tenant_id", tenantId).order("name")
      .then(({ data }) => setCustomers((data as any) || []));
  }, [tenantId]);

  const filteredCustomers = useMemo(() => {
    if (!search) return customers.slice(0, 20);
    const q = search.toLowerCase();
    return customers.filter(c => c.name?.toLowerCase().includes(q) || c.phone?.includes(q)).slice(0, 20);
  }, [customers, search]);

  const handleSave = () => {
    if (!editForm.name || !editForm.body) { toast.error("Fill all fields"); return; }
    if (editForm.id) {
      setTemplates(prev => prev.map(t => t.id === editForm.id ? { ...t, ...editForm } as Template : t));
      toast.success("Template updated");
    } else {
      setTemplates(prev => [...prev, { ...editForm, id: Date.now().toString() } as Template]);
      toast.success("Template created");
    }
    setShowForm(false);
    setEditForm({ name: "", type: "custom", body: "" });
  };

  const handleDelete = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success("Template deleted");
  };

  const sendQuickMessage = (phone: string, template: Template, name: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) { toast.error("No phone number"); return; }
    const msg = template.body.replace(/\{\{customer_name\}\}/g, name || "Customer");
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
    toast.success("WhatsApp opened");
  };

  const sendToCustomer = (customer: any) => {
    if (!selectedTemplate) { toast.error("Select a template first"); return; }
    sendQuickMessage(customer.phone, selectedTemplate, customer.name);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden pb-20 md:pb-0">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="ml-10 md:ml-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="h-5 sm:h-6 w-5 sm:w-6 text-success" /> WhatsApp Integration
            </h1>
            <p className="text-sm text-muted-foreground">{templates.length} templates • {customers.length} customers</p>
          </div>
          <button onClick={() => { setEditForm({ name: "", type: "custom", body: "" }); setShowForm(true); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-success text-success-foreground text-sm font-medium hover:bg-success/90 touch-manipulation">
            <Plus className="h-4 w-4" /> New Template
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          {(["templates", "quick_send", "logs"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all touch-manipulation ${tab === t ? "bg-success/15 text-success border border-success/30" : "bg-muted text-muted-foreground border border-transparent"}`}>
              {t === "templates" ? <FileText className="h-3 w-3 inline mr-1" /> : t === "quick_send" ? <Send className="h-3 w-3 inline mr-1" /> : <Clock className="h-3 w-3 inline mr-1" />}
              {t === "quick_send" ? "Quick Send" : t}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
        {tab === "templates" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="glass-card rounded-xl p-4 text-center">
                <Send className="h-5 w-5 text-success mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">Direct</p>
                <p className="text-[10px] text-muted-foreground">wa.me Link</p>
              </div>
              <div className="glass-card rounded-xl p-4 text-center">
                <FileText className="h-5 w-5 text-primary mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{templates.filter(t => t.type === "invoice").length}</p>
                <p className="text-[10px] text-muted-foreground">Invoice Templates</p>
              </div>
              <div className="glass-card rounded-xl p-4 text-center">
                <Bell className="h-5 w-5 text-accent mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{templates.filter(t => t.type === "reminder").length}</p>
                <p className="text-[10px] text-muted-foreground">Reminders</p>
              </div>
              <div className="glass-card rounded-xl p-4 text-center">
                <Users className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{customers.length}</p>
                <p className="text-[10px] text-muted-foreground">Customers</p>
              </div>
            </div>

            <div className="glass-card rounded-xl p-4 border-l-4 border-success/50">
              <p className="text-sm font-medium text-foreground mb-1">✅ Direct WhatsApp (wa.me) Integration Active</p>
              <p className="text-xs text-muted-foreground">Messages are sent via wa.me links which open WhatsApp directly. No API key needed. Works on all devices.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(t => (
                <div key={t.id} className="glass-card rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{t.name}</h3>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium uppercase ${TYPE_COLORS[t.type]}`}>{t.type}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditForm(t); setShowForm(true); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 font-mono bg-muted/30 rounded p-2">{t.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "quick_send" && (
          <div className="space-y-4 max-w-2xl">
            <div className="glass-card rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Quick Send Message</h3>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Select Template</label>
                <div className="grid grid-cols-2 gap-2">
                  {templates.map(t => (
                    <button key={t.id} onClick={() => setSelectedTemplate(t)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium text-left transition-all touch-manipulation ${selectedTemplate?.id === t.id ? "bg-success/15 text-success border border-success/30" : "bg-muted text-muted-foreground border border-transparent"}`}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Send to custom number</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={sendName} onChange={e => setSendName(e.target.value)} placeholder="Name" className="px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  <input type="tel" value={sendPhone} onChange={e => setSendPhone(e.target.value)} placeholder="+91 98765 43210" className="px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <button onClick={() => selectedTemplate && sendQuickMessage(sendPhone, selectedTemplate, sendName)} disabled={!selectedTemplate || !sendPhone}
                  className="mt-2 w-full py-2.5 rounded-lg bg-success text-success-foreground text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  <Send className="h-4 w-4" /> Send via WhatsApp
                </button>
              </div>
            </div>

            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Send to Customer</h3>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..." className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin">
                {filteredCustomers.map(c => (
                  <button key={c.id} onClick={() => sendToCustomer(c)} disabled={!selectedTemplate || !c.phone}
                    className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-all text-left touch-manipulation disabled:opacity-50">
                    <div>
                      <p className="text-sm text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.phone || "No phone"}</p>
                    </div>
                    {c.phone && <Phone className="h-4 w-4 text-success" />}
                  </button>
                ))}
                {filteredCustomers.length === 0 && <p className="text-muted-foreground text-center py-4 text-sm">No customers found</p>}
              </div>
            </div>
          </div>
        )}

        {tab === "logs" && (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Clock className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Message logs</p>
            <p className="text-xs">WhatsApp messages are sent via direct wa.me links. Logs are tracked in your WhatsApp app.</p>
          </div>
        )}
      </div>

      {/* Template form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg mx-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">{editForm.id ? "Edit" : "New"} Template</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
                <input type="text" value={editForm.name || ""} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
                <select value={editForm.type || "custom"} onChange={e => setEditForm({ ...editForm, type: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="invoice">Invoice</option>
                  <option value="reminder">Reminder</option>
                  <option value="report">Report</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Message Body *</label>
                <textarea value={editForm.body || ""} onChange={e => setEditForm({ ...editForm, body: e.target.value })} rows={5}
                  placeholder="Use {{variable_name}} for dynamic content"
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono" />
                <p className="text-[10px] text-muted-foreground mt-1">Variables: {"{{customer_name}}, {{invoice_number}}, {{amount}}, {{date}}, {{due_date}}"}</p>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium">Cancel</button>
              <button onClick={handleSave} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-success text-success-foreground text-sm font-medium">
                <Save className="h-4 w-4" /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
