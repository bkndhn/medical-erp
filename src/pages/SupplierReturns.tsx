import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, Minus, Send, Undo2, X, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Item {
  id: string;
  name: string;
  stock: number;
  cost_price: number | null;
}

interface ReturnCartItem {
  item: Item;
  quantity: number;
}

export default function SupplierReturns() {
  const { tenantId, branchId, user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<ReturnCartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const fetchDependencies = async () => {
      // Assuming suppliers are global across branches, we just fetch by tenant
      // We also fetch items and join supplier_id later, or just show all items and allow returns for any.
      // Usually, a return is to a specific supplier. So we filter items based on the selected supplier.
      const [{ data: itemsData }, { data: suppliersData }] = await Promise.all([
        supabase.from("items").select("id, name, stock, cost_price, supplier_id").eq("tenant_id", tenantId).eq("is_active", true),
        supabase.from("suppliers").select("id, name").eq("tenant_id", tenantId),
      ]);
      setItems(itemsData || []);
      setSuppliers(suppliersData || []);
    };
    fetchDependencies();
  }, [tenantId]);

  const supplierItems = items.filter(i => (i as any).supplier_id === supplierId || !supplierId);
  const filteredItems = supplierItems.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const addToCart = (item: Item) => {
    if (!supplierId) {
      toast.error("Please select a supplier first");
      return;
    }
    setCart(prev => {
      const exists = prev.find(ci => ci.item.id === item.id);
      if (exists) {
        if (exists.quantity + 1 > item.stock) {
          toast.error("Cannot return more than available stock");
          return prev;
        }
        return prev.map(ci => ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci);
      }
      if (item.stock < 1) {
        toast.error("Item out of stock");
        return prev;
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(ci => {
      if (ci.item.id !== id) return ci;
      const newQty = Math.max(1, ci.quantity + delta);
      if (newQty > ci.item.stock) {
        toast.error("Cannot return more than available stock");
        return ci;
      }
      return { ...ci, quantity: newQty };
    }));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(ci => ci.item.id !== id));
  };

  const totalReturnAmount = cart.reduce((sum, ci) => sum + (ci.quantity * (ci.item.cost_price || 0)), 0);

  const submitReturn = async () => {
    if (!supplierId) { toast.error("Select supplier"); return; }
    if (cart.length === 0) { toast.error("Add items to return"); return; }
    if (!tenantId || !branchId || !user) { toast.error("Missing credentials needed for return"); return; }

    setLoading(true);
    try {
      const { data: returnRecord, error } = await (supabase as any).from("supplier_returns").insert({
        tenant_id: tenantId,
        branch_id: branchId,
        supplier_id: supplierId,
        notes,
        total_amount: totalReturnAmount,
        returned_by: user.id,
        return_number: `RET-${Date.now().toString(36).toUpperCase()}`,
        status: "completed"
      } as any).select().single();

      if (error) throw error;

      const returnItems = cart.map(ci => ({
        return_id: returnRecord.id,
        item_id: ci.item.id,
        quantity: ci.quantity,
        cost_price: ci.item.cost_price,
      }));

      const { error: itemsError } = await (supabase as any).from("supplier_return_items").insert(returnItems);
      if (itemsError) throw itemsError;

      // Because stock is global, if we were deducting stock we would need a function. 
      // For now, this is a ledger record for debit notes. 
      toast.success("Supplier return/debit note created successfully");
      setCart([]);
      setNotes("");
      setSupplierId("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden p-6">
      <div className="flex items-center gap-3 mb-6">
        <Undo2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Supplier Returns (Debit Notes)</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-6 h-full min-h-0">
        {/* Left Col: Items */}
        <div className="w-full md:w-1/2 flex flex-col gap-4 border border-border bg-card/60 p-4 rounded-xl min-h-0">
          <div>
            <label className="text-sm font-medium mb-1 block text-muted-foreground">Select Supplier</label>
            <select 
              value={supplierId} 
              onChange={e => { setSupplierId(e.target.value); setCart([]); }} 
              className="w-full p-2.5 rounded-lg bg-muted border border-border text-sm"
            >
              <option value="">Select supplier to load their items...</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items..." 
              className="w-full pl-9 pr-4 py-2 bg-muted border border-border rounded-lg text-sm"
              disabled={!supplierId}
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
            {!supplierId ? (
              <div className="text-center text-sm text-muted-foreground py-10">Please select a supplier to see their items.</div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-10">No items found for this supplier.</div>
            ) : (
              filteredItems.map(item => (
                <div key={item.id} className="flex justify-between items-center p-3 rounded-lg border border-border bg-card hover:bg-muted/30 cursor-pointer" onClick={() => addToCart(item)}>
                  <div>
                    <p className="font-semibold text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Stock: {item.stock} • Cost: ₹{item.cost_price || 0}</p>
                  </div>
                  <button className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Col: Transfer Summary */}
        <div className="w-full md:w-1/2 flex flex-col gap-4 border border-border bg-card/60 p-4 rounded-xl min-h-0">
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
            <h3 className="text-sm font-semibold mb-2">Items to Return</h3>
            {cart.map(ci => (
              <div key={ci.item.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{ci.item.name}</p>
                  <p className="text-xs text-muted-foreground">₹{ci.item.cost_price || 0} / unit</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
                    <button onClick={() => updateQuantity(ci.item.id, -1)} className="p-1 cursor-pointer hover:text-primary"><Minus className="h-3 w-3" /></button>
                    <span className="text-sm w-6 text-center font-medium">{ci.quantity}</span>
                    <button onClick={() => updateQuantity(ci.item.id, 1)} className="p-1 cursor-pointer hover:text-primary"><Plus className="h-3 w-3" /></button>
                  </div>
                  <div className="font-semibold text-sm min-w-[50px] text-right">
                    ₹{((ci.item.cost_price || 0) * ci.quantity).toFixed(2)}
                  </div>
                  <button onClick={() => removeItem(ci.item.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
            {cart.length === 0 && <div className="text-center text-xs text-muted-foreground py-10">No items selected.</div>}
          </div>

          <div className="shrink-0 space-y-3 pt-4 border-t border-border">
            <div className="flex justify-between items-center px-2">
              <span className="font-medium text-muted-foreground">Total Return Amount (Debit)</span>
              <span className="text-xl font-bold">₹{totalReturnAmount.toFixed(2)}</span>
            </div>
            <textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder="Reason for return, driver info, etc..." 
              className="w-full p-3 rounded-lg bg-muted border border-border text-sm resize-none h-20"
            />
            <button 
              onClick={submitReturn} 
              disabled={loading || cart.length === 0 || !supplierId}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {loading ? "Processing..." : "Confirm Return"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
