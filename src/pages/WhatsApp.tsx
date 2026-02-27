import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { MessageSquare, Send, FileText, Bell, Plus, X, Save, Edit2, Trash2, Clock, Users } from "lucide-react";
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
  const [tab, setTab] = useState<"templates" | "logs">("templates");

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

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="ml-10 md:ml-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="h-5 sm:h-6 w-5 sm:w-6 text-success" /> WhatsApp Integration
            </h1>
            <p className="text-sm text-muted-foreground">{templates.length} templates configured</p>
          </div>
          <button onClick={() => { setEditForm({ name: "", type: "custom", body: "" }); setShowForm(true); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-success text-success-foreground text-sm font-medium hover:bg-success/90 touch-manipulation">
            <Plus className="h-4 w-4" /> New Template
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          {(["templates", "logs"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all touch-manipulation ${tab === t ? "bg-success/15 text-success border border-success/30" : "bg-muted text-muted-foreground border border-transparent"}`}>
              {t === "templates" ? <FileText className="h-3 w-3 inline mr-1" /> : <Clock className="h-3 w-3 inline mr-1" />}{t}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
        {tab === "templates" && (
          <div className="space-y-6">
            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="glass-card rounded-xl p-4 text-center">
                <Send className="h-5 w-5 text-success mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">0</p>
                <p className="text-[10px] text-muted-foreground">Messages Sent</p>
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
                <p className="text-lg font-bold text-foreground">0</p>
                <p className="text-[10px] text-muted-foreground">Recipients</p>
              </div>
            </div>

            {/* API key notice */}
            <div className="glass-card rounded-xl p-4 border-l-4 border-accent/50">
              <p className="text-sm font-medium text-foreground mb-1">⚡ WhatsApp Business API Required</p>
              <p className="text-xs text-muted-foreground">To send messages, configure your WhatsApp Business API key in Settings. Templates below will be used when the API is connected.</p>
            </div>

            {/* Templates grid */}
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

        {tab === "logs" && (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Clock className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No messages sent yet</p>
            <p className="text-xs">Message logs will appear here once WhatsApp API is configured</p>
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
