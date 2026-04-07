import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Package, Plus, Search, Edit2, Trash2, AlertTriangle, X, Save, Copy, Tag, FolderPlus
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
  category_id: string | null; is_active: boolean; supplier_id: string | null;
}

interface Category {
  id: string; name: string; icon: string | null; color: string | null; sort_order: number | null; is_active: boolean;
}

const MEDICAL_UNITS = ["pcs", "strip", "box", "bottle", "tube", "vial", "sachet", "tablet", "capsule"];
const TEXTILE_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "28", "30", "32", "34", "36", "38", "40", "42", "44", "Free"];
const GENERAL_UNITS = ["pcs", "kg", "g", "ltr", "ml", "box", "pack", "dozen", "meter", "yard"];
const CATEGORY_ICONS = ["📦", "💊", "🧴", "🥛", "🍎", "👕", "🔧", "📱", "🍞", "🧹", "🎁", "🏥", "🧪", "🧲", "📁"];

const emptyItem: Partial<Item> = {
  name: "", sku: "", barcode: "", price: 0, mrp: 0, cost_price: 0,
  unit: "pcs", gst_rate: 0, stock: 0, low_stock_threshold: 10,
  batch_number: "", expiry_date: null, is_active: true, category_id: null,
};

export default function Inventory() {
  const { tenantId } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Partial<Item> | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [sizeVariants, setSizeVariants] = useState<{ size: string; stock: number; price: number }[]>([]);

  // Category management
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editCategory, setEditCategory] = useState<Partial<Category> | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [filterExpiry, setFilterExpiry] = useState<string | null>(null);

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [{ data }, { data: t }, { data: cats }, { data: sups }] = await Promise.all([
      supabase.from("items").select("*").eq("tenant_id", tenantId).order("name"),
      supabase.from("tenants").select("industry").eq("id", tenantId).single(),
      supabase.from("categories").select("*").eq("tenant_id", tenantId).order("sort_order"),
      supabase.from("suppliers").select("id, name").eq("tenant_id", tenantId),
    ]);
    if (data) setItems(data as unknown as Item[]);
    if (cats) setCategories(cats as unknown as Category[]);
    if (sups) setSuppliers(sups || []);
    setTenant(t);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [tenantId]);

  const industry = tenant?.industry || "grocery";
  const isMedical = industry === "medical";
  const isTextile = industry === "textile";
  const unitOptions = isMedical ? MEDICAL_UNITS : GENERAL_UNITS;

  const filtered = items.filter((i) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || i.name.toLowerCase().includes(q) || (i.sku?.toLowerCase().includes(q)) || (i.barcode?.includes(q));
    const matchesFilter = !filterLowStock || (i.stock <= (i.low_stock_threshold || 10));
    const matchesCat = !filterCategory || i.category_id === filterCategory;
    let matchesExpiry = true;
    if (filterExpiry) {
      const today = new Date();
      if (filterExpiry === "expired") matchesExpiry = !!i.expiry_date && new Date(i.expiry_date) < today;
      else if (filterExpiry === "30d") matchesExpiry = !!i.expiry_date && new Date(i.expiry_date) >= today && Math.ceil((new Date(i.expiry_date).getTime() - today.getTime()) / 86400000) <= 30;
      else if (filterExpiry === "90d") matchesExpiry = !!i.expiry_date && new Date(i.expiry_date) >= today && Math.ceil((new Date(i.expiry_date).getTime() - today.getTime()) / 86400000) <= 90;
    }
    return matchesSearch && matchesFilter && matchesCat && matchesExpiry;
  });

  const lowStockCount = items.filter((i) => i.stock <= (i.low_stock_threshold || 10)).length;
  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]));
  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));

  const handleSave = async () => {
    if (!editItem?.name || !tenantId) return;
    // Mandatory fields validation for new items
    if (!editItem.id) {
      const missing: string[] = [];
      if (!(editItem as any).supplier_id) missing.push("Supplier");
      if (!editItem.price || editItem.price <= 0) missing.push("Price");
      if (!editItem.mrp || editItem.mrp <= 0) missing.push("MRP");
      if (!editItem.cost_price || editItem.cost_price <= 0) missing.push("Cost Price");
      if (!editItem.unit) missing.push("Unit/Packaging");
      if (!editItem.stock && editItem.stock !== 0) missing.push("Stock");
      if (!editItem.expiry_date) missing.push("Expiry Date");
      if (missing.length > 0) { toast.error(`Required: ${missing.join(", ")}`); return; }
    }
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
          is_active: editItem.is_active, category_id: editItem.category_id || null, supplier_id: (editItem as any).supplier_id || null,
        }).eq("id", editItem.id);
        if (error) throw error;
        toast.success("Item updated");
      } else {
        if (isTextile && sizeVariants.length > 0) {
          for (const variant of sizeVariants) {
            const { error } = await supabase.from("items").insert({
              ...editItem, tenant_id: tenantId,
              name: `${editItem.name} - ${variant.size}`,
              size: variant.size, stock: variant.stock, price: variant.price, mrp: variant.price,
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
      fetchData();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Item deleted"); fetchData(); }
  };

  const openEdit = (item: Item) => { setEditItem(item); setSizeVariants([]); setShowForm(true); };
  const openNew = () => { setEditItem({ ...emptyItem }); setSizeVariants([]); setShowForm(true); };

  // Category CRUD
  const handleSaveCategory = async () => {
    if (!editCategory?.name || !tenantId) return;
    setSavingCategory(true);
    try {
      if (editCategory.id) {
        const { error } = await supabase.from("categories").update({
          name: editCategory.name, icon: editCategory.icon, color: editCategory.color, sort_order: editCategory.sort_order,
        }).eq("id", editCategory.id);
        if (error) throw error;
        toast.success("Category updated");
      } else {
        const { error } = await supabase.from("categories").insert({
          name: editCategory.name, icon: editCategory.icon || "📁", color: editCategory.color,
          sort_order: categories.length, tenant_id: tenantId,
        } as any);
        if (error) throw error;
        toast.success("Category added");
      }
      setShowCategoryForm(false); setEditCategory(null); fetchData();
    } catch (err: any) { toast.error(err.message); } finally { setSavingCategory(false); }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Delete this category? Items won't be deleted.")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Category deleted"); fetchData(); }
  };

  const addSizeVariant = () => setSizeVariants(prev => [...prev, { size: "", stock: 0, price: editItem?.price || 0 }]);
  const updateSizeVariant = (idx: number, field: string, value: any) => setSizeVariants(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));
  const removeSizeVariant = (idx: number) => setSizeVariants(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className="h-screen flex flex-col overflow-hidden pb-20 md:pb-0">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="ml-10 md:ml-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Package className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Inventory
            </h1>
            <p className="text-sm text-muted-foreground">{items.length} products • {lowStockCount} low stock • {categories.length} categories</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setFilterLowStock(!filterLowStock)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all touch-manipulation ${filterLowStock ? "bg-accent/15 text-accent border border-accent/30" : "bg-muted text-muted-foreground"}`}>
              <AlertTriangle className="h-3.5 w-3.5" /> Low ({lowStockCount})
            </button>
            <select value={filterExpiry || ""} onChange={e => setFilterExpiry(e.target.value || null)}
              className="px-2 py-2 rounded-lg text-xs font-medium bg-muted text-muted-foreground border border-border focus:outline-none">
              <option value="">All Expiry</option>
              <option value="expired">Expired</option>
              <option value="30d">≤30 days</option>
              <option value="90d">≤90 days</option>
            </select>
            <button onClick={() => { setEditCategory({ name: "", icon: "📁", color: null, sort_order: categories.length }); setShowCategoryForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground touch-manipulation">
              <FolderPlus className="h-3.5 w-3.5" /> Category
            </button>
            <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 touch-manipulation">
              <Plus className="h-4 w-4" /> Add Item
            </button>
          </div>
        </div>

        {/* Category filter bar */}
        <div className="flex gap-1.5 mt-3 overflow-x-auto scrollbar-thin">
          <button onClick={() => setFilterCategory(null)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all touch-manipulation ${!filterCategory ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"}`}>📦 All</button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setFilterCategory(filterCategory === cat.id ? null : cat.id)}
              className={`group flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all touch-manipulation ${filterCategory === cat.id ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"}`}>
              {cat.icon || "📁"} {cat.name}
              <span className="text-[10px] text-muted-foreground">({items.filter(i => i.category_id === cat.id).length})</span>
              <button onClick={(e) => { e.stopPropagation(); setEditCategory(cat); setShowCategoryForm(true); }} className="hidden group-hover:inline p-0.5 rounded hover:bg-muted/80"><Edit2 className="h-2.5 w-2.5" /></button>
            </button>
          ))}
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
          <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Category</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">SKU</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Price</th>
                  <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Stock</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Unit</th>
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Supplier</th>
                  {isTextile && <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Size</th>}
                  <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Expiry</th>
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
                    <td className="py-3 px-3 text-xs text-muted-foreground">
                      {item.category_id && categoryMap[item.category_id] ? (
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">{categoryMap[item.category_id].icon} {categoryMap[item.category_id].name}</span>
                      ) : "—"}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground font-mono text-xs">{item.sku || "—"}</td>
                    <td className="py-3 px-3 text-right text-foreground">₹{Number(item.price).toFixed(0)}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`font-semibold ${Number(item.stock) <= (item.low_stock_threshold || 10) ? "text-accent" : "text-success"}`}>
                        {Number(item.stock)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground text-xs">{item.unit || "pcs"}</td>
                    <td className="py-3 px-3 text-muted-foreground text-xs">{item.supplier_id ? (supplierMap[item.supplier_id] || "—") : "—"}</td>
                    {isTextile && <td className="py-3 px-3 text-muted-foreground text-xs">{item.size || "—"}</td>}
                    <td className="py-3 px-3 text-muted-foreground text-xs">
                      {item.expiry_date ? (
                        (() => {
                          const daysLeft = Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / (1000*60*60*24));
                          return <span className={daysLeft <= 0 ? "text-destructive font-bold" : daysLeft <= 30 ? "text-accent font-medium" : ""}>{daysLeft <= 0 ? "EXPIRED" : `${item.expiry_date} (${daysLeft}d)`}</span>;
                        })()
                      ) : "—"}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground touch-manipulation"><Edit2 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive touch-manipulation"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Category Form Modal */}
      {showCategoryForm && editCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowCategoryForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2"><Tag className="h-5 w-5 text-primary" /> {editCategory.id ? "Edit" : "New"} Category</h3>
              <button onClick={() => setShowCategoryForm(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
                <input type="text" value={editCategory.name || ""} onChange={e => setEditCategory({ ...editCategory, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_ICONS.map(icon => (
                    <button key={icon} onClick={() => setEditCategory({ ...editCategory, icon })}
                      className={`p-2 rounded-lg text-lg transition-all touch-manipulation ${editCategory.icon === icon ? "bg-primary/15 ring-2 ring-primary/30" : "bg-muted hover:bg-muted/80"}`}>{icon}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              {editCategory.id && (
                <button onClick={() => { handleDeleteCategory(editCategory.id!); setShowCategoryForm(false); }}
                  className="py-2.5 px-4 rounded-lg bg-destructive/10 text-destructive text-sm font-medium touch-manipulation">Delete</button>
              )}
              <button onClick={() => setShowCategoryForm(false)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium">Cancel</button>
              <button onClick={handleSaveCategory} disabled={savingCategory || !editCategory.name} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">{savingCategory ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}

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

              {/* Category selector */}
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                <select value={editItem.category_id || ""} onChange={e => setEditItem({ ...editItem, category_id: e.target.value || null })}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="">No Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>

              {/* Supplier selector */}
              <div><label className="text-xs font-medium text-accent mb-1 block">Supplier *</label>
                <select value={(editItem as any).supplier_id || ""} onChange={e => setEditItem({ ...editItem, supplier_id: e.target.value || null } as any)}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-accent/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50">
                  <option value="">Select Supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">SKU</label>
                <input type="text" value={editItem.sku || ""} onChange={e => setEditItem({ ...editItem, sku: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Barcode</label>
                <input type="text" value={editItem.barcode || ""} onChange={e => setEditItem({ ...editItem, barcode: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-accent mb-1 block">Price *</label>
                <input type="number" value={editItem.price || ""} onChange={e => setEditItem({ ...editItem, price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg bg-muted border border-accent/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50" /></div>
              <div><label className="text-xs font-medium text-accent mb-1 block">MRP *</label>
                <input type="number" value={editItem.mrp || ""} onChange={e => setEditItem({ ...editItem, mrp: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg bg-muted border border-accent/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50" /></div>
              <div><label className="text-xs font-medium text-accent mb-1 block">Cost Price *</label>
                <input type="number" value={editItem.cost_price || ""} onChange={e => setEditItem({ ...editItem, cost_price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg bg-muted border border-accent/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50" /></div>
              <div><label className="text-xs font-medium text-accent mb-1 block">Unit / Packaging *</label>
                <select value={editItem.unit || "strip"} onChange={e => setEditItem({ ...editItem, unit: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-accent/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50">
                  {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">GST Rate (%)</label>
                <input type="number" value={editItem.gst_rate || ""} onChange={e => setEditItem({ ...editItem, gst_rate: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">HSN Code</label>
                <input type="text" value={editItem.hsn_code || ""} onChange={e => setEditItem({ ...editItem, hsn_code: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-accent mb-1 block">Stock *</label>
                <input type="number" value={editItem.stock || ""} onChange={e => setEditItem({ ...editItem, stock: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Low Stock Threshold</label>
                <input type="number" value={editItem.low_stock_threshold || ""} onChange={e => setEditItem({ ...editItem, low_stock_threshold: parseFloat(e.target.value) || 10 })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>

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

              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Batch Number</label>
                <input type="text" value={editItem.batch_number || ""} onChange={e => setEditItem({ ...editItem, batch_number: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Expiry Date</label>
                <input type="date" value={editItem.expiry_date || ""} onChange={e => setEditItem({ ...editItem, expiry_date: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>

              {isMedical && <>
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Composition</label>
                  <input type="text" value={editItem.composition || ""} onChange={e => setEditItem({ ...editItem, composition: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Manufacturer</label>
                  <input type="text" value={editItem.manufacturer || ""} onChange={e => setEditItem({ ...editItem, manufacturer: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              </>}

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

              {(industry === "fruit" || industry === "grocery") && <>
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Weight/Unit (kg)</label>
                  <input type="number" value={editItem.weight_per_unit || ""} onChange={e => setEditItem({ ...editItem, weight_per_unit: parseFloat(e.target.value) || null })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              </>}
            </div>

            {isTextile && !editItem.id && (
              <div className="mt-6 p-4 rounded-lg border border-border bg-muted/20">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2"><Copy className="h-4 w-4 text-primary" /> Size Variants</h4>
                  <button onClick={addSizeVariant} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 touch-manipulation">
                    <Plus className="h-3 w-3" /> Add Size
                  </button>
                </div>
                {sizeVariants.length === 0 && <p className="text-xs text-muted-foreground">Add sizes to create multiple items.</p>}
                <div className="space-y-2">
                  {sizeVariants.map((v, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select value={v.size} onChange={e => updateSizeVariant(idx, "size", e.target.value)} className="px-2 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none w-20">
                        <option value="">Size</option>
                        {TEXTILE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input type="number" value={v.stock || ""} onChange={e => updateSizeVariant(idx, "stock", parseFloat(e.target.value) || 0)} placeholder="Stock" className="flex-1 px-2 py-2 rounded-lg bg-muted border border-border text-sm text-foreground" />
                      <input type="number" value={v.price || ""} onChange={e => updateSizeVariant(idx, "price", parseFloat(e.target.value) || 0)} placeholder="Price" className="flex-1 px-2 py-2 rounded-lg bg-muted border border-border text-sm text-foreground" />
                      <button onClick={() => removeSizeVariant(idx)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
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
