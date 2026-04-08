import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, Minus, Send, Navigation, X, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Item {
  id: string;
  name: string;
  stock: number;
}

interface TransferCartItem {
  item: Item;
  quantity: number;
}

export default function Transfers() {
  const { tenantId, branchId, user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [toBranchId, setToBranchId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<TransferCartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const fetchDependencies = async () => {
      const [{ data: itemsData }, { data: branchesData }] = await Promise.all([
        supabase.from("items").select("id, name, stock").eq("tenant_id", tenantId).eq("is_active", true),
        supabase.from("branches").select("id, name").eq("tenant_id", tenantId),
      ]);
      setItems(itemsData || []);
      setBranches(branchesData || []);
    };
    fetchDependencies();
  }, [tenantId]);

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const addToCart = (item: Item) => {
    setCart(prev => {
      const exists = prev.find(ci => ci.item.id === item.id);
      if (exists) {
        if (exists.quantity + 1 > item.stock) {
          toast.error("Cannot transfer more than available stock");
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
        toast.error("Cannot transfer more than available stock");
        return ci;
      }
      return { ...ci, quantity: newQty };
    }));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(ci => ci.item.id !== id));
  };

  const submitTransfer = async () => {
    if (!toBranchId) { toast.error("Select destination branch"); return; }
    if (toBranchId === branchId) { toast.error("Cannot transfer to the same branch"); return; }
    if (cart.length === 0) { toast.error("Add items to transfer"); return; }
    if (!tenantId || !branchId || !user) { toast.error("Missing credentials needed for transfer"); return; }

    setLoading(true);
    try {
      const { data: transfer, error } = await (supabase as any).from("stock_transfers").insert({
        tenant_id: tenantId,
        from_branch_id: branchId,
        to_branch_id: toBranchId,
        notes,
        transferred_by: user.id,
        reference_number: `TRF-${Date.now().toString(36).toUpperCase()}`
      } as any).select().single();

      if (error) throw error;

      const transferItems = cart.map(ci => ({
        transfer_id: transfer.id,
        item_id: ci.item.id,
        quantity: ci.quantity,
      }));

      const { error: itemsError } = await (supabase as any).from("stock_transfer_items").insert(transferItems);
      if (itemsError) throw itemsError;

      toast.success("Transfer recorded successfully");
      setCart([]);
      setNotes("");
      setToBranchId("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden p-6">
      <div className="flex items-center gap-3 mb-6">
        <Navigation className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Branch Transfers</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-6 h-full min-h-0">
        {/* Left Col: Items */}
        <div className="w-full md:w-1/2 flex flex-col gap-4 border border-border bg-card/60 p-4 rounded-xl min-h-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items to transfer..." 
              className="w-full pl-9 pr-4 py-2 bg-muted border border-border rounded-lg text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
            {filteredItems.map(item => (
              <div key={item.id} className="flex justify-between items-center p-3 rounded-lg border border-border bg-card hover:bg-muted/30 cursor-pointer" onClick={() => addToCart(item)}>
                <div>
                  <p className="font-semibold text-sm">{item.name}</p>
                  <p className="text-xs text-muted-foreground">Stock: {item.stock}</p>
                </div>
                <button className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            ))}
            {filteredItems.length === 0 && <div className="text-center text-sm text-muted-foreground py-10">No items match your search.</div>}
          </div>
        </div>

        {/* Right Col: Transfer Summary */}
        <div className="w-full md:w-1/2 flex flex-col gap-4 border border-border bg-card/60 p-4 rounded-xl min-h-0">
          <div>
            <label className="text-sm font-medium mb-1 block text-muted-foreground">Destination Branch</label>
            <select 
              value={toBranchId} 
              onChange={e => setToBranchId(e.target.value)} 
              className="w-full p-2.5 rounded-lg bg-muted border border-border text-sm"
            >
              <option value="">Select branch...</option>
              {branches.filter(b => b.id !== branchId).map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
            <h3 className="text-sm font-semibold mb-2">Items to Transfer</h3>
            {cart.map(ci => (
              <div key={ci.item.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{ci.item.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
                    <button onClick={() => updateQuantity(ci.item.id, -1)} className="p-1 cursor-pointer hover:text-primary"><Minus className="h-3 w-3" /></button>
                    <span className="text-sm w-6 text-center font-medium">{ci.quantity}</span>
                    <button onClick={() => updateQuantity(ci.item.id, 1)} className="p-1 cursor-pointer hover:text-primary"><Plus className="h-3 w-3" /></button>
                  </div>
                  <button onClick={() => removeItem(ci.item.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
            {cart.length === 0 && <div className="text-center text-xs text-muted-foreground py-10">No items added to transfer.</div>}
          </div>

          <div className="shrink-0 space-y-3 pt-2 border-t border-border/50">
            <textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder="Optional notes for this transfer..." 
              className="w-full p-3 rounded-lg bg-muted border border-border text-sm resize-none h-20"
            />
            <button 
              onClick={submitTransfer} 
              disabled={loading || cart.length === 0 || !toBranchId}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {loading ? "Processing..." : "Complete Transfer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
