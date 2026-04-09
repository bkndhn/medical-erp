import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Users, Plus, Search, Edit2, Trash2, X, Save, Eye, ShoppingCart, Printer, MessageSquare, RefreshCw, Phone } from "lucide-react";
import { toast } from "sonner";
import DateFilterExport, { exportToExcel, exportToPDF } from "@/components/DateFilterExport";
import { printReceipt, generateWhatsAppText } from "@/lib/printService";
import { getBusinessDetails } from "@/pages/Settings";

interface Customer {
  id: string; name: string; phone: string | null; email: string | null;
  address: string | null; created_at: string;
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
  // Bill view
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [billItems, setBillItems] = useState<any[]>([]);
  const [loadingBillItems, setLoadingBillItems] = useState(false);

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
        const { error } = await supabase.from("customers").update({ name: editItem.name, phone: editItem.phone, email: editItem.email, address: editItem.address }).eq("id", editItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert({ name: editItem.name, phone: editItem.phone, email: editItem.email, address: editItem.address, tenant_id: tenantId } as any);
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
    const { data } = await supabase.from("sales").select("*").eq("tenant_id", tenantId!).eq("customer_id", customer.id).order("created_at", { ascending: false });
    setCustomerSales((data as any) || []);
    setLoadingHistory(false);
  };

  const viewBillDetail = async (sale: any) => {
    setSelectedBill(sale);
    setLoadingBillItems(true);
    const { data } = await supabase.from("sale_items").select("*").eq("sale_id", sale.id);
    setBillItems((data as any) || []);
    setLoadingBillItems(false);
  };

  const printBill = () => {
    if (!selectedBill) return;
    const cust = viewCustomer ? { name: viewCustomer.name, phone: viewCustomer.phone } : undefined;
    printReceipt(selectedBill, billItems, undefined, cust);
  };

