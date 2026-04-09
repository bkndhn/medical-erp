import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Package, Plus, Search, Edit2, Trash2, AlertTriangle, X, Save, Copy, Tag, FolderPlus, Upload, Download, FileSpreadsheet, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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
  rack_location: string | null; is_schedule_h: boolean | null;
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
  unit: "strip", gst_rate: 0, stock: 0, low_stock_threshold: 10,
  batch_number: "", expiry_date: null, is_active: true, category_id: null,
  rack_location: "", is_schedule_h: false,
};

export default function Inventory() {
  const { tenantId, hasRole } = useAuth();
  const isAdmin = hasRole("super_admin") || hasRole("admin");
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

  // Excel import state
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState<Record<string, any>[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importMapping, setImportMapping] = useState<Record<string, string>>({});
  const [importStep, setImportStep] = useState<"upload" | "map" | "preview" | "importing">("upload");
  const [importProgress, setImportProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [{ data }, { data: t }, { data: cats }, { data: sups }] = await Promise.all([
      supabase.from("items").select("*").eq("tenant_id", tenantId).order("name"),
      supabase.from("tenants").select("industry, max_items").eq("id", tenantId).single(),
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
      if (tenant?.max_items && items.length >= tenant.max_items) {
        toast.error(`Item limit reached! Maximum ${tenant.max_items} items allowed on your current plan.`);
        return;
      }
      const missing: string[] = [];
      if (!(editItem as any).supplier_id) missing.push("Supplier");
      if (!editItem.price || editItem.price <= 0) missing.push("Price");
      if (!editItem.mrp || editItem.mrp <= 0) missing.push("MRP");
      if (isAdmin && (!editItem.cost_price || editItem.cost_price <= 0)) missing.push("Cost Price");
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
          rack_location: editItem.rack_location || null, is_schedule_h: editItem.is_schedule_h || false,
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

  // ── Excel Import / Export Logic ───────────────────────────────────────
  const FIELD_MAP: Record<string, string[]> = {
    name: ["name", "item name", "product", "product name", "item", "medicine", "medicine name", "description"],
    sku: ["sku", "item code", "code", "product code"],
    barcode: ["barcode", "bar code", "ean", "upc"],
    price: ["price", "selling price", "sale price", "sp", "rate"],
    mrp: ["mrp", "max price", "maximum retail price", "retail price"],
    cost_price: ["cost", "cost price", "purchase price", "cp", "buying price"],
    unit: ["unit", "uom", "packaging", "pack", "pack type"],
    gst_rate: ["gst", "gst rate", "gst %", "tax", "tax rate", "tax %"],
    hsn_code: ["hsn", "hsn code", "hsn_code"],
    stock: ["stock", "qty", "quantity", "opening stock", "current stock", "balance"],
    low_stock_threshold: ["min stock", "low stock", "threshold", "reorder level", "min qty"],
    batch_number: ["batch", "batch no", "batch number", "lot"],
    expiry_date: ["expiry", "expiry date", "exp date", "exp", "best before"],
    composition: ["composition", "salt", "generic", "molecule", "formula"],
    manufacturer: ["manufacturer", "company", "mfg", "brand", "make"],
    weight_per_unit: ["units per pack", "pack qty", "pack size", "weight", "tabs per strip"],
    size: ["size"],
    color: ["color", "colour"],
    material: ["material", "fabric"],
  };

  const autoMapHeaders = (headers: string[]) => {
    const mapping: Record<string, string> = {};
    headers.forEach(h => {
      const lower = h.toLowerCase().trim();
      for (const [field, aliases] of Object.entries(FIELD_MAP)) {
        if (aliases.includes(lower)) { mapping[h] = field; break; }
      }
    });
    return mapping;
  };

  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
        if (rows.length === 0) { toast.error("File is empty"); return; }
        const headers = Object.keys(rows[0]);
        setImportHeaders(headers);
        setImportData(rows);
        setImportMapping(autoMapHeaders(headers));
        setImportStep("map");
        toast.success(`Loaded ${rows.length} rows from ${file.name}`);
      } catch { toast.error("Failed to read file. Ensure it's a valid Excel/CSV."); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const runImport = async () => {
    if (!tenantId) return;
    const mapped = importData.map(row => {
      const item: any = { tenant_id: tenantId, is_active: true };
      for (const [header, field] of Object.entries(importMapping)) {
        if (!field || field === "_skip") continue;
        let val = row[header];
        if (["price", "mrp", "cost_price", "stock", "gst_rate", "low_stock_threshold", "weight_per_unit"].includes(field))
          val = parseFloat(String(val).replace(/[^\d.-]/g, "")) || 0;
        if (field === "expiry_date" && val) {
          if (val instanceof Date) val = val.toISOString().split("T")[0];
          else { const d = new Date(String(val)); val = isNaN(d.getTime()) ? null : d.toISOString().split("T")[0]; }
        }
        if (field === "low_stock_threshold" && !val) val = 10;
        item[field] = val;
      }
      if (!item.name || String(item.name).trim() === "") return null;
      if (!item.unit) item.unit = "pcs";
      if (!item.mrp && item.price) item.mrp = item.price;
      return item;
    }).filter(Boolean);

    if (mapped.length === 0) { toast.error("No valid items to import"); return; }
    
    if (tenant?.max_items && items.length + mapped.length > tenant.max_items) {
      toast.error(`Import would exceed your item limit of ${tenant.max_items}. Please upgrade your plan or import fewer items.`);
      return;
    }

    setImportStep("importing"); setImportProgress(0);
    const BATCH = 50;
    let imported = 0;
    for (let i = 0; i < mapped.length; i += BATCH) {
      const batch = mapped.slice(i, i + BATCH);
      const { error } = await supabase.from("items").insert(batch as any);
      if (error) { toast.error(`Batch error: ${error.message}`); break; }
      imported += batch.length;
      setImportProgress(Math.round((imported / mapped.length) * 100));
    }
    toast.success(`✅ Imported ${imported} of ${mapped.length} items`);
    setShowImport(false); setImportStep("upload"); setImportData([]); fetchData();
  };

  const exportToExcel = () => {
    const exportData = filtered.map(i => {
      const data: any = {
        Name: i.name, SKU: i.sku || "", Barcode: i.barcode || "",
        Price: Number(i.price), MRP: Number(i.mrp),
      };
      if (isAdmin) data["Cost Price"] = Number(i.cost_price || 0);
      return {
        ...data,
        Unit: i.unit || "pcs", "GST %": Number(i.gst_rate || 0), HSN: i.hsn_code || "",
        Stock: Number(i.stock), "Min Stock": Number(i.low_stock_threshold || 10),
        Batch: i.batch_number || "", "Expiry Date": i.expiry_date || "",
        Composition: i.composition || "", Manufacturer: i.manufacturer || "",
        "Units Per Pack": Number(i.weight_per_unit || 0),
        Category: i.category_id && categoryMap[i.category_id] ? categoryMap[i.category_id].name : "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `inventory_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Exported ${exportData.length} items`);
  };

  const downloadTemplate = () => {
    const sample = [{
      Name: "Paracetamol 500mg", SKU: "PARA500", Barcode: "8901234567890",
      Price: 25, MRP: 30, "Cost Price": 18, Unit: "strip",
      "GST %": 12, HSN: "30049099", Stock: 100, "Min Stock": 20,
      Batch: "BN2024A", "Expiry Date": "2026-12-31",
      Composition: "Paracetamol", Manufacturer: "Sun Pharma", "Units Per Pack": 10,
    }, {
      Name: "Amoxicillin 250mg", SKU: "AMOX250", Barcode: "",
      Price: 45, MRP: 52, "Cost Price": 32, Unit: "strip",
      "GST %": 12, HSN: "30041090", Stock: 50, "Min Stock": 10,
      Batch: "BN2024B", "Expiry Date": "2025-06-30",
      Composition: "Amoxicillin", Manufacturer: "Cipla", "Units Per Pack": 10,
    }];
    const ws = XLSX.utils.json_to_sheet(sample);
    // Set column widths
    ws["!cols"] = Object.keys(sample[0]).map(k => ({ wch: Math.max(k.length + 2, 14) }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "inventory_import_template.xlsx");
    toast.success("Template downloaded");
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden pb-20 md:pb-0">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="ml-10 md:ml-0 min-w-0">
            <h1 className="text-base sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Package className="h-5 sm:h-6 w-5 sm:w-6 text-primary shrink-0" /> Inventory
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{items.length} products • {lowStockCount} low stock</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => { setShowImport(true); setImportStep("upload"); setImportData([]); }}
              className="p-2 sm:px-3 sm:py-2 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground touch-manipulation"
              title="Import from Excel">
              <Upload className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline-flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Import</span>
            </button>
            <button onClick={exportToExcel}
              className="p-2 sm:px-3 sm:py-2 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground touch-manipulation"
              title="Export to Excel">
              <Download className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline-flex items-center gap-1.5"><Download className="h-3.5 w-3.5" /> Export</span>
            </button>
            <button onClick={() => { setEditCategory({ name: "", icon: "📁", color: null, sort_order: categories.length }); setShowCategoryForm(true); }}
              className="p-2 sm:px-3 sm:py-2 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground touch-manipulation"
              title="Add Category">
              <FolderPlus className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline-flex items-center gap-1.5"><FolderPlus className="h-3.5 w-3.5" /> Category</span>
            </button>
            <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-medium hover:bg-primary/90 touch-manipulation">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Item</span><span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-1.5 mt-2 overflow-x-auto scrollbar-thin">
          <button onClick={() => setFilterLowStock(!filterLowStock)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all touch-manipulation whitespace-nowrap shrink-0 ${filterLowStock ? "bg-accent/15 text-accent border border-accent/30" : "bg-muted text-muted-foreground"}`}>
            <AlertTriangle className="h-3 w-3" /> Low ({lowStockCount})
          </button>
          <select value={filterExpiry || ""} onChange={e => setFilterExpiry(e.target.value || null)}
            className="px-2 py-1.5 rounded-lg text-[11px] font-medium bg-muted text-muted-foreground border border-border focus:outline-none shrink-0">
            <option value="">All Expiry</option>
            <option value="expired">Expired</option>
            <option value="30d">≤30 days</option>
            <option value="90d">≤90 days</option>
          </select>
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
          <>
            {/* Mobile card layout */}
            <div className="md:hidden space-y-2">
              {filtered.map((item) => {
                const isLow = Number(item.stock) <= (item.low_stock_threshold || 10);
                const isOut = Number(item.stock) === 0;
                return (
                  <div key={item.id} className={`glass-card rounded-xl p-3 ${isOut ? "border-destructive/30 bg-destructive/5" : isLow ? "border-accent/30 bg-accent/5" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {item.category_id && categoryMap[item.category_id] && (
                          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">{categoryMap[item.category_id].icon} {categoryMap[item.category_id].name}</span>
                        )}
                        {item.sku && <span className="text-[10px] font-mono text-muted-foreground">{item.sku}</span>}
                        {item.unit && <span className="text-[10px] text-muted-foreground">{item.unit}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground touch-manipulation"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive touch-manipulation"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Price</p>
                        <p className="text-sm font-semibold text-foreground">₹{Number(item.price)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Stock</p>
                        <p className={`text-sm font-bold ${isOut ? "text-destructive" : isLow ? "text-accent" : "text-success"}`}>{isOut ? "OUT" : Number(item.stock)}</p>
                      </div>
                      {item.supplier_id && supplierMap[item.supplier_id] && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">Supplier</p>
                          <p className="text-xs text-foreground truncate max-w-[80px]">{supplierMap[item.supplier_id]}</p>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      {item.expiry_date ? (() => {
                        const daysLeft = Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / 86400000);
                        return <span className={`text-[10px] ${daysLeft <= 0 ? "text-destructive font-bold" : daysLeft <= 30 ? "text-accent" : "text-muted-foreground"}`}>{daysLeft <= 0 ? "EXPIRED" : `Exp ${daysLeft}d`}</span>;
                      })() : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table layout */}
          <div className="hidden md:block overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
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
          </>
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 w-full max-w-2xl sm:mx-4 overflow-y-auto scrollbar-thin animate-fade-in" style={{ maxHeight: 'calc(100dvh - 8px)' }} onClick={(e) => e.stopPropagation()}>
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
              {isAdmin && (
                <div><label className="text-xs font-medium text-accent mb-1 block">Cost Price *</label>
                  <input type="number" value={editItem.cost_price || ""} onChange={e => setEditItem({ ...editItem, cost_price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg bg-muted border border-accent/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50" /></div>
              )}
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
              <div><label className="text-xs font-medium text-accent mb-1 block">Expiry Date *</label>
                <input type="date" value={editItem.expiry_date || ""} onChange={e => setEditItem({ ...editItem, expiry_date: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-accent/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50" /></div>

              {isMedical && <>
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Composition / Salt</label>
                  <input type="text" value={editItem.composition || ""} onChange={e => setEditItem({ ...editItem, composition: e.target.value })}
                    placeholder="e.g., Paracetamol 500mg"
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Manufacturer / Brand</label>
                  <input type="text" value={editItem.manufacturer || ""} onChange={e => setEditItem({ ...editItem, manufacturer: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Rack / Shelf Location</label>
                  <input type="text" value={editItem.rack_location || ""} onChange={e => setEditItem({ ...editItem, rack_location: e.target.value })}
                    placeholder="e.g., Rack 2, Box C"
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <input type="checkbox" id="schedule-h-toggle"
                    checked={editItem.is_schedule_h || false}
                    onChange={e => setEditItem({ ...editItem, is_schedule_h: e.target.checked })}
                    className="h-4 w-4 rounded accent-destructive" />
                  <div>
                    <label htmlFor="schedule-h-toggle" className="text-xs font-semibold text-destructive cursor-pointer">Schedule H / H1 Drug</label>
                    <p className="text-[10px] text-muted-foreground">Prescription required at POS billing</p>
                  </div>
                </div>
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
      {/* Excel Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="glass-card rounded-2xl p-6 w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2"><FileSpreadsheet className="h-6 w-6 text-primary" /> Import Inventory</h3>
              {importStep !== "importing" && <button onClick={() => setShowImport(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>}
            </div>

            {importStep === "upload" && (
              <div className="flex-1 flex flex-col">
                <div className={`flex-1 min-h-[300px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/20"}`}>
                  <Upload className={`h-12 w-12 mb-4 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
                  <h4 className="text-lg font-semibold text-foreground mb-2">Drag & Drop your Excel file here</h4>
                  <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">Supports .xlsx, .xls, and .csv files. Download the template below if you need a starting point.</p>
                  <label className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                    Browse Files
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }} />
                  </label>
                </div>
                <div className="mt-6 flex justify-between items-center bg-muted/50 p-4 rounded-xl">
                  <div className="text-sm text-muted-foreground">Need a template? Get the correctly formatted Excel file.</div>
                  <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background border border-border text-foreground hover:bg-muted text-sm font-medium transition-colors">
                    <Download className="h-4 w-4" /> Download Template
                  </button>
                </div>
              </div>
            )}

            {importStep === "map" && (
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-4 bg-primary/10 text-primary px-4 py-3 rounded-lg text-sm font-medium">
                  <span>Found {importData.length} rows in your file.</span>
                  <span>Match your columns below:</span>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin">
                  <div className="grid grid-cols-2 gap-4 mb-2 px-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Excel Column</span>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Map to App Field</span>
                  </div>
                  <div className="space-y-2">
                    {importHeaders.map(h => (
                      <div key={h} className="grid grid-cols-2 gap-4 items-center bg-muted/30 p-2.5 rounded-lg border border-border/50">
                        <span className="text-sm font-medium truncate" title={h}>{h}</span>
                        <select value={importMapping[h] || "_skip"} onChange={e => setImportMapping({ ...importMapping, [h]: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-md bg-background border border-border text-sm text-foreground focus:ring-2 focus:ring-primary/50">
                          <option value="_skip">-- Skip Column --</option>
                          <option disabled>──────────</option>
                          <option value="name">Item Name *</option>
                          <option value="price">Selling Price *</option>
                          <option value="mrp">MRP</option>
                          <option value="cost_price">Cost Price</option>
                          <option value="stock">Stock Quantity</option>
                          <option value="low_stock_threshold">Low Stock Alert Level</option>
                          <option value="sku">SKU Code</option>
                          <option value="barcode">Barcode</option>
                          <option value="unit">Unit (e.g. pcs, box)</option>
                          <option value="gst_rate">GST %</option>
                          <option value="hsn_code">HSN Code</option>
                          <option value="batch_number">Batch Number</option>
                          <option value="expiry_date">Expiry Date</option>
                          <option value="manufacturer">Brand / Manufacturer</option>
                          <option value="composition">Composition</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3 shrink-0 pt-4 border-t border-border">
                  <button onClick={() => setImportStep("upload")} className="px-5 py-2.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 font-medium text-sm">Back</button>
                  <button onClick={() => setImportStep("preview")} className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-sm transition-colors">
                    Continue to Preview
                  </button>
                </div>
              </div>
            )}

            {importStep === "preview" && (
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="bg-accent/10 text-accent px-4 py-3 rounded-lg text-sm font-medium mb-4">
                  Please review the preview of the first 3 items. If it looks correct, start the import.
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                  <div className="space-y-3">
                    {importData.slice(0, 3).map((row, i) => {
                      const nameKey = Object.keys(importMapping).find(k => importMapping[k] === "name");
                      const priceKey = Object.keys(importMapping).find(k => importMapping[k] === "price");
                      const stockKey = Object.keys(importMapping).find(k => importMapping[k] === "stock");
                      return (
                        <div key={i} className="p-4 rounded-xl border border-border bg-background">
                          <h4 className="font-semibold text-foreground">{nameKey ? row[nameKey] || "Unknown Item" : "Missing Name Mapping"}</h4>
                          <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                            <span>Price: <strong className="text-foreground">₹{priceKey ? row[priceKey] || 0 : 0}</strong></span>
                            <span>Stock: <strong className="text-foreground">{stockKey ? row[stockKey] || 0 : 0}</strong></span>
                          </div>
                        </div>
                      );
                    })}
                    {importData.length > 3 && (
                      <div className="text-center text-sm text-muted-foreground py-2 border-t border-border mt-4">
                        + {importData.length - 3} more items will be imported
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3 shrink-0 pt-4 border-t border-border">
                  <button onClick={() => setImportStep("map")} className="px-5 py-2.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 font-medium text-sm">Back to Mapping</button>
                  <button onClick={runImport} className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-success text-white hover:bg-success/90 font-medium text-sm transition-colors shadow-lg shadow-success/20">
                    <CheckCircle2 className="h-4 w-4" /> Start Import Now
                  </button>
                </div>
              </div>
            )}

            {importStep === "importing" && (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
                <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-6" />
                <h4 className="text-xl font-bold text-foreground mb-2">Importing Items...</h4>
                <p className="text-muted-foreground mb-8">Please do not close this window</p>
                <div className="w-full max-w-md bg-muted rounded-full h-3 overflow-hidden">
                  <div className="bg-primary h-full transition-all duration-300" style={{ width: `${importProgress}%` }} />
                </div>
                <p className="text-sm font-medium mt-3 text-primary">{importProgress}% Complete</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
