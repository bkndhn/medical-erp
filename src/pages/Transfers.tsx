import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, Minus, Send, ArrowLeftRight, X, Trash2, History, ChevronDown, ChevronRight, Package, Calendar, Building2, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import DateFilterExport, { exportToExcel } from "@/components/DateFilterExport";

interface Item {
  id: string;
  name: string;
  stock: number;
  branch_id: string | null;
  sku: string | null;
}

interface TransferCartItem {
  item: Item;
  quantity: number;
}

type TabType = "new" | "history";

export default function Transfers() {
  const { tenantId, activeBranchId, allBranches, isMultiBranchAdmin, branchId, user } = useAuth();

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<TabType>("new");

  // ── New Transfer state ─────────────────────────────────────────────────────
  const [items, setItems] = useState<Item[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [fromBranchId, setFromBranchId] = useState<string>("");
  const [toBranchId, setToBranchId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<TransferCartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // ── History state ──────────────────────────────────────────────────────────
  const [transfers, setTransfers] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedTransfer, setExpandedTransfer] = useState<string | null>(null);
  const [transferItemsMap, setTransferItemsMap] = useState<Record<string, any[]>>({});
  const [historyDateFrom, setHistoryDateFrom] = useState<Date | null>(null);
  const [historyDateTo, setHistoryDateTo] = useState<Date | null>(null);
  const [historyBranchFilter, setHistoryBranchFilter] = useState<string>("all");

  // The effective source branch for the new transfer form
  const effectiveFromBranch = isMultiBranchAdmin ? fromBranchId : (activeBranchId || branchId || "");

  useEffect(() => {
    if (!tenantId) return;
    const fetchDeps = async () => {
      const [{ data: branchData }] = await Promise.all([
        supabase.from("branches").select("id, name").eq("tenant_id", tenantId).order("name"),
      ]);
      setBranches(branchData || []);
      // Set default from-branch for admins
      if (isMultiBranchAdmin && activeBranchId) {
        setFromBranchId(activeBranchId);
      }
    };
    fetchDeps();
  }, [tenantId, activeBranchId]);

  // Load items scoped to the source branch
  useEffect(() => {
    if (!tenantId) return;
    const sourceBranch = isMultiBranchAdmin ? fromBranchId : effectiveFromBranch;
    if (!sourceBranch) { setItems([]); return; }

    supabase.from("items")
      .select("id, name, stock, branch_id, sku")
      .eq("tenant_id", tenantId)
      .eq("branch_id", sourceBranch)
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setItems(data || []));
  }, [tenantId, fromBranchId, effectiveFromBranch, isMultiBranchAdmin]);

  // Load transfer history
  const fetchHistory = async () => {
    if (!tenantId) return;
    setHistoryLoading(true);
    let q = (supabase as any).from("stock_transfers")
      .select("*, from_branch:branches!from_branch_id(id, name), to_branch:branches!to_branch_id(id, name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (historyDateFrom) q = q.gte("created_at", historyDateFrom.toISOString());
    if (historyDateTo) q = q.lte("created_at", historyDateTo.toISOString());
    if (historyBranchFilter !== "all") {
      q = q.or(`from_branch_id.eq.${historyBranchFilter},to_branch_id.eq.${historyBranchFilter}`);
    }

    const { data } = await q;
    setTransfers(data || []);
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (tab === "history") fetchHistory();
  }, [tab, tenantId, historyDateFrom, historyDateTo, historyBranchFilter]);

  const loadTransferItems = async (transferId: string) => {
    if (transferItemsMap[transferId]) {
      setExpandedTransfer(expandedTransfer === transferId ? null : transferId);
      return;
    }
    const { data } = await (supabase as any).from("stock_transfer_items")
      .select("*, item:items(name)")
      .eq("transfer_id", transferId);
    setTransferItemsMap(prev => ({ ...prev, [transferId]: data || [] }));
    setExpandedTransfer(expandedTransfer === transferId ? null : transferId);
  };

  const filteredItems = useMemo(() =>
    items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.sku?.toLowerCase().includes(searchQuery.toLowerCase())),
    [items, searchQuery]
  );

  const addToCart = (item: Item) => {
    setCart(prev => {
      const exists = prev.find(ci => ci.item.id === item.id);
      if (exists) {
        if (exists.quantity + 1 > item.stock) { toast.error("Cannot transfer more than available stock"); return prev; }
        return prev.map(ci => ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci);
      }
      if (item.stock < 1) { toast.error("Item out of stock"); return prev; }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(ci => {
      if (ci.item.id !== id) return ci;
      const newQty = Math.max(1, ci.quantity + delta);
      if (newQty > ci.item.stock) { toast.error("Cannot exceed available stock"); return ci; }
      return { ...ci, quantity: newQty };
    }));
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(ci => ci.item.id !== id));

  /**
   * Submit transfer — atomically:
   * 1. Create transfer record
   * 2. Create transfer_items records
   * 3. Deduct stock from source branch
   * 4. Add stock to destination branch (create item if not exists)
   */
  const submitTransfer = async () => {
    const srcBranch = isMultiBranchAdmin ? fromBranchId : effectiveFromBranch;
    if (!srcBranch) { toast.error("Select source branch"); return; }
    if (!toBranchId) { toast.error("Select destination branch"); return; }
    if (toBranchId === srcBranch) { toast.error("Source and destination cannot be the same branch"); return; }
    if (cart.length === 0) { toast.error("Add items to transfer"); return; }
    if (!tenantId || !user) { toast.error("Authentication error"); return; }

    setSaving(true);
    try {
      // 1. Create transfer header
      const { data: transfer, error: tErr } = await (supabase as any).from("stock_transfers").insert({
        tenant_id: tenantId,
        from_branch_id: srcBranch,
        to_branch_id: toBranchId,
        notes,
        transferred_by: user.id,
        status: "completed",
        reference_number: `TRF-${Date.now().toString(36).toUpperCase()}`,
      }).select().single();
      if (tErr) throw tErr;

      // 2. Create transfer item records
      const { error: tiErr } = await (supabase as any).from("stock_transfer_items").insert(
        cart.map(ci => ({ transfer_id: transfer.id, item_id: ci.item.id, quantity: ci.quantity }))
      );
      if (tiErr) throw tiErr;

      // 3 & 4. Update stock for each item
      for (const ci of cart) {
        // ── 3. Deduct from source branch ──────────────────────────────
        const currentStock = Number(ci.item.stock);
        const newSourceStock = Math.max(0, currentStock - ci.quantity);
        await supabase.from("items")
          .update({ stock: newSourceStock } as any)
          .eq("id", ci.item.id);

        // ── 4. Add to destination branch ──────────────────────────────
        // Look for matching item in destination branch (by sku if available, else by name+tenant)
        const matchQ = supabase.from("items")
          .select("id, stock")
          .eq("tenant_id", tenantId)
          .eq("branch_id", toBranchId)
          .eq("is_active", true);

        // Use SKU match if available
        const { data: destItems } = ci.item.sku
          ? await matchQ.eq("sku", ci.item.sku)
          : await matchQ.ilike("name", ci.item.name);

        if (destItems && destItems.length > 0) {
          // Update existing item in destination
          const destItem = destItems[0];
          await supabase.from("items")
            .update({ stock: Number(destItem.stock) + ci.quantity } as any)
            .eq("id", destItem.id);
        } else {
          // Clone item to destination branch
          const { data: srcItemFull } = await supabase.from("items")
            .select("*")
            .eq("id", ci.item.id)
            .single();

          if (srcItemFull) {
            const { id: _ignore, created_at: _ca, updated_at: _ua, ...cloneData } = srcItemFull as any;
            await supabase.from("items").insert({
              ...cloneData,
              branch_id: toBranchId,
              stock: ci.quantity,
            } as any);
          }
        }

        // Also transfer FEFO batches (optional — move quantity from oldest batch)
        // We simply update item_batches branch_id proportionally is complex;
        // Instead we create a transfer batch record in destination
        const { data: srcBatches } = await supabase.from("item_batches")
          .select("*")
          .eq("item_id", ci.item.id)
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .gt("quantity_remaining", 0)
          .order("expiry_date", { ascending: true, nullsFirst: false });

        if (srcBatches && srcBatches.length > 0) {
          let remaining = ci.quantity;
          for (const batch of srcBatches) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, Number(batch.quantity_remaining));
            // Reduce source batch quantity_in (triggers qty_remaining recalculation)
            await supabase.from("item_batches")
              .update({ quantity_in: Math.max(0, Number(batch.quantity_in) - take) } as any)
              .eq("id", batch.id);
            remaining -= take;
          }
        }
      }

      toast.success(`✅ Transfer completed! ${cart.length} item(s) moved to ${branches.find(b => b.id === toBranchId)?.name}`);
      setCart([]);
      setNotes("");
      setToBranchId("");
      // Refresh item stocks in the list
      setItems(prev => prev.map(i => {
        const ci = cart.find(c => c.item.id === i.id);
        if (!ci) return i;
        return { ...i, stock: Math.max(0, i.stock - ci.quantity) };
      }));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const srcBranchName = branches.find(b => b.id === (isMultiBranchAdmin ? fromBranchId : effectiveFromBranch))?.name;

  return (
    <div className="h-screen flex flex-col overflow-hidden pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2 ml-10 md:ml-0">
            <ArrowLeftRight className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Branch Transfers
          </h1>
        </div>
        <div className="flex gap-1.5 mt-3">
          {(["new", "history"] as TabType[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${tab === t ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"}`}>
              {t === "new" ? "➕ New Transfer" : "📋 Transfer History"}
            </button>
          ))}
        </div>
      </header>

      {/* ── NEW TRANSFER TAB ─────────────────────────────────────────────────── */}
      {tab === "new" && (
        <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 sm:p-6 overflow-hidden min-h-0">
          {/* Left: Item browser */}
          <div className="w-full md:w-1/2 flex flex-col gap-3 border border-border bg-card/60 p-4 rounded-xl min-h-0 overflow-hidden">
            {/* Source branch selector (admin only) */}
            {isMultiBranchAdmin && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">From Branch</label>
                <select value={fromBranchId} onChange={e => { setFromBranchId(e.target.value); setCart([]); }}
                  className="w-full p-2 rounded-lg bg-muted border border-border text-sm">
                  <option value="">Select source branch...</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            {!isMultiBranchAdmin && srcBranchName && (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-primary/5 border border-primary/20">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">From: {srcBranchName}</span>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search items to transfer..."
                className="w-full pl-9 pr-4 py-2 bg-muted border border-border rounded-lg text-sm" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin">
              {filteredItems.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-10">
                  {(isMultiBranchAdmin && !fromBranchId) ? "Select a source branch to see items" : "No items found"}
                </div>
              )}
              {filteredItems.map(item => (
                <div key={item.id}
                  className="flex justify-between items-center p-3 rounded-lg border border-border bg-card hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => addToCart(item)}>
                  <div>
                    <p className="font-medium text-sm text-foreground">{item.name}</p>
                    <p className={`text-xs ${item.stock === 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      Stock: <span className="font-semibold">{item.stock}</span>
                    </p>
                  </div>
                  <button className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Cart + destination */}
          <div className="w-full md:w-1/2 flex flex-col gap-3 border border-border bg-card/60 p-4 rounded-xl min-h-0 overflow-hidden">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Destination Branch</label>
              <select value={toBranchId} onChange={e => setToBranchId(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-muted border border-border text-sm">
                <option value="">Select destination...</option>
                {branches
                  .filter(b => b.id !== (isMultiBranchAdmin ? fromBranchId : effectiveFromBranch))
                  .map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin">
              <h3 className="text-sm font-semibold text-foreground">Items to Transfer ({cart.length})</h3>
              {cart.length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-10 border-2 border-dashed border-border rounded-xl">
                  Click items on the left to add them
                </div>
              )}
              {cart.map(ci => (
                <div key={ci.item.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate text-foreground">{ci.item.name}</p>
                    <p className="text-xs text-muted-foreground">Available: {ci.item.stock}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
                      <button onClick={() => updateQuantity(ci.item.id, -1)} className="p-1 cursor-pointer hover:text-primary"><Minus className="h-3 w-3" /></button>
                      <span className="text-sm w-7 text-center font-bold">{ci.quantity}</span>
                      <button onClick={() => updateQuantity(ci.item.id, 1)} className="p-1 cursor-pointer hover:text-primary"><Plus className="h-3 w-3" /></button>
                    </div>
                    <button onClick={() => removeFromCart(ci.item.id)} className="p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="shrink-0 space-y-3 pt-2 border-t border-border/50">
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes..."
                className="w-full p-3 rounded-lg bg-muted border border-border text-sm resize-none h-16" />
              {cart.length > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>{cart.length} items</span>
                  <span>Total units: {cart.reduce((s, c) => s + c.quantity, 0)}</span>
                </div>
              )}
              <button onClick={submitTransfer}
                disabled={saving || cart.length === 0 || !toBranchId || (isMultiBranchAdmin && !fromBranchId)}
                className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 transition-colors">
                <Send className="h-4 w-4" />
                {saving ? "Processing..." : "Complete Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ──────────────────────────────────────────────────────── */}
      {tab === "history" && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4 items-center">
            <DateFilterExport
              onFilter={(from, to) => { setHistoryDateFrom(from); setHistoryDateTo(to); }}
              onExportExcel={() => exportToExcel(transfers.map(t => ({
                Reference: t.reference_number,
                Date: new Date(t.created_at).toLocaleString(),
                From: t.from_branch?.name || "—",
                To: t.to_branch?.name || "—",
                Status: t.status,
                Notes: t.notes || "",
              })), "transfer-history")}
              defaultPreset="last7"
            />
            {branches.length > 0 && (
              <select value={historyBranchFilter} onChange={e => setHistoryBranchFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground">
                <option value="all">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>

          {historyLoading ? (
            <div className="text-center text-muted-foreground py-12">Loading history...</div>
          ) : transfers.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 flex flex-col items-center gap-3">
              <History className="h-10 w-10 opacity-20" />
              <p>No transfers found for the selected period</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transfers.map(t => (
                <div key={t.id} className="glass-card rounded-xl overflow-hidden">
                  <button
                    onClick={() => loadTransferItems(t.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                        <ArrowLeftRight className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-bold text-primary">{t.reference_number}</p>
                        <p className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                          <span className="text-muted-foreground">{t.from_branch?.name ?? "—"}</span>
                          <ArrowLeftRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-foreground font-semibold">{t.to_branch?.name ?? "—"}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                          <Clock className="h-3 w-3" />{new Date(t.created_at).toLocaleDateString()}
                        </p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium mt-0.5 ${t.status === "completed" ? "bg-success/10 text-success" : "bg-accent/10 text-accent"}`}>
                          {t.status === "completed" ? <CheckCircle className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                          {t.status}
                        </span>
                      </div>
                      {expandedTransfer === t.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Expanded item details */}
                  {expandedTransfer === t.id && (
                    <div className="border-t border-border px-4 pb-4 pt-3 bg-muted/10">
                      {t.notes && <p className="text-xs text-muted-foreground italic mb-3">📝 {t.notes}</p>}
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-border">
                          <th className="text-left py-1.5 text-xs text-muted-foreground">Item</th>
                          <th className="text-right py-1.5 text-xs text-muted-foreground">Quantity</th>
                        </tr></thead>
                        <tbody>
                          {(transferItemsMap[t.id] || []).map((ti: any, i: number) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="py-1.5 text-foreground flex items-center gap-1.5">
                                <Package className="h-3 w-3 text-muted-foreground" />
                                {ti.item?.name ?? ti.item_id}
                              </td>
                              <td className="py-1.5 text-right font-semibold text-primary">{ti.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
