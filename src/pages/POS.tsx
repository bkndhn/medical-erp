import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { Search, Plus, Minus, Trash2, CreditCard, Keyboard, Pause, Play, Maximize, X, ShoppingCart, Pill, Percent, IndianRupee, RotateCcw, Printer, ScanBarcode, Wifi, WifiOff, User, MessageSquare, Phone, Undo2, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { usePOSShortcuts } from "@/hooks/usePOSShortcuts";
import { toast } from "sonner";
import { cacheItems, getCachedItems, cacheCategories, getCachedCategories, savePendingSale, getPendingSales, clearPendingSale } from "@/lib/indexedDB";
import { printReceipt, getPrinterConfig } from "@/lib/printService";

interface Item {
  id: string; name: string; sku: string | null; barcode: string | null;
  price: number; mrp: number; gst_rate: number | null; stock: number;
  category_id: string | null; unit: string | null; is_weighable: boolean | null;
  weight_per_unit: number | null; expiry_date: string | null; supplier_id: string | null;
  cost_price: number | null;
}

interface CartItem {
  item: Item; quantity: number; discount: number; total: number;
  isLoose?: boolean; loosePrice?: number;
}

interface PaymentLine { mode: string; amount: number; }
interface PaymentMethodConfig { code: string; name: string; icon: string; is_default?: boolean; }

const QUICK_QTYS = [1, 5, 10, 12, 20, 25, 50, 100];
const PACK_UNITS = ["strip", "box", "bottle", "pack", "dozen"];
const isPackUnit = (unit: string | null) => unit ? PACK_UNITS.includes(unit.toLowerCase()) : false;

const shortcutMap = [
  { key: 'F1', action: 'Search Products', category: 'Billing' },
  { key: 'F6', action: 'Hold Bill', category: 'Billing' },
  { key: 'F8', action: 'Reprint Past Bill', category: 'Billing' },
  { key: 'F9', action: 'Open Payment', category: 'Billing' },
  { key: 'F10', action: 'Delete Bill', category: 'Billing' },
  { key: 'F12', action: 'Print & Complete', category: 'Billing' },
  { key: 'Enter', action: 'Confirm Payment', category: 'Payment' },
  { key: '?', action: 'Shortcut Help', category: 'General' },
];

const MOBILE_SHORTCUTS = [
  { key: "F1", label: "Search", icon: "🔍", color: "bg-primary/15 text-primary" },
  { key: "F6", label: "Hold", icon: "⏸", color: "bg-accent/15 text-accent" },
  { key: "F8", label: "Reprint", icon: "🖨", color: "bg-muted text-muted-foreground" },
  { key: "F9", label: "Pay", icon: "💳", color: "bg-success/15 text-success" },
  { key: "F10", label: "Delete", icon: "🗑", color: "bg-destructive/15 text-destructive" },
  { key: "F12", label: "Complete", icon: "✅", color: "bg-primary/15 text-primary" },
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
  const [showQtyEdit, setShowQtyEdit] = useState<string | null>(null);
  const [qtyInput, setQtyInput] = useState("");
  const [billCount, setBillCount] = useState(0);
  const [showHeldBills, setShowHeldBills] = useState(false);
  const [heldBills, setHeldBills] = useState<any[]>([]);
  const [showReprint, setShowReprint] = useState(false);
  const [reprintSearchQuery, setReprintSearchQuery] = useState("");
  const [showDeleteBill, setShowDeleteBill] = useState(false);
  const [deleteDateFilter, setDeleteDateFilter] = useState("today");
  const [pastBills, setPastBills] = useState<any[]>([]);
  const [returnBill, setReturnBill] = useState<any>(null);
  const [showReturn, setShowReturn] = useState(false);
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [returnDateFilter, setReturnDateFilter] = useState("today");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSaving, setIsSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeBuffer = useRef("");
  const barcodeTimer = useRef<any>(null);

  const [paymentModes, setPaymentModes] = useState<PaymentMethodConfig[]>([]);
  const [defaultPaymentMode, setDefaultPaymentMode] = useState<string>("cash");
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([{ mode: "cash", amount: 0 }]);
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState<number>(0);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [whatsappShare, setWhatsappShare] = useState(() => localStorage.getItem("pos_whatsapp_share") === "true");

  const [showMobileShortcuts, setShowMobileShortcuts] = useState(false);

  // Screen wake lock
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch {}
    };
    requestWakeLock();
    const handleVisibility = () => { if (document.visibilityState === 'visible') requestWakeLock(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeLock?.release?.();
    };
  }, []);

  // Lock orientation
  useEffect(() => {
    try {
      (screen.orientation as any)?.lock?.('portrait').catch(() => {});
    } catch {}
  }, []);

  // Online/offline detection
  useEffect(() => {
    const goOnline = () => { setIsOnline(true); syncPendingSales(); };
    const goOffline = () => { setIsOnline(false); toast.warning("You're offline. Bills will sync when connected."); };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

  const syncPendingSales = useCallback(async () => {
    if (!tenantId) return;
    const pending = await getPendingSales();
    if (pending.length === 0) return;
    toast.info(`Syncing ${pending.length} offline bills...`);
    for (const sale of pending) {
      try {
        const { localId, cartItems, ...saleData } = sale;
        const { data: savedSale, error } = await supabase.from("sales").insert(saleData).select().single();
        if (error) throw error;
        if (cartItems) {
          const saleItems = cartItems.map((i: any) => ({ ...i, sale_id: savedSale.id }));
          await supabase.from("sale_items").insert(saleItems);
        }
        await clearPendingSale(localId);
      } catch (e) {
        console.error("Sync failed for sale:", e);
      }
    }
    toast.success("Offline bills synced!");
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const loadData = async () => {
      try {
        const [{ data: it }, { data: cat }, { count }, { data: pm }] = await Promise.all([
          supabase.from("items").select("*").eq("tenant_id", tenantId).eq("is_active", true).order("name"),
          supabase.from("categories").select("*").eq("tenant_id", tenantId).order("sort_order"),
          supabase.from("sales").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
          supabase.from("payment_methods").select("*").eq("tenant_id", tenantId).eq("is_active", true).order("sort_order"),
        ]);
        const itemsData = (it as unknown as Item[]) || [];
        const catsData = (cat as any) || [];
        setItems(itemsData);
        setCategories(catsData);
        setBillCount((count || 0) + 1);
        cacheItems(itemsData);
        cacheCategories(catsData);
        if (pm && pm.length > 0) {
          const modes = (pm as any).map((p: any) => ({ code: p.code, name: p.name, icon: p.icon, is_default: p.sort_order === 0 }));
          setPaymentModes(modes);
          const savedDefault = localStorage.getItem("pos_default_payment");
          const defaultMode = savedDefault && modes.find((m: any) => m.code === savedDefault) ? savedDefault : modes[0]?.code || "cash";
          setDefaultPaymentMode(defaultMode);
        } else {
          const fallback = [
            { code: "cash", name: "Cash", icon: "💵" },
            { code: "upi", name: "UPI", icon: "📱" },
            { code: "card", name: "Card", icon: "💳" },
            { code: "credit", name: "Credit", icon: "📋" },
          ];
          setPaymentModes(fallback);
          setDefaultPaymentMode("cash");
        }
        syncPendingSales();
      } catch {
        const cached = await getCachedItems();
        const cachedCats = await getCachedCategories();
        if (cached.length > 0) {
          setItems(cached as Item[]);
          setCategories(cachedCats);
          toast.info("Loaded cached items (offline mode)");
        }
      }
    };
    loadData();
  }, [tenantId]);

  const billNo = `INV-${String(billCount).padStart(4, "0")}`;

  // Barcode scanner handler
  useEffect(() => {
    const handleBarcodeScan = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if ((target.tagName === "INPUT" || target.tagName === "TEXTAREA") && target !== searchRef.current) return;
      if (e.key === "Enter" && barcodeBuffer.current.length >= 3) {
        e.preventDefault();
        const barcode = barcodeBuffer.current;
        barcodeBuffer.current = "";
        const item = items.find(i => i.barcode === barcode || i.sku === barcode);
        if (item) { addToCart(item); toast.success(`Scanned: ${item.name}`); }
        else { toast.error(`No item found for barcode: ${barcode}`); setSearchQuery(barcode); searchRef.current?.focus(); }
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        barcodeBuffer.current += e.key;
        clearTimeout(barcodeTimer.current);
        barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = ""; }, 100);
      }
    };
    window.addEventListener("keydown", handleBarcodeScan);
    return () => window.removeEventListener("keydown", handleBarcodeScan);
  }, [items]);

  const filteredProducts = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    let filtered = items.filter(i => !i.expiry_date || i.expiry_date >= today);
    if (activeCategory !== "all") filtered = filtered.filter(p => p.category_id === activeCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.barcode?.includes(q) || p.sku?.toLowerCase().includes(q));
    }
    return filtered;
  }, [items, activeCategory, searchQuery]);

  const expiredCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return items.filter(i => i.expiry_date && i.expiry_date < today).length;
  }, [items]);

  const nearExpiryCount = useMemo(() => {
    const today = new Date();
    const threshold = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    return items.filter(i => i.expiry_date && i.expiry_date >= todayStr && i.expiry_date <= threshold).length;
  }, [items]);

  const addToCart = (item: Item, loose = false) => {
    // Check stock
    const currentInCart = cart.filter(ci => ci.item.id === item.id).reduce((s, ci) => {
      if (ci.isLoose && item.weight_per_unit) return s + ci.quantity / item.weight_per_unit;
      return s + ci.quantity;
    }, 0);
    const availableStock = Number(item.stock) - currentInCart;
    const neededStock = loose && item.weight_per_unit ? 1 / item.weight_per_unit : 1;
    if (availableStock < neededStock) {
      toast.error(`No stock available for ${item.name}`);
      return;
    }

    const unitPrice = loose && item.weight_per_unit && item.weight_per_unit > 0
      ? Number(item.price) / item.weight_per_unit : Number(item.price);
    setCart(prev => {
      const existing = prev.find(i => (i.item.id === item.id && !!i.isLoose === loose));
      if (existing) {
        return prev.map(i => (i.item.id === item.id && !!i.isLoose === loose)
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * (i.loosePrice || Number(i.item.price)) - i.discount } : i);
      }
      return [...prev, { item, quantity: 1, discount: 0, total: unitPrice, isLoose: loose, loosePrice: loose ? unitPrice : undefined }];
    });
  };

  const getCartItemKey = (ci: CartItem) => `${ci.item.id}${ci.isLoose ? "_loose" : ""}`;

  const updateQty = (id: string, delta: number, isLoose?: boolean) => {
    setCart(prev => prev.map(i => {
      if (i.item.id !== id || !!i.isLoose !== !!isLoose) return i;
      const price = i.loosePrice || Number(i.item.price);
      const newQty = Math.max(1, i.quantity + delta);
      return { ...i, quantity: newQty, total: newQty * price - i.discount };
    }));
  };

  const setExactQty = (id: string, qty: number, isLoose?: boolean) => {
    if (qty <= 0) return;
    setCart(prev => prev.map(i => {
      if (i.item.id !== id || !!i.isLoose !== !!isLoose) return i;
      const price = i.loosePrice || Number(i.item.price);
      return { ...i, quantity: qty, total: qty * price - i.discount };
    }));
    setShowQtyEdit(null); setQtyInput("");
  };

  const removeItem = (id: string, isLoose?: boolean) => setCart(prev => prev.filter(i => !(i.item.id === id && !!i.isLoose === !!isLoose)));
  const clearCart = () => { setCart([]); setDiscountValue(0); setCustomerName(""); setCustomerPhone(""); };

  // Held bills
  const holdBill = async () => {
    if (cart.length === 0 || !tenantId) return;
    try {
      const { data: sale, error } = await supabase.from("sales").insert({
        tenant_id: tenantId, branch_id: branchId, cashier_id: user?.id,
        invoice_number: `HOLD-${Date.now().toString(36).toUpperCase()}`,
        subtotal, discount: billDiscount, tax_total: gstTotal, grand_total: roundedTotal,
        payment_mode: "cash" as any, amount_paid: 0, status: "held" as any,
      } as any).select().single();
      if (error) throw error;
      const saleItems = cart.map(i => ({
        sale_id: sale.id, item_id: i.item.id, item_name: i.isLoose ? `${i.item.name} (Loose)` : i.item.name,
        quantity: i.quantity, unit_price: i.loosePrice || Number(i.item.price), discount: i.discount,
        tax_amount: i.total * (Number(i.item.gst_rate) || 0) / 100, total: i.total,
      }));
      await supabase.from("sale_items").insert(saleItems as any);
      toast.success("Bill held"); setCart([]); setDiscountValue(0); fetchHeldBills();
    } catch (err: any) { toast.error(err.message); }
  };

  const fetchHeldBills = async () => {
    if (!tenantId) return;
    const { data } = await supabase.from("sales").select("*").eq("tenant_id", tenantId).eq("status", "held").order("created_at", { ascending: false });
    setHeldBills((data as any) || []);
  };

  const recallBill = async (heldSale: any) => {
    try {
      const { data: saleItems } = await supabase.from("sale_items").select("*").eq("sale_id", heldSale.id);
      if (saleItems && saleItems.length > 0) {
        const restoredCart: CartItem[] = saleItems.map((si: any) => {
          const item = items.find(i => i.id === si.item_id) || {
            id: si.item_id || "unknown", name: si.item_name, sku: null, barcode: null,
            price: si.unit_price, mrp: si.unit_price, gst_rate: 0, stock: 999,
            category_id: null, unit: null, is_weighable: null, weight_per_unit: null,
          } as Item;
          const isLoose = si.item_name?.includes("(Loose)");
          return { item, quantity: si.quantity, discount: si.discount || 0, total: si.total, isLoose, loosePrice: isLoose ? si.unit_price : undefined };
        });
        setCart(restoredCart);
        setDiscountValue(Number(heldSale.discount) || 0); setDiscountType("amount");
      }
      await supabase.from("sale_items").delete().eq("sale_id", heldSale.id);
      await supabase.from("sales").update({ status: "cancelled" as any } as any).eq("id", heldSale.id);
      toast.success("Bill recalled"); setShowHeldBills(false); fetchHeldBills();
    } catch (err: any) { toast.error(err.message); }
  };

  useEffect(() => { if (tenantId) fetchHeldBills(); }, [tenantId]);

  // Totals
  const subtotal = cart.reduce((sum, i) => sum + i.total, 0);
  const billDiscount = discountType === "percent" ? (subtotal * discountValue / 100) : discountValue;
  const afterDiscount = Math.max(0, subtotal - billDiscount);
  const gstTotal = cart.reduce((sum, i) => {
    const itemProportion = i.total / (subtotal || 1);
    return sum + (afterDiscount * itemProportion * (Number(i.item.gst_rate) || 0) / 100);
  }, 0);
  const grandTotalRaw = afterDiscount + gstTotal;
  const roundOff = Math.round(grandTotalRaw) - grandTotalRaw;
  const roundedTotal = Math.round(grandTotalRaw);
  const totalPaid = paymentLines.reduce((s, l) => s + l.amount, 0);
  const remaining = roundedTotal - totalPaid;

  const addPaymentLine = () => setPaymentLines(prev => [...prev, { mode: defaultPaymentMode, amount: 0 }]);
  const updatePaymentLine = (idx: number, field: keyof PaymentLine, value: any) => setPaymentLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  const removePaymentLine = (idx: number) => { if (paymentLines.length <= 1) return; setPaymentLines(prev => prev.filter((_, i) => i !== idx)); };
  const fillRemaining = (idx: number) => {
    const otherTotal = paymentLines.reduce((s, l, i) => i === idx ? s : s + l.amount, 0);
    updatePaymentLine(idx, "amount", Math.max(0, roundedTotal - otherTotal));
  };

  const openPayment = () => {
    setPaymentLines([{ mode: defaultPaymentMode, amount: roundedTotal }]);
    setShowPayment(true);
  };

  const autoSaveCustomer = async (saleId: string) => {
    if (!tenantId || (!customerName && !customerPhone)) return null;
    try {
      let customerId: string | null = null;
      if (customerPhone) {
        const { data: existing } = await supabase.from("customers").select("id").eq("tenant_id", tenantId).eq("phone", customerPhone).single();
        if (existing) customerId = existing.id;
      }
      if (!customerId && customerName) {
        const { data: newCust } = await supabase.from("customers").insert({
          tenant_id: tenantId, name: customerName, phone: customerPhone || null,
        } as any).select("id").single();
        customerId = newCust?.id || null;
      }
      if (customerId && saleId) {
        await supabase.from("sales").update({ customer_id: customerId } as any).eq("id", saleId);
      }
      return customerId;
    } catch { return null; }
  };

  const shareOnWhatsApp = (sale: any) => {
    if (!customerPhone) return;
    const biz = JSON.parse(localStorage.getItem("business_details") || "{}");
    const storeName = biz.storeName || "Store";
    const phone = customerPhone.startsWith("+") ? customerPhone.replace(/\D/g, "") : `91${customerPhone.replace(/\D/g, "")}`;
    const itemsText = cart.map(ci => `🔹 ${ci.isLoose ? ci.item.name + " (L)" : ci.item.name} x${ci.quantity} = ₹${ci.total.toFixed(0)}`).join("\n");
    let msg = `🧾 *${storeName}*\n`;
    if (biz.gstNumber) msg += `📋 GSTIN: ${biz.gstNumber}\n`;
    if (biz.phone) msg += `📞 ${biz.phone}\n`;
    msg += `\n🗓 ${new Date().toLocaleString()}\n📄 Bill: *${billNo}*\n\n${itemsText}\n\n`;
    if (billDiscount > 0) msg += `🏷 Discount: -₹${billDiscount.toFixed(0)}\n`;
    msg += `💰 *Total: ₹${roundedTotal}*\n💳 Payment: ${paymentLines.map(l => `₹${l.amount} ${l.mode.toUpperCase()}`).join(" + ")}\n\n${biz.tagline || "Thank you! 🙏"}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // INSTANT complete sale
  const completeSale = async () => {
    if (!tenantId || cart.length === 0 || isSaving) return;
    if (totalPaid < roundedTotal - 0.01) { toast.error(`Short by ₹${(roundedTotal - totalPaid).toFixed(2)}`); return; }
    setIsSaving(true);

    const isSplit = paymentLines.length > 1;
    const primaryMode = isSplit ? "split" : paymentLines[0].mode;
    const cashLine = paymentLines.find(l => l.mode === "cash");
    const changeAmount = cashLine ? Math.max(0, totalPaid - roundedTotal) : 0;

    const costTotal = cart.reduce((s, ci) => {
      const costPrice = Number(ci.item.cost_price || 0);
      const qty = ci.isLoose && ci.item.weight_per_unit ? ci.quantity / ci.item.weight_per_unit : ci.quantity;
      return s + costPrice * qty;
    }, 0);

    const saleData = {
      tenant_id: tenantId, branch_id: branchId, cashier_id: user?.id,
      invoice_number: billNo, subtotal, discount: billDiscount, tax_total: gstTotal,
      grand_total: roundedTotal, payment_mode: primaryMode as any,
      amount_paid: totalPaid, change_amount: changeAmount, status: "completed" as any,
      cost_total: Math.round(costTotal * 100) / 100,
      notes: customerName ? `Customer: ${customerName}${customerPhone ? ` (${customerPhone})` : ""}` : null,
    };

    const saleItemsData = cart.map(i => ({
      item_id: i.item.id, item_name: i.isLoose ? `${i.item.name} (Loose)` : i.item.name,
      quantity: i.quantity, unit_price: i.loosePrice || Number(i.item.price), discount: i.discount,
      tax_amount: i.total * (Number(i.item.gst_rate) || 0) / 100, total: i.total,
    }));

    const savedCart = [...cart];
    const savedBillNo = billNo;
    const savedCustomerPhone = customerPhone;
    const savedWhatsappShare = whatsappShare;

    // INSTANT: clear cart immediately
    setCart([]); setShowPayment(false); setDiscountValue(0);
    setBillCount(prev => prev + 1);
    setIsSaving(false);
    setShowCustomerForm(false);

    const modeStr = isSplit ? paymentLines.filter(l => l.amount > 0).map(l => `₹${l.amount} ${l.mode.toUpperCase()}`).join(" + ") : primaryMode.toUpperCase();
    toast.success(`${savedBillNo} • ₹${roundedTotal} via ${modeStr}`);

    // WhatsApp share
    if (savedWhatsappShare && savedCustomerPhone) {
      const biz = JSON.parse(localStorage.getItem("business_details") || "{}");
      const storeName = biz.storeName || "Store";
      const phone = savedCustomerPhone.startsWith("+") ? savedCustomerPhone.replace(/\D/g, "") : `91${savedCustomerPhone.replace(/\D/g, "")}`;
      const itemsText = savedCart.map(ci => `🔹 ${ci.isLoose ? ci.item.name + " (L)" : ci.item.name} x${ci.quantity} = ₹${ci.total.toFixed(0)}`).join("\n");
      let msg = `🧾 *${storeName}*\n`;
      if (biz.gstNumber) msg += `📋 GSTIN: ${biz.gstNumber}\n`;
      msg += `\n🗓 ${new Date().toLocaleString()}\n📄 *${savedBillNo}*\n\n${itemsText}\n\n💰 *Total: ₹${roundedTotal}*\n💳 ${modeStr}\n\n${biz.tagline || "Thank you! 🙏"}`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    }

    setCustomerName(""); setCustomerPhone("");

    // Background save
    try {
      if (!navigator.onLine) {
        await savePendingSale({ ...saleData, cartItems: saleItemsData });
        toast.info("Saved offline - will sync when connected");
        return;
      }

      const { data: sale, error } = await supabase.from("sales").insert(saleData as any).select().single();
      if (error) throw error;

      const itemsWithSaleId = saleItemsData.map(i => ({ ...i, sale_id: sale.id }));
      await supabase.from("sale_items").insert(itemsWithSaleId as any);

      // Stock deduction
      for (const ci of savedCart) {
        const stockReduction = ci.isLoose && ci.item.weight_per_unit && ci.item.weight_per_unit > 0
          ? ci.quantity / ci.item.weight_per_unit : ci.quantity;
        const newStock = Math.max(0, Number(ci.item.stock) - stockReduction);
        await supabase.from("items").update({ stock: parseFloat(newStock.toFixed(4)) } as any).eq("id", ci.item.id);
      }

      // Payment records
      for (const line of paymentLines.filter(l => l.amount > 0)) {
        await supabase.from("payments").insert({
          tenant_id: tenantId, branch_id: branchId, sale_id: sale.id,
          amount: line.amount, payment_mode: line.mode as any,
        } as any);
      }

      await autoSaveCustomer(sale.id);

      const config = getPrinterConfig();
      if (config.enabled && config.autoPrint) {
        printReceipt(sale, itemsWithSaleId);
      }

      const { data: it } = await supabase.from("items").select("*").eq("tenant_id", tenantId).eq("is_active", true).order("name");
      if (it) { setItems(it as unknown as Item[]); cacheItems(it); }
    } catch (err: any) {
      toast.error("Background save error: " + err.message);
    }
  };

  // Fetch past bills with date filter
  const fetchPastBills = async (forDelete = false, dateRange = "today") => {
    if (!tenantId) return;
    let query = supabase.from("sales").select("*").eq("tenant_id", tenantId).eq("status", "completed").order("created_at", { ascending: false });
    
    if (forDelete) {
      // Allow date range filter for delete
      const now = new Date();
      if (dateRange === "today") {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        query = query.gte("created_at", today.toISOString());
      } else if (dateRange === "yesterday") {
        const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(0, 0, 0, 0);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        query = query.gte("created_at", yesterday.toISOString()).lt("created_at", today.toISOString());
      } else if (dateRange === "week") {
        const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7); weekAgo.setHours(0, 0, 0, 0);
        query = query.gte("created_at", weekAgo.toISOString());
      }
    } else {
      // Reprint: only today's bills
      const today = new Date(); today.setHours(0, 0, 0, 0);
      query = query.gte("created_at", today.toISOString());
    }
    const { data } = await query;
    setPastBills((data as any) || []);
  };

  // Fetch bills for return with date filter
  const fetchReturnBills = async (dateRange = "today") => {
    if (!tenantId) return;
    let query = supabase.from("sales").select("*").eq("tenant_id", tenantId).eq("status", "completed").order("created_at", { ascending: false });
    const now = new Date();
    if (dateRange === "today") {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      query = query.gte("created_at", today.toISOString());
    } else if (dateRange === "yesterday") {
      const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(0, 0, 0, 0);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      query = query.gte("created_at", yesterday.toISOString()).lt("created_at", today.toISOString());
    } else if (dateRange === "week") {
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7); weekAgo.setHours(0, 0, 0, 0);
      query = query.gte("created_at", weekAgo.toISOString());
    } else if (dateRange === "month") {
      const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30); monthAgo.setHours(0, 0, 0, 0);
      query = query.gte("created_at", monthAgo.toISOString());
    } else {
      // all time - no filter
    }
    const { data } = await query;
    setPastBills((data as any) || []);
  };

  const reprintBill = async (sale: any) => {
    const { data: items } = await supabase.from("sale_items").select("*").eq("sale_id", sale.id);
    printReceipt(sale, items || []);
    setShowReprint(false);
  };

  // Sales Return
  const openReturn = async (sale: any) => {
    setReturnBill(sale);
    const { data } = await supabase.from("sale_items").select("*").eq("sale_id", sale.id);
    setReturnItems((data as any) || []);
    setReturnQtys({});
    setShowReturn(true);
    setShowReprint(false);
  };

  const processReturn = async () => {
    if (!returnBill || !tenantId) return;
    const returningItems = returnItems.filter(si => (returnQtys[si.id] || 0) > 0);
    if (returningItems.length === 0) { toast.error("Select items to return"); return; }

    try {
      let refundTotal = 0;
      for (const si of returningItems) {
        const qty = returnQtys[si.id];
        const refundAmt = (Number(si.unit_price) * qty);
        refundTotal += refundAmt;

        const item = items.find(i => i.id === si.item_id);
        if (item) {
          const isLoose = si.item_name?.includes("(Loose)");
          const stockAdd = isLoose && item.weight_per_unit ? qty / item.weight_per_unit : qty;
          await supabase.from("items").update({ stock: parseFloat((Number(item.stock) + stockAdd).toFixed(4)) } as any).eq("id", si.item_id);
        }
      }

      await supabase.from("sales").insert({
        tenant_id: tenantId, branch_id: branchId, cashier_id: user?.id,
        invoice_number: `RET-${Date.now().toString(36).toUpperCase()}`,
        subtotal: refundTotal, discount: 0, tax_total: 0, grand_total: refundTotal,
        payment_mode: returnBill.payment_mode as any, amount_paid: refundTotal,
        status: "refunded" as any,
        notes: `Return against ${returnBill.invoice_number}`,
        customer_id: returnBill.customer_id,
      } as any);

      toast.success(`Refund ₹${refundTotal.toFixed(0)} processed. Stock restored.`);
      setShowReturn(false); setReturnBill(null);

      const { data: it } = await supabase.from("items").select("*").eq("tenant_id", tenantId).eq("is_active", true).order("name");
      if (it) { setItems(it as unknown as Item[]); cacheItems(it); }
    } catch (err: any) { toast.error(err.message); }
  };

  const deleteTodayBill = async (sale: any) => {
    if (!confirm(`Delete bill ${sale.invoice_number}? This cannot be undone.`)) return;
    try {
      const { data: saleItems } = await supabase.from("sale_items").select("*").eq("sale_id", sale.id);
      if (saleItems) {
        for (const si of saleItems) {
          const item = items.find(i => i.id === si.item_id);
          if (item) {
            const isLoose = si.item_name?.includes("(Loose)");
            const stockRestored = isLoose && item.weight_per_unit ? si.quantity / item.weight_per_unit : si.quantity;
            await supabase.from("items").update({ stock: parseFloat((Number(item.stock) + stockRestored).toFixed(4)) } as any).eq("id", si.item_id);
          }
        }
      }
      await supabase.from("payments").delete().eq("sale_id", sale.id);
      await supabase.from("sales").update({ status: "cancelled" as any } as any).eq("id", sale.id);
      toast.success(`Bill ${sale.invoice_number} deleted`);
      fetchPastBills(true, deleteDateFilter);
      const { data: it } = await supabase.from("items").select("*").eq("tenant_id", tenantId).eq("is_active", true).order("name");
      if (it) { setItems(it as unknown as Item[]); cacheItems(it); }
    } catch (err: any) { toast.error(err.message); }
  };

  const handleMobileShortcut = (key: string) => {
    switch (key) {
      case "F1": searchRef.current?.focus(); break;
      case "F6": holdBill(); break;
      case "F8": fetchPastBills(); setShowReprint(true); break;
      case "F9": cart.length > 0 && openPayment(); break;
      case "F10": fetchPastBills(true, deleteDateFilter); setShowDeleteBill(true); break;
      case "F12": if (cart.length > 0 && !showPayment) openPayment(); else if (showPayment) completeSale(); break;
    }
    setShowMobileShortcuts(false);
  };

  usePOSShortcuts({
    enabled: true,
    onSearch: () => searchRef.current?.focus(),
    onPayment: () => cart.length > 0 && openPayment(),
    onHoldBill: () => holdBill(),
    onRecallBill: () => { fetchHeldBills(); setShowHeldBills(true); },
    onReprint: () => { fetchPastBills(); setShowReprint(true); },
    onHelp: () => setShowShortcuts(s => !s),
    onPrintComplete: () => { if (cart.length > 0 && !showPayment) openPayment(); else if (showPayment) completeSale(); },
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F10") { e.preventDefault(); fetchPastBills(true, deleteDateFilter); setShowDeleteBill(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tenantId, deleteDateFilter]);

  const displayStock = (item: Item) => {
    const stock = Number(item.stock);
    if (isPackUnit(item.unit) && item.weight_per_unit && item.weight_per_unit > 0) {
      const packs = Math.floor(stock);
      const looseUnits = Math.round((stock - packs) * item.weight_per_unit);
      if (looseUnits > 0) return `${packs}+${looseUnits}L`;
      return `${packs}`;
    }
    return `${stock % 1 === 0 ? stock : stock.toFixed(2)}`;
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      const item = items.find(i => i.barcode === searchQuery.trim() || i.sku === searchQuery.trim());
      if (item) { addToCart(item); toast.success(`Added: ${item.name}`); setSearchQuery(""); }
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-3 h-11 border-b border-border bg-card/50 backdrop-blur shrink-0">
        <div className="flex items-center gap-2 ml-10 md:ml-0">
          <h2 className="text-sm font-bold text-foreground">POS</h2>
          <span className="text-xs text-muted-foreground font-mono">{billNo}</span>
          {expiredCount > 0 && (
            <button onClick={() => window.location.href = '/reports'} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-destructive/10 text-destructive border border-destructive/20 animate-pulse">
              ⚠️{expiredCount}
            </button>
          )}
          {nearExpiryCount > 0 && (
            <button onClick={() => window.location.href = '/reports?tab=expiry'} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-accent/10 text-accent border border-accent/20">
              🕐{nearExpiryCount}
            </button>
          )}
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${isOnline ? "bg-success/10 text-success border border-success/20" : "bg-accent/10 text-accent border border-accent/20"}`}>
            {isOnline ? <><Wifi className="h-3 w-3 inline" /></> : <><WifiOff className="h-3 w-3 inline" /></>}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => { fetchPastBills(); setShowReprint(true); }} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Reprint (F8)"><Printer className="h-4 w-4" /></button>
          <button onClick={() => setShowMobileShortcuts(!showMobileShortcuts)} className="md:hidden p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Quick Actions"><Keyboard className="h-4 w-4" /></button>
          <button onClick={() => setShowShortcuts(true)} className="hidden md:block p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Shortcuts"><Keyboard className="h-4 w-4" /></button>
          <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Maximize className="h-4 w-4" /></button>
        </div>
      </header>

      {/* Mobile Quick Action Bar */}
      {showMobileShortcuts && (
        <div className="md:hidden flex gap-1.5 px-3 py-1.5 border-b border-border bg-card/30 overflow-x-auto scrollbar-thin shrink-0 animate-fade-in">
          {MOBILE_SHORTCUTS.map(s => (
            <button key={s.key} onClick={() => handleMobileShortcut(s.key)}
              className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-[9px] font-medium whitespace-nowrap ${s.color} border border-border/30 touch-manipulation min-w-[48px]`}>
              <span className="text-sm">{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Left: Products */}
        <div className="flex-1 flex flex-col overflow-hidden md:border-r border-border">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input ref={searchRef} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search or scan... (F1)"
                className="w-full pl-9 pr-10 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
              <ScanBarcode className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="flex gap-1 px-2 py-1.5 overflow-x-auto scrollbar-thin border-b border-border shrink-0">
            <button onClick={() => setActiveCategory("all")} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${activeCategory === "all" ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"}`}>📦 All</button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${activeCategory === cat.id ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"}`}>
                {cat.icon || "📁"} {cat.name}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
                {filteredProducts.map(item => {
                  const outOfStock = Number(item.stock) <= 0;
                  return (
                    <div key={item.id} className={`pos-grid-item text-left touch-manipulation p-2 ${outOfStock ? "opacity-50" : ""}`}>
                      <button onClick={() => { if (outOfStock) { toast.error("No stock!"); return; } addToCart(item); }} className="w-full text-left">
                        <p className="text-[11px] font-medium text-foreground line-clamp-2 leading-tight">{item.name}</p>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-primary">₹{Number(item.price)}</span>
                          {Number(item.mrp) > Number(item.price) && <span className="text-[9px] text-muted-foreground line-through">₹{Number(item.mrp)}</span>}
                        </div>
                        <span className={`text-[9px] ${outOfStock ? "text-destructive font-bold" : "text-muted-foreground"}`}>{outOfStock ? "No Stock" : displayStock(item)}</span>
                      </button>
                      {isPackUnit(item.unit) && item.weight_per_unit && item.weight_per_unit > 0 && !outOfStock && (
                        <button onClick={() => addToCart(item, true)}
                          className="w-full mt-0.5 flex items-center justify-center gap-0.5 py-0.5 rounded text-[9px] font-medium bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20 transition-all touch-manipulation">
                          L ₹{(Number(item.price) / item.weight_per_unit).toFixed(1)}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="hidden md:flex items-center gap-3 px-3 py-1.5 border-t border-border bg-card/30 text-[10px] text-muted-foreground shrink-0">
            {[["F1","Search"],["F6","Hold"],["F8","Reprint"],["F9","Pay"],["F10","Delete"],["F12","Complete"],["?","Help"]].map(([k,l]) => (
              <span key={k} className="flex items-center gap-1 whitespace-nowrap"><kbd className="kbd-shortcut">{k}</kbd>{l}</span>
            ))}
          </div>
        </div>

        {/* Right: Bill Panel */}
        <div className="w-full md:w-[360px] flex flex-col bg-card/30 shrink-0 border-t md:border-t-0 border-border max-h-[50vh] md:max-h-none">
          {/* Cart items */}
          <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-3 text-muted-foreground">
                <ShoppingCart className="h-6 w-6 mb-1 opacity-30" />
                <p className="text-xs">No items yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {cart.map(ci => (
                  <div key={getCartItemKey(ci)} className="px-2 py-1.5 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-foreground truncate">
                          {ci.item.name}
                          {ci.isLoose && <span className="ml-1 text-[8px] px-0.5 py-0 rounded bg-accent/10 text-accent">L</span>}
                        </p>
                        <p className="text-[9px] text-muted-foreground">₹{(ci.loosePrice || Number(ci.item.price)).toFixed(0)} × {ci.quantity}</p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => updateQty(ci.item.id, -1, ci.isLoose)} className="p-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground touch-manipulation"><Minus className="h-2.5 w-2.5" /></button>
                        <button onClick={() => { setShowQtyEdit(getCartItemKey(ci)); setQtyInput(String(ci.quantity)); }}
                          className="text-[11px] font-mono font-semibold text-foreground w-7 text-center py-0.5 rounded bg-muted/50 touch-manipulation">{ci.quantity}</button>
                        <button onClick={() => updateQty(ci.item.id, 1, ci.isLoose)} className="p-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground touch-manipulation"><Plus className="h-2.5 w-2.5" /></button>
                      </div>
                      <p className="text-[11px] font-semibold text-foreground whitespace-nowrap w-12 text-right">₹{ci.total.toFixed(0)}</p>
                      <button onClick={() => removeItem(ci.item.id, ci.isLoose)} className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive touch-manipulation"><Trash2 className="h-2.5 w-2.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals & Actions */}
          <div className="border-t border-border p-3 space-y-1.5 bg-card/50 shrink-0">
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Subtotal</span><span className="text-foreground">₹{subtotal.toFixed(0)}</span></div>
            {cart.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground shrink-0">Disc</span>
                <div className="flex items-center gap-1 flex-1">
                  <button onClick={() => setDiscountType(discountType === "amount" ? "percent" : "amount")} className="p-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground touch-manipulation">
                    {discountType === "percent" ? <Percent className="h-3 w-3" /> : <IndianRupee className="h-3 w-3" />}
                  </button>
                  <input type="number" value={discountValue || ""} onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)} placeholder="0"
                    className="w-14 px-1.5 py-0.5 rounded bg-muted border border-border text-xs text-foreground font-mono text-right focus:outline-none focus:ring-1 focus:ring-primary/50" />
                </div>
                {billDiscount > 0 && <span className="text-xs text-success font-medium">-₹{billDiscount.toFixed(0)}</span>}
              </div>
            )}
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">GST</span><span className="text-foreground">₹{gstTotal.toFixed(0)}</span></div>
            {Math.abs(roundOff) > 0.001 && (
              <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Round Off</span><span className="text-muted-foreground">{roundOff > 0 ? "+" : ""}₹{roundOff.toFixed(2)}</span></div>
            )}
            <div className="h-px bg-border" />
            <div className="flex justify-between text-base font-bold"><span className="text-foreground">Total</span><span className="text-gradient-primary">₹{roundedTotal}</span></div>

            {/* Items count */}
            <p className="text-[10px] text-muted-foreground text-center">{cart.length} items • {cart.reduce((s, c) => s + c.quantity, 0)} qty</p>

            <div className="grid grid-cols-4 gap-1.5 pt-1">
              <button onClick={holdBill} disabled={cart.length === 0} className="flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-medium bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-40 touch-manipulation">
                <Pause className="h-3 w-3" /> Hold
              </button>
              <button onClick={() => { fetchHeldBills(); setShowHeldBills(true); }} className="relative flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-medium bg-accent/10 text-accent hover:bg-accent/20 touch-manipulation">
                <Play className="h-3 w-3" /> Recall
                {heldBills.length > 0 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-accent text-[8px] text-accent-foreground flex items-center justify-center font-bold">{heldBills.length}</span>}
              </button>
              <button onClick={clearCart} disabled={cart.length === 0} className="flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-40 touch-manipulation">
                <X className="h-3 w-3" /> Clear
              </button>
              <button onClick={() => cart.length > 0 && openPayment()} disabled={cart.length === 0} className="flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 touch-manipulation">
                <CreditCard className="h-3 w-3" /> Pay
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Qty Edit Modal */}
      {showQtyEdit && (() => {
        const ci = cart.find(c => getCartItemKey(c) === showQtyEdit);
        const isLoose = ci?.isLoose;
        const itemId = ci?.item.id || showQtyEdit;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowQtyEdit(null)}>
            <div className="glass-card rounded-2xl p-5 w-full max-w-xs mx-4 animate-fade-in" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-bold text-foreground mb-3">Edit Quantity</h3>
              <input type="number" value={qtyInput} onChange={e => setQtyInput(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === "Enter") setExactQty(itemId, parseFloat(qtyInput) || 1, isLoose); }}
                className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground text-2xl font-mono text-center focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <div className="grid grid-cols-4 gap-2 mt-3">
                {QUICK_QTYS.map(q => (
                  <button key={q} onClick={() => setExactQty(itemId, q, isLoose)} className="py-2 rounded-lg text-sm font-medium bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary touch-manipulation">{q}</button>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setShowQtyEdit(null)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium">Cancel</button>
                <button onClick={() => setExactQty(itemId, parseFloat(qtyInput) || 1, isLoose)} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Set</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Payment Modal - Mobile responsive */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowPayment(false)}>
          <div className="glass-card rounded-t-2xl md:rounded-2xl p-4 w-full max-w-lg mx-0 md:mx-4 animate-fade-in max-h-[95vh] overflow-y-auto scrollbar-thin" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-foreground">Payment</h3>
              <button onClick={() => setShowPayment(false)} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <p className="text-2xl font-bold text-gradient-primary text-center my-3">₹{roundedTotal}</p>
            {billDiscount > 0 && <div className="text-center text-xs text-success mb-2">Discount: ₹{billDiscount.toFixed(0)}</div>}

            {/* Customer info */}
            <div className="flex gap-2 mb-3 p-2 rounded-lg bg-muted/30 border border-border/50">
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name" className="flex-1 px-2 py-1.5 rounded bg-muted border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
              <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone" className="w-24 px-2 py-1.5 rounded bg-muted border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>

            <div className="space-y-2 mb-3">
              {paymentLines.map((line, idx) => (
                <div key={idx} className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/30 border border-border/50">
                  <select value={line.mode} onChange={e => updatePaymentLine(idx, "mode", e.target.value)}
                    className="px-1.5 py-1.5 rounded-lg bg-muted border border-border text-xs text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 w-20">
                    {paymentModes.map(m => <option key={m.code} value={m.code}>{m.icon} {m.name}</option>)}
                  </select>
                  <div className="flex-1 relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₹</span>
                    <input type="number" value={line.amount || ""} onChange={e => updatePaymentLine(idx, "amount", parseFloat(e.target.value) || 0)}
                      onKeyDown={e => { if (e.key === "Enter") completeSale(); }}
                      autoFocus={idx === 0}
                      className="w-full pl-5 pr-2 py-1.5 rounded-lg bg-muted border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <button onClick={() => fillRemaining(idx)} className="px-1.5 py-1.5 rounded-lg text-[9px] font-medium bg-primary/10 text-primary hover:bg-primary/20 whitespace-nowrap touch-manipulation">Fill</button>
                  {paymentLines.length > 1 && <button onClick={() => removePaymentLine(idx)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive touch-manipulation"><X className="h-3 w-3" /></button>}
                </div>
              ))}
            </div>

            <button onClick={addPaymentLine} className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-all touch-manipulation mb-3">
              <Plus className="h-3 w-3" /> Split Payment
            </button>

            <div className="flex justify-between text-sm mb-1"><span className="text-muted-foreground">Paid</span><span className={`font-semibold ${totalPaid >= roundedTotal ? "text-success" : "text-destructive"}`}>₹{totalPaid.toFixed(0)}</span></div>
            {totalPaid > roundedTotal + 0.01 && <div className="flex justify-between text-sm mb-2"><span className="text-muted-foreground">Change</span><span className="font-semibold text-success">₹{(totalPaid - roundedTotal).toFixed(0)}</span></div>}

            {/* WhatsApp toggle */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/50 mb-3">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" /> WhatsApp</span>
              <button onClick={() => { setWhatsappShare(!whatsappShare); localStorage.setItem("pos_whatsapp_share", (!whatsappShare).toString()); }}
                className={`px-2.5 py-0.5 rounded text-[10px] font-medium ${whatsappShare ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                {whatsappShare ? "ON" : "OFF"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowPayment(false)} className="py-2.5 rounded-lg text-sm font-medium bg-muted text-muted-foreground touch-manipulation">Cancel</button>
              <button onClick={completeSale} disabled={totalPaid < roundedTotal - 0.01 || isSaving} className="py-2.5 rounded-lg text-sm font-medium bg-success text-success-foreground hover:bg-success/90 disabled:opacity-40 touch-manipulation">
                {isSaving ? "Saving..." : "Complete ₹" + roundedTotal}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reprint Past Bills Modal (F8) - Today only */}
      {showReprint && (() => {
        const filtered = pastBills.filter(b => !reprintSearchQuery || b.invoice_number?.toLowerCase().includes(reprintSearchQuery.toLowerCase()) || String(b.grand_total).includes(reprintSearchQuery));
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => { setReprintSearchQuery(""); setShowReprint(false); }}>
          <div className="glass-card rounded-2xl p-5 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto scrollbar-thin animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Reprint Bill (F8)</h3>
                <p className="text-[10px] text-muted-foreground">Today's bills only</p>
              </div>
              <button onClick={() => { setReprintSearchQuery(""); setShowReprint(false); }} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={reprintSearchQuery} onChange={e => setReprintSearchQuery(e.target.value)} placeholder="Search invoice or amount..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" autoFocus />
            </div>
            {filtered.length === 0 ? <p className="text-center text-muted-foreground py-8">{pastBills.length === 0 ? "No bills today" : "No matching bills"}</p> : (
              <div className="space-y-2">
                {filtered.map(bill => (
                  <div key={bill.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-foreground font-mono">{bill.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">{new Date(bill.created_at).toLocaleTimeString()} • ₹{Number(bill.grand_total).toFixed(0)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openReturn(bill)} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 touch-manipulation">
                        <Undo2 className="h-3 w-3" /> Return
                      </button>
                      <button onClick={() => reprintBill(bill)} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 touch-manipulation">
                        <Printer className="h-3 w-3" /> Print
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* Delete Bill Modal (F10) - with date filter */}
      {showDeleteBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowDeleteBill(false)}>
          <div className="glass-card rounded-2xl p-5 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto scrollbar-thin animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-foreground">Delete Bill (F10)</h3>
              <button onClick={() => setShowDeleteBill(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="flex gap-1.5 mb-3">
              {[["today","Today"],["yesterday","Yesterday"],["week","This Week"]].map(([val, label]) => (
                <button key={val} onClick={() => { setDeleteDateFilter(val); fetchPastBills(true, val); }}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${deleteDateFilter === val ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground"}`}>{label}</button>
              ))}
            </div>
            <p className="text-xs text-destructive mb-2">⚠️ Stock will be restored upon deletion.</p>
            <p className="text-xs text-muted-foreground mb-3">{pastBills.length} bills</p>
            {pastBills.length === 0 ? <p className="text-center text-muted-foreground py-8">No bills</p> : (
              <div className="space-y-2">
                {pastBills.map(bill => (
                  <div key={bill.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div>
                      <p className="text-sm font-medium text-foreground font-mono">{bill.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">{new Date(bill.created_at).toLocaleString()} • ₹{Number(bill.grand_total).toFixed(0)}</p>
                    </div>
                    <button onClick={() => deleteTodayBill(bill)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 touch-manipulation">
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
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

      {/* Held Bills Modal */}
      {showHeldBills && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowHeldBills(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto scrollbar-thin animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">Held Bills ({heldBills.length})</h3>
              <button onClick={() => setShowHeldBills(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            {heldBills.length === 0 ? <p className="text-center text-muted-foreground py-8">No held bills</p> : (
              <div className="space-y-2">
                {heldBills.map(hb => (
                  <div key={hb.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-foreground font-mono">{hb.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">{new Date(hb.created_at).toLocaleString()} • ₹{Number(hb.grand_total).toFixed(0)}</p>
                    </div>
                    <button onClick={() => recallBill(hb)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 touch-manipulation">
                      <Play className="h-3 w-3" /> Recall
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sales Return Modal */}
      {showReturn && returnBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowReturn(false)}>
          <div className="glass-card rounded-2xl p-5 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto scrollbar-thin animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Undo2 className="h-4 w-4 text-accent" /> Sales Return</h3>
                <p className="text-xs text-muted-foreground">Bill: {returnBill.invoice_number} • ₹{Number(returnBill.grand_total).toFixed(0)}</p>
              </div>
              <button onClick={() => setShowReturn(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Select items & qty to return.</p>
            <div className="space-y-2 mb-4">
              {returnItems.map(si => (
                <div key={si.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{si.item_name}</p>
                    <p className="text-xs text-muted-foreground">Sold: {si.quantity} × ₹{Number(si.unit_price).toFixed(0)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">Return:</label>
                    <input type="number" min={0} max={si.quantity} value={returnQtys[si.id] || ""} onChange={e => setReturnQtys(prev => ({ ...prev, [si.id]: Math.min(si.quantity, Math.max(0, parseFloat(e.target.value) || 0)) }))}
                      className="w-16 px-2 py-1.5 rounded bg-muted border border-border text-sm text-foreground font-mono text-center focus:outline-none focus:ring-1 focus:ring-accent/50" />
                  </div>
                </div>
              ))}
            </div>
            {(() => {
              const refundAmt = returnItems.reduce((s, si) => s + (Number(si.unit_price) * (returnQtys[si.id] || 0)), 0);
              return refundAmt > 0 ? (
                <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 mb-4">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Refund</span><span className="text-lg font-bold text-accent">₹{refundAmt.toFixed(0)}</span></div>
                </div>
              ) : null;
            })()}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowReturn(false)} className="py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium">Cancel</button>
              <button onClick={processReturn} className="py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 touch-manipulation">Process Return</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
