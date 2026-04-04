import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Users, Plus, Search, Edit2, Trash2, X, Save, Eye, ShoppingCart, FileText, BookOpen, ArrowUpCircle, ArrowDownCircle, Download } from "lucide-react";
import { toast } from "sonner";
import DateFilterExport, { exportToExcel, exportToPDF } from "@/components/DateFilterExport";

interface Customer {
  id: string; name: string; phone: string | null; email: string | null;
  address: string | null; gst_number: string | null; credit_limit: number; outstanding: number;
  created_at: string;
}

interface LedgerEntry {
  id: string; type: string; amount: number; balance_after: number;
  description: string | null; reference_type: string | null; created_at: string;
}

export default function Customers() {
  const { tenantId } = useAuth();
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Partial<Customer> | null>(null);
  const [saving, setSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [customerSales, setCustomerSales] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  // Ledger
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entryForm, setEntryForm] = useState({ type: "credit", amount: 0, description: "" });

  const fetch_ = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase.from("customers").select("*").eq("tenant_id", tenantId).order("name");
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, [tenantId]);

  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    if (q && !i.name.toLowerCase().includes(q) && !i.phone?.includes(q) && !i.email?.toLowerCase().includes(q)) return false;
    if (dateFrom && new Date(i.created_at) < dateFrom) return false;
    if (dateTo && new Date(i.created_at) > dateTo) return false;
    return true;
  });

  const handleSave = async () => {
    if (!editItem?.name || !tenantId) return;
    setSaving(true);
    try {
      if (editItem.id) {
        const { error } = await supabase.from("customers").update({ name: editItem.name, phone: editItem.phone, email: editItem.email, address: editItem.address, gst_number: editItem.gst_number, credit_limit: editItem.credit_limit || 0 }).eq("id", editItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert({ ...editItem, tenant_id: tenantId } as any);
        if (error) throw error;
      }
      toast.success(editItem.id ? "Customer updated" : "Customer added");
      setShowForm(false); setEditItem(null); fetch_();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this customer?")) return;
    await supabase.from("customers").delete().eq("id", id);
    toast.success("Deleted"); fetch_();
  };

  const viewHistory = async (customer: Customer) => {
    setViewCustomer(customer);
    setLoadingHistory(true);
    const { data } = await supabase.from("sales").select("*").eq("tenant_id", tenantId!).eq("customer_id", customer.id).order("created_at", { ascending: false }).limit(50);
    setCustomerSales((data as any) || []);
    setLoadingHistory(false);
  };

  // Ledger functions
  const openLedger = async (customer: Customer) => {
    setLedgerCustomer(customer);
    setLoadingLedger(true);
    const { data } = await supabase.from("customer_ledger").select("*").eq("customer_id", customer.id).order("created_at", { ascending: false }).limit(200);
    setLedgerEntries((data as any) || []);
    setLoadingLedger(false);
  };

  const addLedgerEntry = async () => {
    if (!ledgerCustomer || !tenantId || entryForm.amount <= 0) return;
    setSaving(true);
    try {
      const currentOutstanding = Number(ledgerCustomer.outstanding) || 0;
      const newBalance = entryForm.type === "debit"
        ? currentOutstanding + entryForm.amount
        : currentOutstanding - entryForm.amount;

      await supabase.from("customer_ledger").insert({
        tenant_id: tenantId, customer_id: ledgerCustomer.id,
        type: entryForm.type, amount: entryForm.amount,
        balance_after: newBalance, description: entryForm.description || null,
        reference_type: "adjustment",
      } as any);

      await supabase.from("customers").update({ outstanding: newBalance } as any).eq("id", ledgerCustomer.id);

      toast.success(`${entryForm.type === "credit" ? "Payment received" : "Amount added"}`);
      setShowAddEntry(false);
      setEntryForm({ type: "credit", amount: 0, description: "" });
      setLedgerCustomer({ ...ledgerCustomer, outstanding: newBalance });
      openLedger({ ...ledgerCustomer, outstanding: newBalance });
      fetch_();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const exportLedgerStatement = () => {
    if (!ledgerCustomer || ledgerEntries.length === 0) return;
    exportToPDF(
      `Statement - ${ledgerCustomer.name}`,
      ["Date", "Type", "Amount", "Balance", "Description"],
      ledgerEntries.map(e => [
        new Date(e.created_at).toLocaleDateString(),
        e.type.toUpperCase(),
        `₹${Number(e.amount).toFixed(2)}`,
        `₹${Number(e.balance_after).toFixed(2)}`,
        e.description || "—",
      ])
    );
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden pb-20 md:pb-0">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="ml-10 md:ml-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2"><Users className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Customers</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} customers</p>
          </div>
          <button onClick={() => { setEditItem({ name: "", phone: "", email: "", address: "", gst_number: "", credit_limit: 0, outstanding: 0 }); setShowForm(true); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 touch-manipulation">
            <Plus className="h-4 w-4" /> Add Customer
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..." className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <DateFilterExport
            defaultPreset="today"
            onFilter={(from, to) => { setDateFrom(from); setDateTo(to); }}
            onExportExcel={() => exportToExcel(filtered.map(c => ({ Name: c.name, Phone: c.phone || "", Email: c.email || "", GST: c.gst_number || "", CreditLimit: Number(c.credit_limit).toFixed(2), Outstanding: Number(c.outstanding).toFixed(2) })), "customers")}
            onExportPDF={() => exportToPDF("Customers", ["Name", "Phone", "Email", "Credit Limit", "Outstanding"], filtered.map(c => [c.name, c.phone || "—", c.email || "—", `₹${Number(c.credit_limit).toFixed(0)}`, `₹${Number(c.outstanding).toFixed(0)}`]))}
          />
        </div>
      </header>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
        {loading ? <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div> :
        filtered.length === 0 ? <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><Users className="h-12 w-12 mb-3 opacity-30" /><p>No customers found</p></div> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border">
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Name</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Phone</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Email</th>
          <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Outstanding</th>
          <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Actions</th>
        </tr></thead><tbody>
          {filtered.map(c => (
            <tr key={c.id} className="border-b border-border/30 hover:bg-muted/20">
              <td className="py-3 px-3 font-medium text-foreground">{c.name}</td>
              <td className="py-3 px-3 text-muted-foreground">{c.phone || "—"}</td>
              <td className="py-3 px-3 text-muted-foreground hidden sm:table-cell">{c.email || "—"}</td>
              <td className="py-3 px-3 text-right"><span className={Number(c.outstanding) > 0 ? "text-accent font-semibold" : "text-muted-foreground"}>₹{Number(c.outstanding).toFixed(0)}</span></td>
              <td className="py-3 px-3 text-right"><div className="flex items-center justify-end gap-1">
                <button onClick={() => openLedger(c)} className="p-1.5 rounded hover:bg-accent/10 text-muted-foreground hover:text-accent" title="Ledger"><BookOpen className="h-3.5 w-3.5" /></button>
                <button onClick={() => viewHistory(c)} className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary" title="Purchase history"><Eye className="h-3.5 w-3.5" /></button>
                <button onClick={() => { setEditItem(c); setShowForm(true); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="h-3.5 w-3.5" /></button>
                <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div></td>
            </tr>
          ))}
        </tbody></table></div>}
      </div>

      {/* Customer Form */}
      {showForm && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-foreground">{editItem.id ? "Edit" : "New"} Customer</h3><button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button></div>
            <div className="space-y-3">
              {[{l:"Name *",k:"name"},{l:"Phone",k:"phone"},{l:"Email",k:"email"},{l:"Address",k:"address"},{l:"GST Number",k:"gst_number"},{l:"Credit Limit",k:"credit_limit",t:"number"}].map(({l,k,t})=>(
                <div key={k}><label className="text-xs font-medium text-muted-foreground mb-1 block">{l}</label><input type={t||"text"} value={(editItem as any)[k]??""} onChange={e=>setEditItem({...editItem,[k]:t==="number"?parseFloat(e.target.value)||0:e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium">Cancel</button>
              <button onClick={handleSave} disabled={saving||!editItem.name} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"><Save className="h-4 w-4" />{saving?"Saving...":"Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Purchase History */}
      {viewCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setViewCustomer(null)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg mx-4 animate-fade-in max-h-[85vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">{viewCustomer.name}</h3>
                <p className="text-xs text-muted-foreground">{viewCustomer.phone || "No phone"} • {viewCustomer.email || "No email"}</p>
              </div>
              <button onClick={() => setViewCustomer(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="glass-card rounded-lg p-3"><p className="text-[10px] text-muted-foreground uppercase">Credit Limit</p><p className="text-lg font-bold text-foreground">₹{Number(viewCustomer.credit_limit).toLocaleString()}</p></div>
              <div className="glass-card rounded-lg p-3"><p className="text-[10px] text-muted-foreground uppercase">Outstanding</p><p className={`text-lg font-bold ${Number(viewCustomer.outstanding) > 0 ? "text-accent" : "text-success"}`}>₹{Number(viewCustomer.outstanding).toLocaleString()}</p></div>
            </div>
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" /> Purchase History</h4>
            {loadingHistory ? <div className="text-center text-muted-foreground py-8">Loading...</div> :
            customerSales.length === 0 ? <p className="text-center text-muted-foreground py-8">No purchases yet</p> :
            <div className="space-y-2">
              {customerSales.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div>
                    <p className="text-sm font-medium text-foreground font-mono">{s.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()} • {s.payment_mode.toUpperCase()}</p>
                  </div>
                  <span className="text-sm font-bold text-primary">₹{Number(s.grand_total).toFixed(0)}</span>
                </div>
              ))}
            </div>}
          </div>
        </div>
      )}

      {/* Customer Ledger */}
      {ledgerCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setLedgerCustomer(null)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-2xl mx-4 animate-fade-in max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /> Ledger</h3>
                <p className="text-sm text-muted-foreground">{ledgerCustomer.name} • {ledgerCustomer.phone || ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={exportLedgerStatement} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground border border-border" title="Print statement">
                  <Download className="h-3 w-3" /> Statement
                </button>
                <button onClick={() => setLedgerCustomer(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="glass-card rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Credit Limit</p>
                <p className="text-lg font-bold text-foreground">₹{Number(ledgerCustomer.credit_limit).toLocaleString()}</p>
              </div>
              <div className="glass-card rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Outstanding</p>
                <p className={`text-lg font-bold ${Number(ledgerCustomer.outstanding) > 0 ? "text-accent" : "text-success"}`}>₹{Number(ledgerCustomer.outstanding).toLocaleString()}</p>
              </div>
              <div className="glass-card rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Available</p>
                <p className="text-lg font-bold text-success">₹{Math.max(0, Number(ledgerCustomer.credit_limit) - Number(ledgerCustomer.outstanding)).toLocaleString()}</p>
              </div>
            </div>

            {/* Add Entry */}
            <div className="flex gap-2 mb-4">
              <button onClick={() => { setShowAddEntry(true); setEntryForm({ type: "credit", amount: 0, description: "Payment received" }); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-success/10 text-success hover:bg-success/20 border border-success/20">
                <ArrowDownCircle className="h-3.5 w-3.5" /> Receive Payment
              </button>
              <button onClick={() => { setShowAddEntry(true); setEntryForm({ type: "debit", amount: 0, description: "Credit sale" }); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20">
                <ArrowUpCircle className="h-3.5 w-3.5" /> Add Debit
              </button>
            </div>

            {/* Add Entry Form */}
            {showAddEntry && (
              <div className="glass-card rounded-xl p-4 mb-4 border border-primary/20">
                <h4 className="text-sm font-semibold text-foreground mb-3">{entryForm.type === "credit" ? "Receive Payment" : "Add Debit"}</h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Amount *</label>
                    <input type="number" value={entryForm.amount || ""} onChange={e => setEntryForm({ ...entryForm, amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="0.00" autoFocus />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                    <input type="text" value={entryForm.description} onChange={e => setEntryForm({ ...entryForm, description: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddEntry(false)} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-xs">Cancel</button>
                  <button onClick={addLedgerEntry} disabled={saving || entryForm.amount <= 0} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">{saving ? "Saving..." : "Save Entry"}</button>
                </div>
              </div>
            )}

            {/* Ledger Table */}
            {loadingLedger ? <div className="text-center text-muted-foreground py-8">Loading...</div> :
            ledgerEntries.length === 0 ? <p className="text-center text-muted-foreground py-8">No ledger entries yet</p> :
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground">Date</th>
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground">Description</th>
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground">Type</th>
                  <th className="text-right py-2 px-2 text-xs text-muted-foreground">Amount</th>
                  <th className="text-right py-2 px-2 text-xs text-muted-foreground">Balance</th>
                </tr></thead>
                <tbody>
                  {ledgerEntries.map(e => (
                    <tr key={e.id} className="border-b border-border/30">
                      <td className="py-2 px-2 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</td>
                      <td className="py-2 px-2 text-xs text-foreground">{e.description || "—"}</td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${e.type === "credit" ? "bg-success/10 text-success" : "bg-accent/10 text-accent"}`}>
                          {e.type === "credit" ? "CR" : "DR"}
                        </span>
                      </td>
                      <td className={`py-2 px-2 text-right text-xs font-semibold ${e.type === "credit" ? "text-success" : "text-accent"}`}>
                        {e.type === "credit" ? "−" : "+"}₹{Number(e.amount).toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-right text-xs font-mono text-foreground">₹{Number(e.balance_after).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
          </div>
        </div>
      )}
    </div>
  );
}