  const shareOnWhatsApp = () => {
    if (!selectedBill) return;
    const cust = viewCustomer ? { name: viewCustomer.name, phone: viewCustomer.phone } : undefined;
    const msg = generateWhatsAppText(selectedBill, billItems, cust);
    const phone = viewCustomer?.phone ? viewCustomer.phone.replace(/\D/g, "") : "";
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const repurchaseBill = () => {
    if (!selectedBill || billItems.length === 0) return;
    // Store items in sessionStorage for POS to pick up
    sessionStorage.setItem("pos_repurchase_items", JSON.stringify(billItems.map(si => ({
      item_id: si.item_id, item_name: si.item_name, quantity: si.quantity,
      unit_price: si.unit_price, sale_type: si.sale_type || "strip",
    }))));
    sessionStorage.setItem("pos_repurchase_customer", JSON.stringify({ name: viewCustomer?.name, phone: viewCustomer?.phone }));
    window.location.href = "/pos";
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden pb-20 md:pb-0">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="ml-10 md:ml-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2"><Users className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Customers</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} customers</p>
          </div>
          <button onClick={() => { setEditItem({ name: "", phone: "", email: "", address: "" }); setShowForm(true); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 touch-manipulation">
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
            onExportExcel={() => exportToExcel(filtered.map(c => ({ Name: c.name, Phone: c.phone || "", Email: c.email || "", Address: c.address || "" })), "customers")}
            onExportPDF={() => exportToPDF("Customers", ["Name", "Phone", "Email", "Address"], filtered.map(c => [c.name, c.phone || "—", c.email || "—", c.address || "—"]))}
          />
        </div>
      </header>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
        {loading ? <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div> :
        filtered.length === 0 ? <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><Users className="h-12 w-12 mb-3 opacity-30" /><p>No customers found</p></div> :
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border">
            <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Name</th>
            <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Phone</th>
            <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Email</th>
            <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Address</th>
            <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Actions</th>
          </tr></thead><tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b border-border/30 hover:bg-muted/20">
                <td className="py-3 px-3 font-medium text-foreground">{c.name}</td>
                <td className="py-3 px-3 text-muted-foreground">{c.phone || "—"}</td>
                <td className="py-3 px-3 text-muted-foreground">{c.email || "—"}</td>
                <td className="py-3 px-3 text-muted-foreground text-xs">{c.address || "—"}</td>
                <td className="py-3 px-3 text-right"><div className="flex items-center justify-end gap-1">
                  {c.phone && (
                    <>
                      <a href={`tel:${c.phone}`} className="p-1.5 rounded hover:bg-success/10 text-muted-foreground hover:text-success" title="Call" onClick={e => e.stopPropagation()}><Phone className="h-3.5 w-3.5" /></a>
                      <a href={`https://wa.me/${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-success/10 text-muted-foreground hover:text-success" title="WhatsApp" onClick={e => e.stopPropagation()}><MessageSquare className="h-3.5 w-3.5" /></a>
                    </>
                  )}
                  <button onClick={() => viewHistory(c)} className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary" title="Purchase history"><Eye className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { setEditItem(c); setShowForm(true); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div></td>
              </tr>
            ))}
          </tbody></table></div>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {filtered.map(c => (
              <div key={c.id} className="glass-card rounded-xl p-4">
                <div className="flex items-start justify-between mb-1">
                  <div><h4 className="text-sm font-semibold text-foreground">{c.name}</h4><p className="text-xs text-muted-foreground">{c.phone || "No phone"}</p></div>
                  <div className="flex gap-1">
                    {c.phone && (
                      <>
                        <a href={`tel:${c.phone}`} className="p-1.5 rounded hover:bg-success/10 text-muted-foreground hover:text-success" title="Call"><Phone className="h-3.5 w-3.5" /></a>
                        <a href={`https://wa.me/${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-success/10 text-muted-foreground hover:text-success" title="WhatsApp"><MessageSquare className="h-3.5 w-3.5" /></a>
                      </>
                    )}
                    <button onClick={() => viewHistory(c)} className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground"><Eye className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { setEditItem(c); setShowForm(true); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Edit2 className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
              </div>
            ))}
          </div>
        </>}
      </div>

      {/* Customer Form - simplified without GST/credit/outstanding */}
      {showForm && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-foreground">{editItem.id ? "Edit" : "New"} Customer</h3><button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button></div>
            <div className="space-y-3">
              {[{l:"Name *",k:"name"},{l:"Phone",k:"phone"},{l:"Email",k:"email"},{l:"Address",k:"address"}].map(({l,k})=>(
                <div key={k}><label className="text-xs font-medium text-muted-foreground mb-1 block">{l}</label><input type="text" value={(editItem as any)[k]??""} onChange={e=>setEditItem({...editItem,[k]:e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
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
      {viewCustomer && !selectedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setViewCustomer(null)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg mx-4 animate-fade-in max-h-[85vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">{viewCustomer.name}</h3>
                <p className="text-xs text-muted-foreground">{viewCustomer.phone || "No phone"} • {viewCustomer.email || "No email"}</p>
              </div>
              <button onClick={() => setViewCustomer(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" /> Purchase History ({customerSales.length})</h4>
            {loadingHistory ? <div className="text-center text-muted-foreground py-8">Loading...</div> :
            customerSales.length === 0 ? <p className="text-center text-muted-foreground py-8">No purchases yet</p> :
            <div className="space-y-2">
              {customerSales.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => viewBillDetail(s)}>
                  <div>
                    <p className="text-sm font-medium text-foreground font-mono">{s.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()} • {(s.payment_mode || "").toUpperCase()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-primary">₹{Number(s.grand_total).toFixed(0)}</span>
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>}
          </div>
        </div>
      )}

      {/* Full Bill View Modal */}
      {selectedBill && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setSelectedBill(null)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">{selectedBill.invoice_number}</h3>
                <p className="text-xs text-muted-foreground">{new Date(selectedBill.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedBill(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>

            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${selectedBill.status === "completed" ? "bg-success/10 text-success" : "bg-accent/10 text-accent"}`}>{selectedBill.status}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground uppercase">{selectedBill.payment_mode}</span>
            </div>

            {viewCustomer && (
              <div className="mb-3 p-2 rounded-lg bg-muted/30 border border-border/30">
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="text-sm font-medium text-foreground">{viewCustomer.name}</p>
                {viewCustomer.phone && <p className="text-xs text-muted-foreground">{viewCustomer.phone}</p>}
              </div>
            )}

            {loadingBillItems ? <div className="text-center text-muted-foreground py-8">Loading items...</div> : (
              <table className="w-full text-sm mb-4">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-2 text-xs text-muted-foreground">Item</th>
                  <th className="text-center py-2 text-xs text-muted-foreground">Type</th>
                  <th className="text-right py-2 text-xs text-muted-foreground">Qty</th>
                  <th className="text-right py-2 text-xs text-muted-foreground">Rate</th>
                  <th className="text-right py-2 text-xs text-muted-foreground">Total</th>
                </tr></thead>
                <tbody>
                  {billItems.map(si => (
                    <tr key={si.id} className="border-b border-border/30">
                      <td className="py-2 text-foreground text-xs">{si.item_name}</td>
                      <td className="py-2 text-center"><span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground uppercase">{si.sale_type || "strip"}</span></td>
                      <td className="py-2 text-right text-muted-foreground text-xs">{si.quantity}</td>
                      <td className="py-2 text-right text-muted-foreground text-xs">₹{Number(si.unit_price).toFixed(2)}</td>
                      <td className="py-2 text-right font-medium text-foreground text-xs">₹{Number(si.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="space-y-1 border-t border-border pt-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="text-foreground">₹{Number(selectedBill.subtotal).toFixed(2)}</span></div>
              {Number(selectedBill.discount || 0) > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Discount</span><span className="text-success">-₹{Number(selectedBill.discount).toFixed(2)}</span></div>}
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">GST</span><span className="text-foreground">₹{Number(selectedBill.tax_total || 0).toFixed(2)}</span></div>
              <div className="h-px bg-border my-1" />
              <div className="flex justify-between text-lg font-bold"><span className="text-foreground">Total</span><span className="text-primary">₹{Number(selectedBill.grand_total).toFixed(2)}</span></div>
            </div>

            <div className="flex gap-2 mt-4 pt-3 border-t border-border flex-wrap">
              <button onClick={printBill} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 touch-manipulation">
                <Printer className="h-4 w-4" /> Print
              </button>
              <button onClick={shareOnWhatsApp} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-success/10 text-success text-sm font-medium hover:bg-success/20 touch-manipulation">
                <MessageSquare className="h-4 w-4" /> WhatsApp
              </button>
              <button onClick={repurchaseBill} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 touch-manipulation">
                <RefreshCw className="h-4 w-4" /> Repurchase
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
