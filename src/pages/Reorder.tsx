import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Truck, ShoppingCart, CheckCircle2, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Item {
  id: string; name: string; sku: string | null;
  stock: number; low_stock_threshold: number | null;
  cost_price: number | null; supplier_id: string | null;
  unit: string | null;
}
interface Supplier { id: string; name: string; phone: string | null; }

export default function Reorder() {
  const { tenantId, activeBranchId } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, { qty: number; selected: boolean }>>({});
  const [defaultDays, setDefaultDays] = useState(15); // suggest stock for X days

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      let q = supabase.from("items").select("id, name, sku, stock, low_stock_threshold, cost_price, supplier_id, unit")
        .eq("tenant_id", tenantId).eq("is_active", true);
      if (activeBranchId) q = q.eq("branch_id", activeBranchId);
      const [{ data: it }, { data: s }] = await Promise.all([
        q,
        supabase.from("suppliers").select("id, name, phone").eq("tenant_id", tenantId),
      ]);
      const lows = ((it as Item[]) || []).filter(i => i.stock <= (i.low_stock_threshold ?? 0));
      setItems(lows);
      setSuppliers((s as Supplier[]) || []);
      const sel: typeof selected = {};
      lows.forEach(i => {
        const target = Math.max((i.low_stock_threshold ?? 10) * 2, 10);
        sel[i.id] = { qty: Math.max(target - i.stock, 1), selected: true };
      });
      setSelected(sel);
      setLoading(false);
    })();
  }, [tenantId, activeBranchId]);

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    items.forEach(i => {
      const key = i.supplier_id || "_none";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    });
    return Array.from(map.entries()).map(([sid, its]) => ({
      supplier: suppliers.find(s => s.id === sid) || null,
      supplier_id: sid === "_none" ? null : sid,
      items: its,
    }));
  }, [items, suppliers]);

  const createPO = async (group: { supplier_id: string | null; items: Item[] }) => {
    if (!tenantId || !activeBranchId) { toast.error("Select a branch first"); return; }
    if (!group.supplier_id) { toast.error("Assign a supplier to these items first"); return; }
    const lines = group.items.filter(i => selected[i.id]?.selected && selected[i.id]?.qty > 0);
    if (!lines.length) { toast.error("Nothing selected"); return; }
    setCreating(group.supplier_id);
    try {
      const total = lines.reduce((s, i) => s + (Number(i.cost_price) || 0) * selected[i.id].qty, 0);
      const { data: purchase, error } = await supabase.from("purchases").insert({
        tenant_id: tenantId, branch_id: activeBranchId, supplier_id: group.supplier_id,
        invoice_number: `AUTO-${Date.now()}`, status: "pending", total,
        notes: "Auto-generated from low-stock reorder",
        purchase_date: new Date().toISOString().split("T")[0],
      } as any).select("id").single();
      if (error) throw error;
      const itemRows = lines.map(i => ({
        purchase_id: purchase.id, tenant_id: tenantId, item_id: i.id, item_name: i.name,
        quantity: selected[i.id].qty, unit_price: Number(i.cost_price) || 0,
        total: (Number(i.cost_price) || 0) * selected[i.id].qty,
      }));
      const { error: e2 } = await supabase.from("purchase_items").insert(itemRows);
      if (e2) throw e2;
      toast.success(`PO created with ${lines.length} items`);
      navigate("/purchases");
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally { setCreating(null); }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden pb-20 md:pb-0">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="ml-10 md:ml-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 sm:h-6 w-5 sm:w-6 text-warning" /> Low-Stock Reorder
            </h1>
            <p className="text-sm text-muted-foreground">{items.length} items below threshold</p>
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <CheckCircle2 className="h-16 w-16 mb-4 text-success" />
            <p className="font-semibold">All stock levels healthy!</p>
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl">
            {grouped.map(group => (
              <div key={group.supplier_id || "none"} className="glass-card rounded-xl p-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">{group.supplier?.name || "No Supplier Assigned"}</h3>
                    <span className="text-xs text-muted-foreground">({group.items.length} items)</span>
                  </div>
                  {group.supplier_id && (
                    <button onClick={() => createPO(group)} disabled={creating === group.supplier_id}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                      {creating === group.supplier_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                      Create PO
                    </button>
                  )}
                </div>
                {!group.supplier_id && (
                  <div className="bg-warning/10 text-warning px-3 py-2 rounded-lg text-xs mb-3">
                    Assign suppliers to these items in Inventory to enable one-click PO creation.
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left py-2 px-2 w-8"></th>
                        <th className="text-left py-2 px-2">Item</th>
                        <th className="text-right py-2 px-2">Stock</th>
                        <th className="text-right py-2 px-2">Threshold</th>
                        <th className="text-right py-2 px-2">Suggested Order</th>
                        <th className="text-right py-2 px-2">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map(i => (
                        <tr key={i.id} className="border-b border-border/30">
                          <td className="py-2 px-2">
                            <input type="checkbox" checked={selected[i.id]?.selected ?? true}
                              onChange={e => setSelected(s => ({ ...s, [i.id]: { ...s[i.id], selected: e.target.checked } }))} />
                          </td>
                          <td className="py-2 px-2 font-medium">{i.name}<div className="text-xs text-muted-foreground">{i.sku}</div></td>
                          <td className="py-2 px-2 text-right text-destructive font-semibold">{i.stock}</td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{i.low_stock_threshold ?? 0}</td>
                          <td className="py-2 px-2 text-right">
                            <input type="number" min={1} value={selected[i.id]?.qty || 0}
                              onChange={e => setSelected(s => ({ ...s, [i.id]: { ...s[i.id], qty: Number(e.target.value) } }))}
                              className="w-20 px-2 py-1 rounded bg-muted border border-border text-right text-sm" />
                          </td>
                          <td className="py-2 px-2 text-right text-muted-foreground">₹{Number(i.cost_price || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
