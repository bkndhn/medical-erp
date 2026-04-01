import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Plus, Search, X, Eye, Edit2, Save, Package } from "lucide-react";
import { toast } from "sonner";
import DateFilterExport, { exportToExcel, exportToPDF } from "@/components/DateFilterExport";

interface PurchaseItem { item_id: string; item_name: string; quantity: number; unit_price: number; total: number; }
interface PurchaseItemWithUnit extends PurchaseItem { purchase_unit: string; }

export default function Purchases() {
  const { tenantId } = useAuth();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ supplier_id: "", invoice_number: "", notes: "", status: "pending", purchase_date: new Date().toISOString().split('T')[0] });
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemWithUnit[]>([{ item_id: "", item_name: "", quantity: 1, unit_price: 0, total: 0, purchase_unit: "strip" }]);
  const [saving, setSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [viewPurchase, setViewPurchase] = useState<any>(null);
  const [viewItems, setViewItems] = useState<any[]>([]);

  const fetch_ = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: p }, { data: s }, { data: it }] = await Promise.all([
      supabase.from("purchases").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
      supabase.from("suppliers").select("id, name").eq("tenant_id", tenantId),
      supabase.from("items").select("id, name, cost_price").eq("tenant_id", tenantId).eq("is_active", true),
    ]);
    setPurchases((p as any) || []);
    setSuppliers((s as any) || []);
    setItems((it as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, [tenantId]);

  const addPurchaseItem = () => setPurchaseItems(prev => [...prev, { item_id: "", item_name: "", quantity: 1, unit_price: 0, total: 0, purchase_unit: "strip" }]);
  const removePurchaseItem = (idx: number) => { if (purchaseItems.length <= 1) return; setPurchaseItems(prev => prev.filter((_, i) => i !== idx)); };
  const updatePurchaseItem = (idx: number, field: string, value: any) => {
    setPurchaseItems(prev => prev.map((pi, i) => {
      if (i !== idx) return pi;
      const updated = { ...pi, [field]: value };
      if (field === "item_id") {
        const item = items.find(it => it.id === value);
        if (item) { updated.item_name = item.name; updated.unit_price = Number(item.cost_price) || 0; updated.total = updated.quantity * updated.unit_price; }
      }
      if (field === "quantity" || field === "unit_price") { updated.total = (field === "quantity" ? value : updated.quantity) * (field === "unit_price" ? value : updated.unit_price); }
      return updated;
    }));
  };

  const subtotal = purchaseItems.reduce((s, pi) => s + pi.total, 0);

  const handleSave = async () => {
    if (!tenantId || purchaseItems.every(pi => !pi.item_name)) return;
    setSaving(true);
    try {
      const { data: purchase, error } = await supabase.from("purchases").insert({
        tenant_id: tenantId, supplier_id: form.supplier_id || null,
        invoice_number: form.invoice_number || `PO-${Date.now().toString(36).toUpperCase()}`,
        subtotal, tax_total: 0, grand_total: subtotal, notes: form.notes, status: form.status as any,
      } as any).select().single();
      if (error) throw error;

      const validItems = purchaseItems.filter(pi => pi.item_name && pi.quantity > 0);
      if (validItems.length > 0) {
        await supabase.from("purchase_items").insert(validItems.map(pi => ({
          purchase_id: purchase.id, item_id: pi.item_id || null, item_name: pi.item_name,
          quantity: pi.quantity, unit_price: pi.unit_price, total: pi.total, purchase_unit: pi.purchase_unit || "strip",
        })) as any);

        // Update stock if received
        if (form.status === "received") {
          for (const pi of validItems) {
            if (pi.item_id) {
              const item = items.find(i => i.id === pi.item_id);
              if (item) {
                await supabase.from("items").update({ stock: Number(item.stock || 0) + pi.quantity } as any).eq("id", pi.item_id);
              }
            }
          }
        }
      }

      toast.success("Purchase recorded");
      setShowForm(false); setPurchaseItems([{ item_id: "", item_name: "", quantity: 1, unit_price: 0, total: 0, purchase_unit: "strip" }]);
      setForm({ supplier_id: "", invoice_number: "", notes: "", status: "pending", purchase_date: new Date().toISOString().split('T')[0] });
      fetch_();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleView = async (purchase: any) => {
    setViewPurchase(purchase);
    const { data } = await supabase.from("purchase_items").select("*").eq("purchase_id", purchase.id);
    setViewItems((data as any) || []);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("purchases").update({ status: status as any } as any).eq("id", id);
    toast.success(`Status updated to ${status}`);
    fetch_();
    if (viewPurchase?.id === id) setViewPurchase({ ...viewPurchase, status });
  };

  const filtered = purchases.filter(p => {
    const q = search.toLowerCase();
    if (q && !p.invoice_number?.toLowerCase().includes(q)) return false;
    if (dateFrom && new Date(p.created_at) < dateFrom) return false;
    if (dateTo && new Date(p.created_at) > dateTo) return false;
    return true;
  });

  const supplierName = (id: string) => suppliers.find(s => s.id === id)?.name || "—";

  const statusColor = (s: string) => s === "received" ? "bg-success/10 text-success" : s === "cancelled" ? "bg-destructive/10 text-destructive" : s === "partial" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground";

  return (
    <div className="h-screen flex flex-col overflow-hidden pb-20 md:pb-0">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="ml-10 md:ml-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2"><Truck className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Purchases</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} purchase orders</p>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 touch-manipulation">
            <Plus className="h-4 w-4" /> New Purchase
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by invoice..." className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <DateFilterExport
            onFilter={(from, to) => { setDateFrom(from); setDateTo(to); }}
            onExportExcel={() => exportToExcel(filtered.map(p => ({ Invoice: p.invoice_number || "", Date: new Date(p.created_at).toLocaleDateString(), Supplier: supplierName(p.supplier_id), Status: p.status, Total: Number(p.grand_total).toFixed(2) })), "purchases")}
            onExportPDF={() => exportToPDF("Purchases", ["Invoice", "Date", "Supplier", "Status", "Total"], filtered.map(p => [p.invoice_number || "—", new Date(p.created_at).toLocaleDateString(), supplierName(p.supplier_id), p.status, `₹${Number(p.grand_total).toFixed(0)}`]))}
          />
        </div>
      </header>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
        {loading ? <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div> :
        filtered.length === 0 ? <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><Truck className="h-12 w-12 mb-3 opacity-30" /><p>No purchases found</p></div> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border">
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Invoice #</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Date</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Supplier</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Status</th>
          <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Total</th>
          <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">View</th>
        </tr></thead><tbody>
          {filtered.map(p => (
            <tr key={p.id} className="border-b border-border/30 hover:bg-muted/20 cursor-pointer" onClick={() => handleView(p)}>
              <td className="py-3 px-3 font-mono text-primary text-xs">{p.invoice_number || "—"}</td>
              <td className="py-3 px-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
              <td className="py-3 px-3 text-muted-foreground">{supplierName(p.supplier_id)}</td>
              <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusColor(p.status)}`}>{p.status}</span></td>
              <td className="py-3 px-3 text-right font-semibold text-foreground">₹{Number(p.grand_total).toFixed(0)}</td>
              <td className="py-3 px-3 text-center"><Eye className="h-4 w-4 text-muted-foreground inline" /></td>
            </tr>
          ))}
        </tbody></table></div>}
      </div>

      {/* New Purchase Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-2xl mx-4 animate-fade-in max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-foreground">New Purchase Order</h3><button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button></div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Supplier</label>
                <select value={form.supplier_id} onChange={e => setForm({...form, supplier_id: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="">Select supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Invoice #</label><input type="text" value={form.invoice_number} onChange={e=>setForm({...form,invoice_number:e.target.value})} placeholder="Auto-generated" className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="pending">Pending</option><option value="received">Received</option><option value="partial">Partial</option>
                </select>
              </div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label><input type="text" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Purchase Date</label><input type="date" value={form.purchase_date} onChange={e=>setForm({...form,purchase_date:e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
            </div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Items</h4>
            <div className="space-y-2 mb-3">
              {purchaseItems.map((pi, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/50">
                  <select value={pi.item_id} onChange={e => updatePurchaseItem(idx, "item_id", e.target.value)} className="flex-1 px-2 py-1.5 rounded bg-muted border border-border text-xs text-foreground focus:outline-none">
                    <option value="">Select item</option>
                    {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                  </select>
                    <select value={pi.purchase_unit} onChange={e => updatePurchaseItem(idx, "purchase_unit", e.target.value)} className="w-16 px-1 py-1.5 rounded bg-muted border border-border text-xs text-foreground focus:outline-none">
                      <option value="strip">Strip</option>
                      <option value="loose">Loose</option>
                    </select>
                  <input type="number" value={pi.quantity} onChange={e => updatePurchaseItem(idx, "quantity", parseFloat(e.target.value)||0)} placeholder="Qty" className="w-16 px-2 py-1.5 rounded bg-muted border border-border text-xs text-foreground font-mono text-right focus:outline-none" />
                  <input type="number" value={pi.unit_price} onChange={e => updatePurchaseItem(idx, "unit_price", parseFloat(e.target.value)||0)} placeholder="Price" className="w-20 px-2 py-1.5 rounded bg-muted border border-border text-xs text-foreground font-mono text-right focus:outline-none" />
                  <span className="text-xs font-semibold text-foreground w-20 text-right">₹{pi.total.toFixed(0)}</span>
                  <button onClick={() => removePurchaseItem(idx)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
            <button onClick={addPurchaseItem} className="w-full py-2 rounded-lg border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40 mb-4">+ Add Item</button>
            <div className="flex justify-between text-sm font-bold mb-4"><span className="text-foreground">Total</span><span className="text-primary">₹{subtotal.toFixed(0)}</span></div>
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">{saving?"Saving...":"Save Purchase"}</button>
            </div>
          </div>
        </div>
      )}

      {/* View Purchase Detail */}
      {viewPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setViewPurchase(null)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg mx-4 animate-fade-in max-h-[85vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">{viewPurchase.invoice_number || "Purchase"}</h3>
                <p className="text-xs text-muted-foreground">{new Date(viewPurchase.created_at).toLocaleString()} • {supplierName(viewPurchase.supplier_id)}</p>
              </div>
              <button onClick={() => setViewPurchase(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="flex gap-2 mb-4">
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusColor(viewPurchase.status)}`}>{viewPurchase.status}</span>
              {viewPurchase.status !== "received" && <button onClick={() => updateStatus(viewPurchase.id, "received")} className="px-2 py-0.5 rounded text-[10px] font-medium bg-success/10 text-success hover:bg-success/20">Mark Received</button>}
              {viewPurchase.status !== "cancelled" && <button onClick={() => updateStatus(viewPurchase.id, "cancelled")} className="px-2 py-0.5 rounded text-[10px] font-medium bg-destructive/10 text-destructive hover:bg-destructive/20">Cancel</button>}
            </div>
            <table className="w-full text-sm mb-4"><thead><tr className="border-b border-border"><th className="text-left py-2 text-xs text-muted-foreground">Item</th><th className="text-right py-2 text-xs text-muted-foreground">Qty</th><th className="text-right py-2 text-xs text-muted-foreground">Price</th><th className="text-right py-2 text-xs text-muted-foreground">Total</th></tr></thead>
              <tbody>{viewItems.map(vi => (<tr key={vi.id} className="border-b border-border/30"><td className="py-2 text-foreground text-xs">{vi.item_name}</td><td className="py-2 text-right text-muted-foreground text-xs">{vi.quantity}</td><td className="py-2 text-right text-muted-foreground text-xs">₹{Number(vi.unit_price).toFixed(2)}</td><td className="py-2 text-right font-medium text-foreground text-xs">₹{Number(vi.total).toFixed(2)}</td></tr>))}</tbody>
            </table>
            <div className="flex justify-between text-lg font-bold border-t border-border pt-3"><span className="text-foreground">Total</span><span className="text-primary">₹{Number(viewPurchase.grand_total).toFixed(0)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
