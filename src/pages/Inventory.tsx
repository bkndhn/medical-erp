import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Package, Plus, Search, Edit2, Trash2, AlertTriangle, X, Save, Copy
} from "lucide-react";
import { toast } from "sonner";

interface Item {
  id: string; name: string; sku: string | null; barcode: string | null;
  price: number; mrp: number; cost_price: number | null;
  unit: string | null; gst_rate: number | null; hsn_code: string | null;
  stock: number; low_stock_threshold: number | null;
  batch_number: string | null; expiry_date: string | null;
  size: string | null; color: string | null; material: string | null;
  composition: string | null; manufacturer: string | null;
  weight_per_unit: number | null; is_weighable: boolean | null;
  category_id: string | null; is_active: boolean;
}

const MEDICAL_UNITS = ["pcs", "strip", "box", "bottle", "tube", "vial", "sachet", "tablet", "capsule"];
const TEXTILE_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "28", "30", "32", "34", "36", "38", "40", "42", "44", "Free"];
const GENERAL_UNITS = ["pcs", "kg", "g", "ltr", "ml", "box", "pack", "dozen", "meter", "yard"];

const emptyItem: Partial<Item> = {
  name: "", sku: "", barcode: "", price: 0, mrp: 0, cost_price: 0,
  unit: "pcs", gst_rate: 0, stock: 0, low_stock_threshold: 10,
  batch_number: "", expiry_date: null, is_active: true,
};

