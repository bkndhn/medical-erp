import { useState, useRef, useMemo, useEffect } from "react";
import { Search, Plus, Minus, Trash2, CreditCard, Keyboard, Pause, Maximize } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { usePOSShortcuts } from "@/hooks/usePOSShortcuts";
import { toast } from "sonner";

interface Item {
  id: string; name: string; sku: string | null; barcode: string | null;
  price: number; mrp: number; gst_rate: number | null; stock: number;
  category_id: string | null; unit: string | null;
}

interface CartItem {
  item: Item; quantity: number; discount: number; total: number;
}

const shortcutMap = [
  { key: 'F1', action: 'Search Products', category: 'Billing' },
  { key: 'F6', action: 'Hold Bill', category: 'Billing' },
  { key: 'F9', action: 'Open Payment', category: 'Billing' },
  { key: 'F12', action: 'Print & Complete', category: 'Billing' },
  { key: 'Enter', action: 'Confirm Payment', category: 'Payment' },
  { key: 'Tab', action: 'Switch Payment Mode', category: 'Payment' },
  { key: '?', action: 'Shortcut Help', category: 'General' },
  { key: 'Esc', action: 'Close / Cancel', category: 'General' },
];

export default function POS() {
  const { tenantId, branchId, user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showPayment, setShowPayment] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'card'>('cash');
  const [cashReceived, setCashReceived] = useState("");
  const [billCount, setBillCount] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tenantId) return;
    Promise.all([
      supabase.from("items").select("*").eq("tenant_id", tenantId).eq("is_active", true).order("name"),
      supabase.from("categories").select("*").eq("tenant_id", tenantId).order("sort_order"),
      supabase.from("sales").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    ]).then(([{ data: it }, { data: cat }, { count }]) => {
      setItems((it as unknown as Item[]) || []);
      setCategories((cat as any) || []);
      setBillCount((count || 0) + 1);
    });
  }, [tenantId]);

  const billNo = `INV-${String(billCount).padStart(4, "0")}`;

  const filteredProducts = useMemo(() => {
    let filtered = items;
    if (activeCategory !== "all") filtered = filtered.filter(p => p.category_id === activeCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.barcode?.includes(q) || p.sku?.toLowerCase().includes(q));
    }
    return filtered;
  }, [items, activeCategory, searchQuery]);

  const addToCart = (item: Item) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i => i.item.id === item.id
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * Number(i.item.price) - i.discount }
          : i
        );
      }
      return [...prev, { item, quantity: 1, discount: 0, total: Number(item.price) }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.item.id !== id) return i;
      const newQty = Math.max(1, i.quantity + delta);
      return { ...i, quantity: newQty, total: newQty * Number(i.item.price) - i.discount };
    }));
  };

  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.item.id !== id));

  const subtotal = cart.reduce((sum, i) => sum + i.total, 0);
  const gstTotal = cart.reduce((sum, i) => sum + (i.total * (Number(i.item.gst_rate) || 0) / 100), 0);
  const grandTotal = subtotal + gstTotal;
  const change = cashReceived ? parseFloat(cashReceived) - grandTotal : 0;

  const completeSale = async () => {
    if (!tenantId || cart.length === 0) return;
    try {
      const { data: sale, error } = await supabase.from("sales").insert({
        tenant_id: tenantId, branch_id: branchId, cashier_id: user?.id,
        invoice_number: billNo, subtotal, discount: 0, tax_total: gstTotal,
        grand_total: grandTotal, payment_mode: paymentMode as any,
        amount_paid: paymentMode === "cash" ? parseFloat(cashReceived) || grandTotal : grandTotal,
        change_amount: Math.max(0, change), status: "completed" as any,
      } as any).select().single();
      if (error) throw error;

      // Insert sale items
      const saleItems = cart.map(i => ({
        sale_id: sale.id, item_id: i.item.id, item_name: i.item.name,
        quantity: i.quantity, unit_price: Number(i.item.price), discount: i.discount,
        tax_amount: i.total * (Number(i.item.gst_rate) || 0) / 100, total: i.total,
      }));
      await supabase.from("sale_items").insert(saleItems as any);

      // Update stock
      for (const ci of cart) {
        await supabase.from("items").update({ stock: Number(ci.item.stock) - ci.quantity } as any).eq("id", ci.item.id);
      }

      // Record payment
      await supabase.from("payments").insert({
        tenant_id: tenantId, branch_id: branchId, sale_id: sale.id,
        amount: grandTotal, payment_mode: paymentMode as any,
      } as any);

      toast.success(`Bill ${billNo} completed! ₹${grandTotal.toFixed(0)} via ${paymentMode.toUpperCase()}`);
      setCart([]); setShowPayment(false); setCashReceived("");
      setBillCount(prev => prev + 1);

      // Refresh items for updated stock
      const { data: it } = await supabase.from("items").select("*").eq("tenant_id", tenantId).eq("is_active", true).order("name");
      setItems((it as unknown as Item[]) || []);
    } catch (err: any) {
      toast.error(err.message || "Sale failed");
    }
  };

  usePOSShortcuts({
    enabled: true,
    onSearch: () => searchRef.current?.focus(),
    onPayment: () => cart.length > 0 && setShowPayment(true),
    onHoldBill: () => toast.info("Bill held"),
    onRecallBill: () => toast.info("No held bills"),
    onReprint: () => toast.info("Reprinting last bill..."),
    onHelp: () => setShowShortcuts(s => !s),
    onPrintComplete: () => { if (cart.length > 0) completeSale(); },
  });

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 h-12 border-b border-border bg-card/50 backdrop-blur shrink-0">
        <div className="flex items-center gap-3 ml-10 md:ml-0">
          <h2 className="text-sm font-bold text-foreground">POS</h2>
          <span className="text-xs text-muted-foreground font-mono">{billNo}</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-success/10 text-success border border-success/20">ACTIVE</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowShortcuts(true)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Keyboard className="h-4 w-4" /></button>
          <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Maximize className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Left: Products */}
        <div className="flex-1 flex flex-col overflow-hidden md:border-r border-border">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input ref={searchRef} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search products, scan barcode... (F1)" className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
            </div>
          </div>

          {/* Categories */}
          <div className="flex gap-1.5 px-3 py-2 overflow-x-auto scrollbar-thin border-b border-border shrink-0">
            <button onClick={() => setActiveCategory("all")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${activeCategory === "all" ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"}`}>
              📦 All Items
            </button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${activeCategory === cat.id ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"}`}>
                {cat.icon || "📁"} {cat.name}
              </button>
            ))}
          </div>

          {/* Product Grid - responsive touch-optimized */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">No products found</p>
                <p className="text-xs">Add items in Inventory first</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {filteredProducts.map(item => (
                  <button key={item.id} onClick={() => addToCart(item)} className="pos-grid-item text-left touch-manipulation">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg">📦</div>
                    <p className="text-xs font-medium text-foreground line-clamp-2 leading-tight">{item.name}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-primary">₹{Number(item.price)}</span>
                      {Number(item.mrp) > Number(item.price) && <span className="text-[10px] text-muted-foreground line-through">₹{Number(item.mrp)}</span>}
                    </div>
                    <span className="text-[10px] text-muted-foreground">Stock: {Number(item.stock)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Shortcut Bar - hidden on mobile */}
          <div className="hidden md:flex items-center gap-3 px-3 py-2 border-t border-border bg-card/30 text-[10px] text-muted-foreground shrink-0">
            {[["F1","Search"],["F6","Hold"],["F9","Pay"],["F12","Complete"],["?","Help"]].map(([k,l]) => (
              <span key={k} className="flex items-center gap-1 whitespace-nowrap"><kbd className="kbd-shortcut">{k}</kbd>{l}</span>
            ))}
          </div>
        </div>

        {/* Right: Bill Panel */}
        <div className="w-full md:w-[380px] flex flex-col bg-card/30 shrink-0 border-t md:border-t-0 border-border max-h-[50vh] md:max-h-none">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Current Bill</h3>
              <span className="text-xs text-muted-foreground">{cart.length} items</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
                <p className="text-sm">No items yet</p>
                <p className="text-xs">Scan or click to add</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {cart.map(ci => (
                  <div key={ci.item.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{ci.item.name}</p>
                        <p className="text-xs text-muted-foreground">₹{Number(ci.item.price)} × {ci.quantity} • GST {Number(ci.item.gst_rate) || 0}%</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground whitespace-nowrap">₹{ci.total.toFixed(0)}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => updateQty(ci.item.id, -1)} className="p-1.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground touch-manipulation"><Minus className="h-3 w-3" /></button>
                      <span className="text-sm font-mono font-semibold text-foreground w-8 text-center">{ci.quantity}</span>
                      <button onClick={() => updateQty(ci.item.id, 1)} className="p-1.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground touch-manipulation"><Plus className="h-3 w-3" /></button>
                      <button onClick={() => removeItem(ci.item.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive ml-auto touch-manipulation"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="border-t border-border p-4 space-y-2 bg-card/50 shrink-0">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="text-foreground">₹{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">GST</span><span className="text-foreground">₹{gstTotal.toFixed(2)}</span></div>
            <div className="h-px bg-border" />
            <div className="flex justify-between text-lg font-bold"><span className="text-foreground">Total</span><span className="text-gradient-primary">₹{grandTotal.toFixed(2)}</span></div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={() => { toast.info("Bill held"); setCart([]); }} className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 touch-manipulation">
                <Pause className="h-3.5 w-3.5" /> Hold
              </button>
              <button onClick={() => cart.length > 0 && setShowPayment(true)} disabled={cart.length === 0} className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 touch-manipulation">
                <CreditCard className="h-3.5 w-3.5" /> Pay
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowPayment(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground mb-4">Payment</h3>
            <p className="text-3xl font-bold text-gradient-primary text-center mb-6">₹{grandTotal.toFixed(2)}</p>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {(["cash", "upi", "card"] as const).map(mode => (
                <button key={mode} onClick={() => setPaymentMode(mode)} className={`py-3 rounded-lg text-sm font-medium transition-all touch-manipulation ${paymentMode === mode ? "bg-primary/15 text-primary border border-primary/40" : "bg-muted text-muted-foreground border border-transparent"}`}>{mode.toUpperCase()}</button>
              ))}
            </div>
            {paymentMode === "cash" && (
              <div className="mb-4">
                <label className="text-xs text-muted-foreground mb-1 block">Cash Received</label>
                <input type="number" value={cashReceived} onChange={e => setCashReceived(e.target.value)} placeholder="Enter amount..." className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground text-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary/50" autoFocus />
                {change > 0 && <p className="text-sm text-success mt-2 font-medium">Change: ₹{change.toFixed(2)}</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowPayment(false)} className="py-3 rounded-lg text-sm font-medium bg-muted text-muted-foreground touch-manipulation">Cancel</button>
              <button onClick={completeSale} className="py-3 rounded-lg text-sm font-medium bg-success text-success-foreground hover:bg-success/90 touch-manipulation">Complete</button>
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto scrollbar-thin animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground mb-4">Keyboard Shortcuts</h3>
            {["Billing", "Payment", "General"].map(cat => (
              <div key={cat} className="mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</p>
                <div className="space-y-1.5">
                  {shortcutMap.filter(s => s.category === cat).map(s => (
                    <div key={s.key} className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-foreground">{s.action}</span>
                      <kbd className="kbd-shortcut">{s.key}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
