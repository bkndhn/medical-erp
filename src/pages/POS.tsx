import { useState, useRef, useEffect, useMemo } from "react";
import { Search, Plus, Minus, Trash2, Percent, CreditCard, Keyboard, Pause, RotateCcw, Printer, Maximize } from "lucide-react";
import { mockProducts, categories, shortcutMap, type Product, type CartItem } from "@/data/mockData";
import { usePOSShortcuts } from "@/hooks/usePOSShortcuts";
import { toast } from "sonner";

export default function POS() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showPayment, setShowPayment] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'card'>('cash');
  const [cashReceived, setCashReceived] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const billNo = "INV-1248";

  const filteredProducts = useMemo(() => {
    let filtered = mockProducts;
    if (activeCategory !== 'all') filtered = filtered.filter(p => p.category === activeCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.sku.toLowerCase().includes(q));
    }
    return filtered;
  }, [activeCategory, searchQuery]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i => i.product.id === product.id
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.product.price - i.discount }
          : i
        );
      }
      return [...prev, { product, quantity: 1, discount: 0, total: product.price }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product.id !== id) return i;
      const newQty = Math.max(1, i.quantity + delta);
      return { ...i, quantity: newQty, total: newQty * i.product.price - i.discount };
    }));
  };

  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.product.id !== id));

  const subtotal = cart.reduce((sum, i) => sum + i.total, 0);
  const gstTotal = cart.reduce((sum, i) => sum + (i.total * i.product.gstRate / 100), 0);
  const grandTotal = subtotal + gstTotal;
  const change = cashReceived ? parseFloat(cashReceived) - grandTotal : 0;

  const completeSale = () => {
    toast.success(`Bill ${billNo} completed! ₹${grandTotal.toFixed(0)} via ${paymentMode.toUpperCase()}`);
    setCart([]);
    setShowPayment(false);
    setCashReceived("");
  };

  usePOSShortcuts({
    enabled: true,
    onSearch: () => searchRef.current?.focus(),
    onPayment: () => cart.length > 0 && setShowPayment(true),
    onHoldBill: () => { toast.info("Bill held successfully"); },
    onRecallBill: () => { toast.info("No held bills"); },
    onReprint: () => { toast.info("Reprinting last bill..."); },
    onHelp: () => setShowShortcuts(s => !s),
    onPrintComplete: () => { if (cart.length > 0) completeSale(); },
  });

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 h-12 border-b border-border bg-card/50 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-foreground">POS</h2>
          <span className="text-xs text-muted-foreground font-mono">{billNo}</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-success/10 text-success border border-success/20">ACTIVE</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowShortcuts(true)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Shortcuts (?)">
            <Keyboard className="h-4 w-4" />
          </button>
          <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Fullscreen (F11)">
            <Maximize className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Products */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search products, scan barcode... (F1)"
                className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="flex gap-1.5 px-3 py-2 overflow-x-auto scrollbar-thin border-b border-border shrink-0">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  activeCategory === cat.id
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="pos-grid-item text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg">
                    {categories.find(c => c.id === product.category)?.icon || '📦'}
                  </div>
                  <p className="text-xs font-medium text-foreground line-clamp-2 leading-tight">{product.name}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-primary">₹{product.price}</span>
                    {product.mrp > product.price && (
                      <span className="text-[10px] text-muted-foreground line-through">₹{product.mrp}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">Stock: {product.stock}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Shortcut Bar */}
          <div className="flex items-center gap-3 px-3 py-2 border-t border-border bg-card/30 text-[10px] text-muted-foreground shrink-0 overflow-x-auto">
            {[['F1','Search'],['F5','Discount'],['F6','Hold'],['F9','Pay'],['F12','Complete'],['?','Help']].map(([k,l]) => (
              <span key={k} className="flex items-center gap-1 whitespace-nowrap">
                <kbd className="kbd-shortcut">{k}</kbd>{l}
              </span>
            ))}
          </div>
        </div>

        {/* Right: Bill Panel */}
        <div className="w-[380px] flex flex-col bg-card/30 shrink-0">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Current Bill</h3>
              <span className="text-xs text-muted-foreground">{cart.length} items</span>
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <ShoppingCartEmpty />
                <p className="text-sm mt-2">No items yet</p>
                <p className="text-xs">Scan or click to add products</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {cart.map((item, i) => (
                  <div key={item.product.id} className="px-4 py-3 hover:bg-muted/20 transition-colors animate-fade-in">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">₹{item.product.price} × {item.quantity} • GST {item.product.gstRate}%</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground whitespace-nowrap">₹{item.total.toFixed(0)}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => updateQty(item.product.id, -1)} className="p-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-sm font-mono font-semibold text-foreground w-8 text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product.id, 1)} className="p-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground">
                        <Plus className="h-3 w-3" />
                      </button>
                      <button onClick={() => removeItem(item.product.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive ml-auto">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="border-t border-border p-4 space-y-2 bg-card/50 shrink-0">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST</span>
              <span className="text-foreground">₹{gstTotal.toFixed(2)}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between text-lg font-bold">
              <span className="text-foreground">Total</span>
              <span className="text-gradient-primary">₹{grandTotal.toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => { toast.info("Bill held"); setCart([]); }}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                <Pause className="h-3.5 w-3.5" />
                Hold <kbd className="kbd-shortcut ml-1">F6</kbd>
              </button>
              <button
                onClick={() => cart.length > 0 && setShowPayment(true)}
                disabled={cart.length === 0}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CreditCard className="h-3.5 w-3.5" />
                Pay <kbd className="kbd-shortcut ml-1 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground">F9</kbd>
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

            {/* Payment Mode */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {(['cash', 'upi', 'card'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setPaymentMode(mode)}
                  className={`py-3 rounded-lg text-sm font-medium transition-all ${
                    paymentMode === mode
                      ? 'bg-primary/15 text-primary border border-primary/40'
                      : 'bg-muted text-muted-foreground border border-transparent hover:bg-muted/80'
                  }`}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>

            {paymentMode === 'cash' && (
              <div className="mb-4">
                <label className="text-xs text-muted-foreground mb-1 block">Cash Received</label>
                <input
                  type="number"
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  placeholder="Enter amount..."
                  className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground text-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                />
                {change > 0 && (
                  <p className="text-sm text-success mt-2 font-medium">Change: ₹{change.toFixed(2)}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowPayment(false)} className="py-3 rounded-lg text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                Cancel <kbd className="kbd-shortcut ml-1">Esc</kbd>
              </button>
              <button
                onClick={completeSale}
                className="py-3 rounded-lg text-sm font-medium bg-success text-success-foreground hover:bg-success/90 transition-colors"
              >
                Complete <kbd className="kbd-shortcut ml-1 border-success-foreground/30 bg-success-foreground/10 text-success-foreground">F12</kbd>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto scrollbar-thin animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">Keyboard Shortcuts</h3>
              <kbd className="kbd-shortcut">?</kbd>
            </div>
            {['Billing', 'Payment', 'Navigation', 'General'].map(cat => (
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

function ShoppingCartEmpty() {
  return (
    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
      <svg className="h-8 w-8 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>
    </div>
  );
}