export default function Inventory() {
  const { tenantId } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Partial<Item> | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterLowStock, setFilterLowStock] = useState(false);
  // Textile multi-size
  const [sizeVariants, setSizeVariants] = useState<{ size: string; stock: number; price: number }[]>([]);

  const fetchItems = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [{ data }, { data: t }] = await Promise.all([
      supabase.from("items").select("*").eq("tenant_id", tenantId).order("name"),
      supabase.from("tenants").select("industry").eq("id", tenantId).single(),
    ]);
    if (data) setItems(data as unknown as Item[]);
    setTenant(t);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [tenantId]);

  const industry = tenant?.industry || "grocery";
  const isMedical = industry === "medical";
  const isTextile = industry === "textile";
  const unitOptions = isMedical ? MEDICAL_UNITS : GENERAL_UNITS;

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
        const { error } = await supabase.from("items").update({
          name: editItem.name, sku: editItem.sku, barcode: editItem.barcode,
          price: editItem.price || 0, mrp: editItem.mrp || 0, cost_price: editItem.cost_price,
          unit: editItem.unit, gst_rate: editItem.gst_rate, hsn_code: editItem.hsn_code,
          stock: editItem.stock || 0, low_stock_threshold: editItem.low_stock_threshold,
          batch_number: editItem.batch_number, expiry_date: editItem.expiry_date,
          size: editItem.size, color: editItem.color, material: editItem.material,
          composition: editItem.composition, manufacturer: editItem.manufacturer,
          weight_per_unit: editItem.weight_per_unit, is_weighable: editItem.is_weighable,
          is_active: editItem.is_active,
        }).eq("id", editItem.id);
        if (error) throw error;
        toast.success("Item updated");
      } else {
        // If textile with size variants, create multiple items
        if (isTextile && sizeVariants.length > 0) {
          for (const variant of sizeVariants) {
            const { error } = await supabase.from("items").insert({
              ...editItem, tenant_id: tenantId,
              name: `${editItem.name} - ${variant.size}`,
              size: variant.size, stock: variant.stock, price: variant.price,
              mrp: variant.price,
            } as any);
            if (error) throw error;
          }
          toast.success(`${sizeVariants.length} size variants created`);
        } else {
          const { error } = await supabase.from("items").insert({ ...editItem, tenant_id: tenantId } as any);
          if (error) throw error;
          toast.success("Item created");
        }
      }
      setShowForm(false); setEditItem(null); setSizeVariants([]);
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

  const openEdit = (item: Item) => { setEditItem(item); setSizeVariants([]); setShowForm(true); };
  const openNew = () => { setEditItem({ ...emptyItem }); setSizeVariants([]); setShowForm(true); };

  const addSizeVariant = () => {
    setSizeVariants(prev => [...prev, { size: "", stock: 0, price: editItem?.price || 0 }]);
  };

  const updateSizeVariant = (idx: number, field: string, value: any) => {
    setSizeVariants(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));
  };

  const removeSizeVariant = (idx: number) => {
    setSizeVariants(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="ml-10 md:ml-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Package className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Inventory
            </h1>
            <p className="text-sm text-muted-foreground">{items.length} products • {lowStockCount} low stock • {industry}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setFilterLowStock(!filterLowStock)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all touch-manipulation ${filterLowStock ? "bg-accent/15 text-accent border border-accent/30" : "bg-muted text-muted-foreground"}`}>
              <AlertTriangle className="h-3.5 w-3.5" /> Low Stock ({lowStockCount})
            </button>
            <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 touch-manipulation">
              <Plus className="h-4 w-4" /> Add Item
            </button>
          </div>
        </div>
        <div className="mt-3 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name, SKU, barcode..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
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
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">SKU</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Price</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Stock</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Unit</th>
                  {isTextile && <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Size</th>}
                  {isMedical && <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Expiry</th>}
                  {isMedical && <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Batch</th>}
                  <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-3 font-medium text-foreground">
                      {item.name}
                      {item.color && <span className="ml-1 text-xs text-muted-foreground">({item.color})</span>}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground font-mono text-xs hidden sm:table-cell">{item.sku || "—"}</td>
                    <td className="py-3 px-3 text-right text-foreground">₹{Number(item.price).toFixed(0)}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`font-semibold ${Number(item.stock) <= (item.low_stock_threshold || 10) ? "text-accent" : "text-success"}`}>
                        {Number(item.stock)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground text-xs">{item.unit || "pcs"}</td>
                    {isTextile && <td className="py-3 px-3 text-muted-foreground text-xs hidden sm:table-cell">{item.size || "—"}</td>}
                    {isMedical && <td className="py-3 px-3 text-muted-foreground text-xs hidden lg:table-cell">{item.expiry_date || "—"}</td>}
                    {isMedical && <td className="py-3 px-3 text-muted-foreground text-xs hidden lg:table-cell">{item.batch_number || "—"}</td>}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground touch-manipulation">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive touch-manipulation">
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
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
                <input type="text" value={editItem.name || ""} onChange={e => setEditItem({ ...editItem, name: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">SKU</label>
                <input type="text" value={editItem.sku || ""} onChange={e => setEditItem({ ...editItem, sku: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Barcode</label>
                <input type="text" value={editItem.barcode || ""} onChange={e => setEditItem({ ...editItem, barcode: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Price</label>
                <input type="number" value={editItem.price || ""} onChange={e => setEditItem({ ...editItem, price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">MRP</label>
                <input type="number" value={editItem.mrp || ""} onChange={e => setEditItem({ ...editItem, mrp: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Cost Price</label>
                <input type="number" value={editItem.cost_price || ""} onChange={e => setEditItem({ ...editItem, cost_price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>

              {/* Unit selector with medical strip/box/bottle options */}
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Unit / Packaging</label>
                <select value={editItem.unit || "pcs"} onChange={e => setEditItem({ ...editItem, unit: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">GST Rate (%)</label>
                <input type="number" value={editItem.gst_rate || ""} onChange={e => setEditItem({ ...editItem, gst_rate: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">HSN Code</label>
                <input type="text" value={editItem.hsn_code || ""} onChange={e => setEditItem({ ...editItem, hsn_code: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Stock</label>
                <input type="number" value={editItem.stock || ""} onChange={e => setEditItem({ ...editItem, stock: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Low Stock Threshold</label>
                <input type="number" value={editItem.low_stock_threshold || ""} onChange={e => setEditItem({ ...editItem, low_stock_threshold: parseFloat(e.target.value) || 10 })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>

              {/* Units per pack - for loose selling (e.g., 10 tablets per strip) */}
              {["strip", "box", "bottle", "pack", "dozen"].includes(editItem.unit || "") && (
                <div><label className="text-xs font-medium text-accent mb-1 block">Units per Pack (for loose selling)</label>
                  <input type="number" value={editItem.weight_per_unit || ""} onChange={e => setEditItem({ ...editItem, weight_per_unit: parseFloat(e.target.value) || null })}
                    placeholder="e.g., 10 tablets per strip"
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-accent/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50" />
                  {editItem.weight_per_unit && editItem.weight_per_unit > 0 && editItem.price ? (
                    <p className="text-[10px] text-accent mt-1">Loose price: ₹{(Number(editItem.price) / editItem.weight_per_unit).toFixed(2)} per unit</p>
                  ) : null}
                </div>
              )}

              {/* Medical fields */}
              {isMedical && <>
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Batch Number</label>
                  <input type="text" value={editItem.batch_number || ""} onChange={e => setEditItem({ ...editItem, batch_number: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Expiry Date</label>
                  <input type="date" value={editItem.expiry_date || ""} onChange={e => setEditItem({ ...editItem, expiry_date: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Composition</label>
                  <input type="text" value={editItem.composition || ""} onChange={e => setEditItem({ ...editItem, composition: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Manufacturer</label>
                  <input type="text" value={editItem.manufacturer || ""} onChange={e => setEditItem({ ...editItem, manufacturer: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              </>}

              {/* Textile fields */}
              {isTextile && <>
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Size</label>
                  <select value={editItem.size || ""} onChange={e => setEditItem({ ...editItem, size: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="">Select size</option>
                    {TEXTILE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Color</label>
                  <input type="text" value={editItem.color || ""} onChange={e => setEditItem({ ...editItem, color: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Material</label>
                  <input type="text" value={editItem.material || ""} onChange={e => setEditItem({ ...editItem, material: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              </>}

              {/* Fruit/Grocery fields */}
              {(industry === "fruit" || industry === "grocery") && <>
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Weight/Unit (kg)</label>
                  <input type="number" value={editItem.weight_per_unit || ""} onChange={e => setEditItem({ ...editItem, weight_per_unit: parseFloat(e.target.value) || null })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              </>}
            </div>

            {/* Textile: Multi-size variant creator (only for new items) */}
            {isTextile && !editItem.id && (
              <div className="mt-6 p-4 rounded-lg border border-border bg-muted/20">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2"><Copy className="h-4 w-4 text-primary" /> Size Variants</h4>
                  <button onClick={addSizeVariant} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 touch-manipulation">
                    <Plus className="h-3 w-3" /> Add Size
                  </button>
                </div>
                {sizeVariants.length === 0 && <p className="text-xs text-muted-foreground">Add sizes to create multiple items with different qty/price. Leave empty for single item.</p>}
                <div className="space-y-2">
                  {sizeVariants.map((v, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select value={v.size} onChange={e => updateSizeVariant(idx, "size", e.target.value)} className="px-2 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-20">
                        <option value="">Size</option>
                        {TEXTILE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input type="number" value={v.stock || ""} onChange={e => updateSizeVariant(idx, "stock", parseFloat(e.target.value) || 0)} placeholder="Stock" className="flex-1 px-2 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                      <input type="number" value={v.price || ""} onChange={e => updateSizeVariant(idx, "price", parseFloat(e.target.value) || 0)} placeholder="Price" className="flex-1 px-2 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                      <button onClick={() => removeSizeVariant(idx)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive touch-manipulation"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground font-medium text-sm touch-manipulation">Cancel</button>
              <button onClick={handleSave} disabled={saving || !editItem.name} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50 touch-manipulation">
                <Save className="h-4 w-4" /> {saving ? "Saving..." : sizeVariants.length > 0 ? `Create ${sizeVariants.length} Variants` : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
