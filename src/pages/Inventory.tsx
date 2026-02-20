import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Package, Plus, Search, Edit2, Trash2, AlertTriangle, X, Save, Filter, Download
} from "lucide-react";
import { toast } from "sonner";

interface Item {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  mrp: number;
  cost_price: number | null;
  unit: string | null;
  gst_rate: number | null;
  hsn_code: string | null;
  stock: number;
  low_stock_threshold: number | null;
  batch_number: string | null;
  expiry_date: string | null;
  size: string | null;
  color: string | null;
  material: string | null;
  composition: string | null;
  manufacturer: string | null;
  weight_per_unit: number | null;
  is_weighable: boolean | null;
  category_id: string | null;
  is_active: boolean;
}

const emptyItem: Partial<Item> = {
  name: "", sku: "", barcode: "", price: 0, mrp: 0, cost_price: 0,
  unit: "pcs", gst_rate: 0, stock: 0, low_stock_threshold: 10,
  batch_number: "", expiry_date: null, is_active: true,
};

export default function Inventory() {
  const { tenantId } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Partial<Item> | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterLowStock, setFilterLowStock] = useState(false);

  const fetchItems = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name");
    if (!error && data) setItems(data as unknown as Item[]);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [tenantId]);

  const filtered = items.filter((i) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || i.name.toLowerCase().includes(q) || (i.sku?.toLowerCase().includes(q)) || (i.barcode?.includes(q));
    const matchesFilter = !filterLowStock || (i.stock <= (i.low_stock_threshold || 10));
    return matchesSearch && matchesFilter;
  });

  const lowStockCount = items.filter((i) => i.stock <= (i.low_stock_threshold || 10)).length;

  const handleSave = async () => {
    if (!editItem?.name || !tenantId) return;
    setSaving(true);
    try {
      if (editItem.id) {
        const { error } = await supabase
          .from("items")
          .update({
            name: editItem.name, sku: editItem.sku, barcode: editItem.barcode,
            price: editItem.price || 0, mrp: editItem.mrp || 0, cost_price: editItem.cost_price,
            unit: editItem.unit, gst_rate: editItem.gst_rate, hsn_code: editItem.hsn_code,
            stock: editItem.stock || 0, low_stock_threshold: editItem.low_stock_threshold,
            batch_number: editItem.batch_number, expiry_date: editItem.expiry_date,
            size: editItem.size, color: editItem.color, material: editItem.material,
            composition: editItem.composition, manufacturer: editItem.manufacturer,
            weight_per_unit: editItem.weight_per_unit, is_weighable: editItem.is_weighable,
            is_active: editItem.is_active,
          })
          .eq("id", editItem.id);
        if (error) throw error;
        toast.success("Item updated");
      } else {
        const { error } = await supabase
          .from("items")
          .insert({ ...editItem, tenant_id: tenantId } as any);
        if (error) throw error;
        toast.success("Item created");
      }
      setShowForm(false);
      setEditItem(null);
      fetchItems();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Item deleted"); fetchItems(); }
  };

  const openEdit = (item: Item) => { setEditItem(item); setShowForm(true); };
  const openNew = () => { setEditItem({ ...emptyItem }); setShowForm(true); };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" /> Inventory
            </h1>
            <p className="text-sm text-muted-foreground">{items.length} products • {lowStockCount} low stock</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterLowStock(!filterLowStock)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                filterLowStock ? "bg-accent/15 text-accent border border-accent/30" : "bg-muted text-muted-foreground"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Low Stock ({lowStockCount})
            </button>
            <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Add Item
            </button>
          </div>
        </div>
        <div className="mt-3 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, SKU, barcode..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Package className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-lg font-medium">No items found</p>
            <p className="text-sm">Add your first product to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">SKU</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Barcode</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Price</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">MRP</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Stock</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Unit</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Expiry</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-3 font-medium text-foreground">{item.name}</td>
                    <td className="py-3 px-3 text-muted-foreground font-mono text-xs">{item.sku || "—"}</td>
                    <td className="py-3 px-3 text-muted-foreground font-mono text-xs">{item.barcode || "—"}</td>
                    <td className="py-3 px-3 text-right text-foreground">₹{Number(item.price).toFixed(2)}</td>
                    <td className="py-3 px-3 text-right text-muted-foreground">₹{Number(item.mrp).toFixed(2)}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`font-semibold ${Number(item.stock) <= (item.low_stock_threshold || 10) ? "text-accent" : "text-success"}`}>
                        {Number(item.stock)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">{item.unit}</td>
                    <td className="py-3 px-3 text-muted-foreground text-xs">{item.expiry_date || "—"}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Item Form Modal */}
      {showForm && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto scrollbar-thin animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">{editItem.id ? "Edit Item" : "New Item"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: "Name *", key: "name", type: "text" },
                { label: "SKU", key: "sku", type: "text" },
                { label: "Barcode", key: "barcode", type: "text" },
                { label: "Price", key: "price", type: "number" },
                { label: "MRP", key: "mrp", type: "number" },
                { label: "Cost Price", key: "cost_price", type: "number" },
                { label: "Unit", key: "unit", type: "text" },
                { label: "GST Rate (%)", key: "gst_rate", type: "number" },
                { label: "HSN Code", key: "hsn_code", type: "text" },
                { label: "Stock", key: "stock", type: "number" },
                { label: "Low Stock Threshold", key: "low_stock_threshold", type: "number" },
                { label: "Batch Number", key: "batch_number", type: "text" },
                { label: "Expiry Date", key: "expiry_date", type: "date" },
                { label: "Size (Textile)", key: "size", type: "text" },
                { label: "Color (Textile)", key: "color", type: "text" },
                { label: "Material (Textile)", key: "material", type: "text" },
                { label: "Composition (Medical)", key: "composition", type: "text" },
                { label: "Manufacturer (Medical)", key: "manufacturer", type: "text" },
                { label: "Weight/Unit (Fruit)", key: "weight_per_unit", type: "number" },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
                  <input
                    type={type}
                    value={(editItem as any)[key] ?? ""}
                    onChange={(e) => setEditItem({ ...editItem, [key]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground font-medium text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving || !editItem.name} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50">
                <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
