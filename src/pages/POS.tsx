import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { Search, Plus, Minus, Trash2, CreditCard, Keyboard, Pause, Play, Maximize, X, ShoppingCart, Pill, Percent, IndianRupee, RotateCcw, Printer, ScanBarcode, Wifi, WifiOff, User, MessageSquare, Phone, Undo2, Calendar, ClipboardList, MapPin, Camera, Upload, AlertCircle, FileText, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { usePOSShortcuts } from "@/hooks/usePOSShortcuts";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { toast } from "sonner";
import { cacheItems, getCachedItems, cacheCategories, getCachedCategories, savePendingSale, getPendingSales, clearPendingSale, getCachedBranchDetails } from "@/lib/indexedDB";
import { getPrinterConfig, printReceipt } from "@/lib/printService";
import { useReactToPrint } from "react-to-print";
import { Receipt } from "@/components/Receipt";

interface Item {
  id: string; name: string; sku: string | null; barcode: string | null;
  price: number; mrp: number; gst_rate: number | null; stock: number;
  category_id: string | null; unit: string | null; is_weighable: boolean | null;
  weight_per_unit: number | null; expiry_date: string | null; supplier_id: string | null;
  cost_price: number | null; composition: string | null; rack_location: string | null;
  is_schedule_h: boolean | null;
}

interface CartItem {
  item: Item; quantity: number; discount: number; total: number;
  isLoose?: boolean; loosePrice?: number;
  // FEFO batch info (auto-filled from item_batches)
  batchId?: string; batchNumber?: string; batchExpiry?: string; batchPrice?: number; batchPurchasePrice?: number;
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
  { key: 'R', action: 'Process Return', category: 'Billing' },
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
  const { tenantId, branchId, activeBranchId, allBranches, user, hasRole } = useAuth();
  const activeBranchName = activeBranchId ? allBranches.find(b => b.id === activeBranchId)?.name : null;
  const currentBranchDetails = allBranches.find(b => b.id === (activeBranchId || branchId));
  const isAdmin = hasRole("super_admin") || hasRole("admin");
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

  const [customerRewardPoints, setCustomerRewardPoints] = useState(0);
  const [useRewardPoints, setUseRewardPoints] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  // Shift & Loyalty
  const [activeShift, setActiveShift] = useState<any>(null);
  const [checkingShift, setCheckingShift] = useState(true);
  const [tenantSettings, setTenantSettings] = useState<any>(null);

  // Rx Prescription state
  const [rxDoctorName, setRxDoctorName] = useState("");
  const [rxImageUrl, setRxImageUrl] = useState<string | null>(null);
  const [rxUploading, setRxUploading] = useState(false);
  const [rxCamActive, setRxCamActive] = useState(false);
  const rxVideoRef = useRef<HTMLVideoElement>(null);
  const rxCanvasRef = useRef<HTMLCanvasElement>(null);
  const rxFileRef = useRef<HTMLInputElement>(null);

  const receiptRef = useRef<HTMLDivElement>(null);
  const [lastSaleForPrint, setLastSaleForPrint] = useState<{sale: any, items: any[], customerInfo?: any} | null>(null);

  // Batch Selection State
  const [showBatchSelect, setShowBatchSelect] = useState(false);
  const [batchesForSelection, setBatchesForSelection] = useState<any[]>([]);
  const [pendingItemForBatch, setPendingItemForBatch] = useState<{ item: Item, loose: boolean } | null>(null);

  // Returns State
  const [returnRefundMode, setReturnRefundMode] = useState<string>("cash");

  const handleReactPrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: "Receipt",
    onAfterPrint: () => setLastSaleForPrint(null)
  });

  useEffect(() => {
    if (lastSaleForPrint) {
      setTimeout(() => handleReactPrint(), 100);
    }
  }, [lastSaleForPrint, handleReactPrint]);

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

  // Configure Global Barcode Scanner
  useBarcodeScanner({
    onScan: (barcode) => {
      // Find item
      const item = items.find(i => 
        (i.barcode && i.barcode.toLowerCase() === barcode.toLowerCase()) || 
        (i.sku && i.sku.toLowerCase() === barcode.toLowerCase())
      );
      
      if (item && Number(item.stock) > 0) {
        addToCart(item);
        toast.success(`Scanned: ${item.name}`, { duration: 1000 });
        // Optional: Trigger a tiny beep if browser allows
        try {
          const ctx = new window.AudioContext();
          const osc = ctx.createOscillator();
          osc.type = 'sine'; osc.frequency.setValueAtTime(800, ctx.currentTime);
          osc.connect(ctx.destination);
          osc.start(); osc.stop(ctx.currentTime + 0.1);
        } catch (e) {}
      } else if (item && Number(item.stock) <= 0) {
        toast.error(`Out of stock: ${item.name}`);
      } else {
        toast.error(`Barcode not found: ${barcode}`);
      }
    }
  });

  // Lock orientation to portrait — multi-strategy for cross-browser support
  useEffect(() => {
    const lockPortrait = async () => {
      try {
        // Strategy 1: Modern Screen Orientation API (Chrome Android, Firefox)
        if (screen.orientation && typeof (screen.orientation as any).lock === 'function') {
          await (screen.orientation as any).lock('portrait');
          return;
        }
      } catch { /* API exists but denied — try fallbacks */ }

      try {
        // Strategy 2: Legacy webkit API (older Android browsers)
        const so = screen as any;
        const lockFn =
          so.lockOrientation ||
          so.mozLockOrientation ||
          so.msLockOrientation ||
          so.webkitLockOrientation;
        if (lockFn) lockFn.call(screen, 'portrait-primary');
      } catch { /* Silently ignore — CSS fallback handles the rest */ }
    };

    lockPortrait();

    // Re-attempt on every orientation change (device rotate)
    const handleOrientationChange = () => { lockPortrait(); };
    window.addEventListener('orientationchange', handleOrientationChange);
    screen.orientation?.addEventListener?.('change', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      screen.orientation?.removeEventListener?.('change', handleOrientationChange);
      // Release lock on unmount
      try { (screen.orientation as any)?.unlock?.(); } catch { }
    };
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
        // Build items query — scope to active branch if set
        let itemsQuery = supabase.from("items").select("*").eq("tenant_id", tenantId).eq("is_active", true).order("name");
        if (activeBranchId) itemsQuery = itemsQuery.eq("branch_id", activeBranchId);

        // Build sales count query — scope to active branch if set
        let salesCountQuery = supabase.from("sales").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
        if (activeBranchId) salesCountQuery = salesCountQuery.eq("branch_id", activeBranchId);

        const [{ data: it }, { data: cat }, { count }, { data: pm }, { data: shift }, { data: settings }] = await Promise.all([
          itemsQuery,
          supabase.from("categories").select("*").eq("tenant_id", tenantId).order("sort_order"),
          salesCountQuery,
          supabase.from("payment_methods").select("*").eq("tenant_id", tenantId).eq("is_active", true).order("sort_order"),
          supabase.from("shifts").select("*").eq("tenant_id", tenantId).eq("user_id", user?.id).eq("status", "open").maybeSingle(),
          supabase.from("tenant_settings").select("*").eq("tenant_id", tenantId).maybeSingle()
        ]);
        const itemsData = (it as unknown as Item[]) || [];
        const catsData = (cat as any) || [];
        setActiveShift(shift || null);
        setTenantSettings(settings || null);
        setCheckingShift(false);
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
          setActiveShift({ status: "open", offline: true }); // permit billing if offline
          setCheckingShift(false);
          toast.info("Loaded cached items (offline mode)");
        }
      }
    };
    loadData();
  }, [tenantId, user, activeBranchId]);

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
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.barcode?.includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.composition?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [items, activeCategory, searchQuery]);

  // Salt/composition-based substitute suggestions (shown when search yields no results)
  const substituteProducts = useMemo(() => {
    if (!searchQuery || filteredProducts.length > 0) return [];
    const q = searchQuery.toLowerCase();
    const today = new Date().toISOString().split('T')[0];
    // Find items whose name matches but composition matches something in stock
    const matchedCompositions = items
      .filter(i => i.composition && i.name.toLowerCase().includes(q))
      .map(i => i.composition!.toLowerCase());
    if (matchedCompositions.length === 0) return [];
    return items.filter(i =>
      i.composition &&
      matchedCompositions.some(c => i.composition!.toLowerCase().includes(c) || c.includes(i.composition!.toLowerCase())) &&
      Number(i.stock) > 0 &&
      (!i.expiry_date || i.expiry_date >= today)
    );
  }, [items, searchQuery, filteredProducts]);

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



  const addToCart = useCallback(async (item: Item, loose = false) => {
    const currentInCart = cart.filter(ci => ci.item.id === item.id).reduce((s, ci) => {
      if (ci.isLoose && item.weight_per_unit && item.weight_per_unit > 0) return s + ci.quantity / item.weight_per_unit;
      return s + ci.quantity;
    }, 0);
    const availableStock = Number(item.stock) - currentInCart;
    const neededStock = loose && item.weight_per_unit && item.weight_per_unit > 0 ? 1 / item.weight_per_unit : 1;
    if (availableStock < neededStock - 0.0001) {
      toast.error(`Only ${Number(item.stock)} in stock for ${item.name}`);
      return;
    }

    // ── FEFO batch selection ───────────────────────────────────────────────
    // Query batches ordered by expiry ASC (First Expired First Out)
    let batchId: string | undefined;
    let batchNumber: string | undefined;
    let batchExpiry: string | undefined;
    let batchPrice: number | undefined;
    let batchPurchasePrice: number | undefined;

    if (tenantId && isOnline) {
      try {
        let batchQuery = supabase
          .from("item_batches")
          .select("id, batch_number, expiry_date, selling_price, purchase_price, quantity_remaining")
          .eq("item_id", item.id)
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .gt("quantity_remaining", 0)
          .order("expiry_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true });
        if (activeBranchId) batchQuery = (batchQuery as any).eq("branch_id", activeBranchId);
        const { data: batches } = await batchQuery;

        if (batches && batches.length > 1) {
          // INTERCEPT: Multiple batches found, show selector
          setBatchesForSelection(batches);
          setPendingItemForBatch({ item, loose });
          setShowBatchSelect(true);
          return;
        }

        if (batches && batches.length === 1) {
          const b = batches[0];
          batchId = b.id;
          batchNumber = b.batch_number || undefined;
          batchExpiry = b.expiry_date || undefined;
          batchPrice = Number(b.selling_price) || undefined;
          batchPurchasePrice = Number(b.purchase_price) || undefined;

          // Warn if batch expiring in <= 30 days
          if (batchExpiry) {
            const daysLeft = Math.ceil((new Date(batchExpiry).getTime() - Date.now()) / 86400000);
            if (daysLeft <= 30 && daysLeft > 0) {
              toast.warning(`⚠️ ${item.name}: batch expires in ${daysLeft} days`);
            }
          }
        }
      } catch { /* fall back to item price silently */ }
    }

    const unitPrice = batchPrice
      ? (loose && item.weight_per_unit && item.weight_per_unit > 0 ? batchPrice / item.weight_per_unit : batchPrice)
      : (loose && item.weight_per_unit && item.weight_per_unit > 0 ? Number(item.price) / item.weight_per_unit : Number(item.price));

    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id && !!i.isLoose === loose && i.batchId === batchId);
      if (existing) {
        return prev.map(i =>
          (i.item.id === item.id && !!i.isLoose === loose && i.batchId === batchId)
            ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * (i.loosePrice || i.batchPrice || Number(i.item.price)) - i.discount }
            : i
        );
      }
      return [...prev, {
        item, quantity: 1, discount: 0, total: unitPrice,
        isLoose: loose, loosePrice: loose ? unitPrice : undefined,
        batchId, batchNumber, batchExpiry, batchPrice, batchPurchasePrice,
      }];
    });
  }, [cart, tenantId, isOnline, activeBranchId]);

  const selectSpecificBatch = (batch: any) => {
    if (!pendingItemForBatch) return;
    const { item, loose } = pendingItemForBatch;
    const unitPrice = Number(batch.selling_price) || Number(item.price);
    const finalPrice = loose && item.weight_per_unit && item.weight_per_unit > 0 ? unitPrice / item.weight_per_unit : unitPrice;

    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id && !!i.isLoose === loose && i.batchId === batch.id);
      if (existing) {
        return prev.map(i =>
          (i.item.id === item.id && !!i.isLoose === loose && i.batchId === batch.id)
            ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * finalPrice - i.discount }
            : i
        );
      }
      return [...prev, {
        item, quantity: 1, discount: 0, total: finalPrice,
        isLoose: loose, loosePrice: loose ? finalPrice : undefined,
        batchId: batch.id, batchNumber: batch.batch_number, batchExpiry: batch.expiry_date,
        batchPrice: Number(batch.selling_price), batchPurchasePrice: Number(batch.purchase_price),
      }];
    });
    setShowBatchSelect(false);
    setPendingItemForBatch(null);
  };

  const getCartItemKey = useCallback((ci: CartItem) => `${ci.item.id}${ci.isLoose ? "_loose" : ""}`, []);

  const updateQty = useCallback((id: string, delta: number, isLoose?: boolean) => {
    setCart(prev => prev.map(i => {
      if (i.item.id !== id || !!i.isLoose !== !!isLoose) return i;
      const price = i.loosePrice || Number(i.item.price);
      const newQty = Math.max(1, i.quantity + delta);

      if (delta > 0) {
        // Stock check: sum all other cart lines for this item
        const otherConsumed = prev.filter(ci => ci !== i && ci.item.id === id).reduce((s, ci) => {
          if (ci.isLoose && i.item.weight_per_unit && i.item.weight_per_unit > 0)
            return s + ci.quantity / i.item.weight_per_unit;
          return s + ci.quantity;
        }, 0);
        // Convert newQty to pack units if this is a loose line
        const newQtyInPacks = (isLoose && i.item.weight_per_unit && i.item.weight_per_unit > 0)
          ? newQty / i.item.weight_per_unit
          : newQty;
        const totalConsumed = otherConsumed + newQtyInPacks;
        if (totalConsumed > Number(i.item.stock) + 0.0001) {
          toast.error(`Only ${Number(i.item.stock)} in stock for ${i.item.name}`);
          return i; // don't update
        }
      }

      return { ...i, quantity: newQty, total: newQty * price - i.discount };
    }));
  }, []);

  const setExactQty = useCallback((id: string, qty: number, isLoose?: boolean) => {
    if (qty <= 0) return;
    setCart(prev => {
      const targetLine = prev.find(i => i.item.id === id && !!i.isLoose === !!isLoose);
      if (!targetLine) return prev;

      // Convert qty into pack units for stock comparison
      const qtyInPacks = (isLoose && targetLine.item.weight_per_unit && targetLine.item.weight_per_unit > 0)
        ? qty / targetLine.item.weight_per_unit
        : qty;

      // Other cart lines for same item
      const otherConsumed = prev.filter(i => i !== targetLine && i.item.id === id).reduce((s, ci) => {
        if (ci.isLoose && targetLine.item.weight_per_unit && targetLine.item.weight_per_unit > 0)
          return s + ci.quantity / targetLine.item.weight_per_unit;
        return s + ci.quantity;
      }, 0);

      const totalConsumed = otherConsumed + qtyInPacks;
      const maxStock = Number(targetLine.item.stock);
      if (totalConsumed > maxStock + 0.0001) {
        const maxAllowedPacks = maxStock - otherConsumed;
        const maxAllowedQty = (isLoose && targetLine.item.weight_per_unit && targetLine.item.weight_per_unit > 0)
          ? Math.floor(maxAllowedPacks * targetLine.item.weight_per_unit)
          : Math.floor(maxAllowedPacks);
        toast.error(`Only ${maxStock} in stock. Max you can add: ${Math.max(0, maxAllowedQty)}`);
        return prev; // don't update
      }

      return prev.map(i => {
        if (i.item.id !== id || !!i.isLoose !== !!isLoose) return i;
        const price = i.loosePrice || Number(i.item.price);
        return { ...i, quantity: qty, total: qty * price - i.discount };
      });
    });
    setShowQtyEdit(null); setQtyInput("");
  }, []);

  const removeItem = useCallback((id: string, isLoose?: boolean) => setCart(prev => prev.filter(i => !(i.item.id === id && !!i.isLoose === !!isLoose))), []);
  const clearCart = useCallback(() => { setCart([]); setDiscountValue(0); setCustomerName(""); setCustomerPhone(""); }, []);

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
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase.from("sales").select("*")
      .eq("tenant_id", tenantId).eq("status", "held")
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false });
    setHeldBills((data as any) || []);
  };

  // Auto-delete held bills older than today (non-blocking cleanup)
  const cleanupOldHeldBills = async () => {
    if (!tenantId) return;
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      // Fetch old held bills
      const { data: old } = await supabase.from("sales").select("id")
        .eq("tenant_id", tenantId).eq("status", "held")
        .lt("created_at", todayStart.toISOString());
      if (old && old.length > 0) {
        const ids = (old as any[]).map(r => r.id);
        // Delete sale items first, then the sales
        await supabase.from("sale_items").delete().in("sale_id", ids);
        await supabase.from("sales").delete().in("id", ids);
      }
    } catch { /* silent — non-critical cleanup */ }
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

  useEffect(() => { if (tenantId) { fetchHeldBills(); cleanupOldHeldBills(); } }, [tenantId]);

  // Totals
  const subtotal = cart.reduce((sum, i) => sum + i.total, 0);
  const billDiscount = discountType === "percent" ? (subtotal * discountValue / 100) : discountValue;
  const afterDiscount = Math.max(0, subtotal - billDiscount);

  const loyaltyMaxRupeeValue = tenantSettings?.loyalty_enabled && tenantSettings?.rupees_per_point 
    ? (customerRewardPoints * Number(tenantSettings.rupees_per_point)) : 0;
  const loyaltyDiscount = useRewardPoints ? Math.min(loyaltyMaxRupeeValue, afterDiscount) : 0;
  const loyaltyPointsConsumed = useRewardPoints && tenantSettings?.rupees_per_point
    ? Number((loyaltyDiscount / Number(tenantSettings.rupees_per_point)).toFixed(2)) : 0;
  const afterLoyaltyDiscount = Math.max(0, afterDiscount - loyaltyDiscount);

  const gstTotal = cart.reduce((sum, i) => {
    const itemProportion = i.total / (subtotal || 1);
    return sum + (afterLoyaltyDiscount * itemProportion * (Number(i.item.gst_rate) || 0) / 100);
  }, 0);
  const grandTotalRaw = afterLoyaltyDiscount + gstTotal;
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

  const checkCustomerLoyalty = async () => {
    if (!tenantId || !customerPhone || customerPhone.length < 10) return;
    const { data } = await supabase.from("customers").select("id, name, reward_points")
      .eq("tenant_id", tenantId).eq("phone", customerPhone).single();
      
    if (data) {
      setCustomerId(data.id);
      setCustomerName(data.name);
      setCustomerRewardPoints(Number(data.reward_points) || 0);
    } else {
      setCustomerId(null);
      setCustomerRewardPoints(0);
      setUseRewardPoints(false);
    }
  };

  // ─── getBizDetails: reads branch info from IndexedDB first, falls back to localStorage ───
  const getBizDetails = async (): Promise<Record<string, string>> => {
    // 1. Try localStorage (set by Settings page)
    const lsRaw = localStorage.getItem("business_details");
    if (lsRaw) {
      try { return JSON.parse(lsRaw); } catch { /* fall through */ }
    }
    // 2. Try IndexedDB encrypted branch record (works offline for multi-branch)
    const bid = activeBranchId || branchId;
    const tid = tenantId;
    if (bid && tid) {
      const cached = await getCachedBranchDetails(bid, tid);
      if (cached) {
        // Normalise branch record fields to the shape Settings uses
        return {
          storeName: cached.name || "",
          phone: cached.phone || "",
          gstNumber: cached.gst_number || "",
          address: cached.address || "",
          tagline: cached.tagline || "",
          drugLicense: cached.drug_license || "",
          email: cached.email || "",
        };
      }
    }
    return {};
  };

  const autoSaveCustomer = async (saleId: string) => {
    if (!tenantId || (!customerName && !customerPhone)) return null;
    try {
      let resolvedId = customerId;
      if (!resolvedId && customerPhone) {
        const { data: existing } = await supabase.from("customers").select("id").eq("tenant_id", tenantId).eq("phone", customerPhone).single();
        if (existing) resolvedId = existing.id;
      }
      if (!resolvedId && customerName) {
        const { data: newCust } = await supabase.from("customers").insert({
          tenant_id: tenantId, name: customerName, phone: customerPhone || null,
        } as any).select("id").single();
        resolvedId = newCust?.id || null;
      }
      if (resolvedId && saleId) {
        await supabase.from("sales").update({ customer_id: resolvedId } as any).eq("id", saleId);
      }
      return resolvedId;
    } catch { return null; }
  };

  const shareOnWhatsApp = async (sale: any) => {
    if (!customerPhone) return;
    const biz = await getBizDetails();
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


  // Rx helpers
  const hasScheduleH = useMemo(() => cart.some(ci => ci.item.is_schedule_h), [cart]);

  const startRxCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (rxVideoRef.current) { rxVideoRef.current.srcObject = stream; rxVideoRef.current.play(); }
      setRxCamActive(true);
    } catch { toast.error("Camera not available — use file upload instead"); }
  };

  const captureRxPhoto = () => {
    if (!rxVideoRef.current || !rxCanvasRef.current) return;
    const video = rxVideoRef.current;
    const canvas = rxCanvasRef.current;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setRxImageUrl(dataUrl);
    // Stop camera stream
    (video.srcObject as MediaStream)?.getTracks().forEach(t => t.stop());
    video.srcObject = null;
    setRxCamActive(false);
  };

  const uploadRxFile = async (file: File) => {
    setRxUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (e) => setRxImageUrl(e.target?.result as string);
      reader.readAsDataURL(file);
    } finally { setRxUploading(false); }
  };

  const stopRxCamera = () => {
    if (rxVideoRef.current) {
      (rxVideoRef.current.srcObject as MediaStream)?.getTracks().forEach(t => t.stop());
      rxVideoRef.current.srcObject = null;
    }
    setRxCamActive(false);
  };

  // INSTANT complete sale
  const completeSale = async () => {
    if (!tenantId || cart.length === 0 || isSaving) return;
    if (totalPaid < roundedTotal - 0.01) { toast.error(`Short by ₹${(roundedTotal - totalPaid).toFixed(2)}`); return; }
    // Rx required check for Schedule H
    if (hasScheduleH && !rxImageUrl && !rxDoctorName) {
      toast.error("⚕️ Schedule H drug in cart — please attach prescription or enter doctor name");
      return;
    }
    // Customer name validation (if entered, must be > 3 chars)
    if (customerName && customerName.trim().length < 3) {
      toast.error("Customer name must be at least 3 characters"); return;
    }
    // Phone validation: 10 digits, starts with 6–9 (Indian mobile)
    if (customerPhone) {
      const ph = customerPhone.replace(/\D/g, "");
      if (!/^[6-9]\d{9}$/.test(ph)) {
        toast.error("Enter a valid 10-digit mobile number starting with 6–9"); return;
      }
    }
    setIsSaving(true);

    const isSplit = paymentLines.length > 1;
    const primaryMode = isSplit ? "split" : paymentLines[0].mode;
    const cashLine = paymentLines.find(l => l.mode === "cash");
    const changeAmount = cashLine ? Math.max(0, totalPaid - roundedTotal) : 0;

    const costTotal = cart.reduce((s, ci) => {
      const costPrice = Number(ci.batchPurchasePrice ?? ci.item.cost_price ?? 0);
      const qty = ci.isLoose && ci.item.weight_per_unit ? ci.quantity / ci.item.weight_per_unit : ci.quantity;
      return s + costPrice * qty;
    }, 0);

    // Upload Rx image to Supabase Storage if base64
    let finalRxUrl = rxImageUrl;
    if (rxImageUrl && rxImageUrl.startsWith('data:')) {
      try {
        const base64 = rxImageUrl.split(',')[1];
        const byteArray = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const fileName = `rx_${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('prescriptions')
          .upload(fileName, byteArray, { contentType: 'image/jpeg' });
        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from('prescriptions').getPublicUrl(uploadData.path);
          finalRxUrl = urlData.publicUrl;
        }
      } catch { /* keep base64 as fallback */ }
    }

    // Compute Reward Points Earned logic if tenant setting enabled
    const pointsEarned = tenantSettings?.loyalty_enabled && tenantSettings?.points_per_rupee
      ? Number((roundedTotal * Number(tenantSettings.points_per_rupee)).toFixed(2)) : 0;

    const saleData = {
      tenant_id: tenantId, branch_id: branchId, cashier_id: user?.id,
      invoice_number: billNo, subtotal: parseFloat(subtotal.toFixed(4)), discount: parseFloat((billDiscount + loyaltyDiscount).toFixed(4)), tax_total: parseFloat(gstTotal.toFixed(4)),
      grand_total: roundedTotal, payment_mode: primaryMode as any,
      amount_paid: totalPaid, change_amount: changeAmount, status: "completed" as any,
      cost_total: Math.round(costTotal * 100) / 100,
      notes: customerName ? `Customer: ${customerName}${customerPhone ? ` (${customerPhone})` : ""}` : null,
      rx_image_url: finalRxUrl || null,
      doctor_name: rxDoctorName || null,
      rx_required: hasScheduleH,
      reward_points_used: loyaltyPointsConsumed,
      reward_points_earned: pointsEarned,
    };

    const saleItemsData = cart.map(i => ({
      item_id: i.item.id, item_name: i.isLoose ? `${i.item.name} (Loose)` : i.item.name,
      quantity: i.quantity, unit_price: i.batchPrice || i.loosePrice || Number(i.item.price),
      discount: i.discount,
      tax_amount: i.total * (Number(i.item.gst_rate) || 0) / 100, total: i.total,
      batch_id: i.batchId || null,
      batch_number: i.batchNumber || null,
      expiry_date: i.batchExpiry || null,
    }));

    const savedCart = [...cart];
    const savedBillNo = billNo;
    const savedCustomerPhone = customerPhone;
    const savedCustomerName = customerName;
    const savedWhatsappShare = whatsappShare;

    // INSTANT: clear cart immediately
    setCart([]); setShowPayment(false); setDiscountValue(0);
    setBillCount(prev => prev + 1);
    setIsSaving(false);
    setShowCustomerForm(false);
    setRxDoctorName(""); setRxImageUrl(null); stopRxCamera();

    const modeStr = isSplit ? paymentLines.filter(l => l.amount > 0).map(l => `₹${l.amount} ${l.mode.toUpperCase()}`).join(" + ") : primaryMode.toUpperCase();
    toast.success(`${savedBillNo} • ₹${roundedTotal} via ${modeStr}`);

    // WhatsApp share
    if (savedWhatsappShare && savedCustomerPhone) {
      const biz = await getBizDetails();
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

      // ── FEFO Batch deduction from item_batches ─────────────────────────────
      for (const ci of savedCart) {
        let remaining = ci.isLoose && ci.item.weight_per_unit && ci.item.weight_per_unit > 0
          ? ci.quantity / ci.item.weight_per_unit : ci.quantity;

        if (ci.batchId) {
          // Exact batch known from cart → use atomic RPC for accuracy
          const { error: rpcErr } = await supabase.rpc("increment_batch_sold", { batch_id: ci.batchId, qty: remaining });
          if (rpcErr) {
            // Fallback: read-then-write manual update
            const { data: b } = await supabase
              .from("item_batches")
              .select("quantity_sold")
              .eq("id", ci.batchId)
              .single();
            if (b) {
              await supabase.from("item_batches")
                .update({ quantity_sold: Number(b.quantity_sold) + remaining } as any)
                .eq("id", ci.batchId);
            }
          }
        } else {
          // No batch in cart → FEFO cascade
          const { data: batches } = await supabase
            .from("item_batches")
            .select("id, quantity_sold, quantity_remaining")
            .eq("item_id", ci.item.id)
            .eq("tenant_id", tenantId)
            .eq("is_active", true)
            .gt("quantity_remaining", 0)
            .order("expiry_date", { ascending: true, nullsFirst: false })
            .order("created_at", { ascending: true });

          if (batches) {
            for (const b of batches) {
              if (remaining <= 0.0001) break;
              const avail = Number(b.quantity_remaining);
              const deduct = Math.min(remaining, avail);
              await supabase
                .from("item_batches")
                .update({ quantity_sold: Number(b.quantity_sold) + deduct } as any)
                .eq("id", b.id);
              remaining -= deduct;
            }
          }
        }

        // Also deduct from items.stock (aggregate)
        const deducted = ci.isLoose && ci.item.weight_per_unit && ci.item.weight_per_unit > 0
          ? ci.quantity / ci.item.weight_per_unit : ci.quantity;
        const newStock = Math.max(0, Number(ci.item.stock) - deducted);
        await supabase.from("items").update({ stock: parseFloat(newStock.toFixed(4)) } as any).eq("id", ci.item.id);
      }

      // Payment records
      for (const line of paymentLines.filter(l => l.amount > 0)) {
        await supabase.from("payments").insert({
          tenant_id: tenantId, branch_id: branchId, sale_id: sale.id,
          amount: line.amount, payment_mode: line.mode as any,
        } as any);
      }

      const resolvedCustId = await autoSaveCustomer(sale.id);

      if (resolvedCustId && (loyaltyPointsConsumed > 0 || pointsEarned > 0)) {
        await supabase.rpc('update_customer_reward_points', {
          p_customer_id: resolvedCustId,
          p_points_used: loyaltyPointsConsumed,
          p_points_earned: pointsEarned
        });
      }

      const config = getPrinterConfig();
      if (config.enabled && config.autoPrint) {
        if (config.type === "usb") {
          printReceipt(sale, itemsWithSaleId, savedCustomerName, { name: savedCustomerName, phone: savedCustomerPhone }, currentBranchDetails);
        } else {
          setLastSaleForPrint({ sale, items: itemsWithSaleId, customerInfo: { name: savedCustomerName, phone: savedCustomerPhone } });
        }
      }

      // Update stock locally for sold items (avoids expensive full re-fetch)
      setItems(prev => {
        const updated = prev.map(item => {
          const cartLine = savedCart.find(ci => ci.item.id === item.id);
          if (!cartLine) return item;
          const deducted = cartLine.isLoose && cartLine.item.weight_per_unit && cartLine.item.weight_per_unit > 0
            ? cartLine.quantity / cartLine.item.weight_per_unit
            : cartLine.quantity;
          return { ...item, stock: parseFloat(Math.max(0, Number(item.stock) - deducted).toFixed(4)) };
        });
        cacheItems(updated);
        return updated;
      });
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
    const config = getPrinterConfig();
    if (config.type === "usb") {
      printReceipt(sale, items || [], undefined, undefined, currentBranchDetails);
    } else {
      setLastSaleForPrint({ sale, items: items || [] });
    }
    setShowReprint(false);
  };

  // Sales Return
  const openReturn = async (sale: any) => {
    setReturnBill(sale);
    const { data } = await supabase.from("sale_items").select("*").eq("sale_id", sale.id);
    setReturnItems((data as any) || []);
    setReturnQtys({});
    // Default refund mode to the original sale's payment mode
    setReturnRefundMode(sale.payment_mode || "cash");
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
          
          if (si.batch_id) {
            // Restore batch stock by decrementing sold quantity
            try {
              const { error: rpcReturnErr } = await supabase.rpc("increment_batch_sold", { batch_id: si.batch_id, qty: -stockAdd });
              if (rpcReturnErr) throw rpcReturnErr;
            } catch {
              // Fallback: manual decrement
              const { data: batchData } = await supabase.from("item_batches").select("quantity_sold").eq("id", si.batch_id).single();
              if (batchData) {
                await supabase.from("item_batches").update({ quantity_sold: Math.max(0, Number(batchData.quantity_sold) - stockAdd) } as any).eq("id", si.batch_id);
              }
            }
          }
        }
      }

      // Record return sale with cashier-selected refund mode
      await supabase.from("sales").insert({
        tenant_id: tenantId, branch_id: branchId, cashier_id: user?.id,
        invoice_number: `RET-${returnBill.invoice_number}-${Date.now().toString(36).toUpperCase()}`,
        subtotal: refundTotal, discount: 0, tax_total: 0, grand_total: refundTotal,
        payment_mode: returnRefundMode as any, amount_paid: refundTotal,
        status: "refunded" as any,
        notes: `Return against ${returnBill.invoice_number}`,
        customer_id: returnBill.customer_id,
        customer_name: returnBill.customer_name,
      } as any);

      toast.success(`Refund ₹${refundTotal.toFixed(0)} via ${returnRefundMode.toUpperCase()} processed. Stock restored.`);
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
            
            if (si.batch_id) {
              // Restore batch stock by decrementing sold quantity
              try {
                const { error: rpcDeleteErr } = await supabase.rpc("increment_batch_sold", { batch_id: si.batch_id, qty: -stockRestored });
                if (rpcDeleteErr) throw rpcDeleteErr;
              } catch {
                // Fallback: manual decrement
                const { data: batchDataDel } = await supabase.from("item_batches").select("quantity_sold").eq("id", si.batch_id).single();
                if (batchDataDel) {
                  await supabase.from("item_batches").update({ quantity_sold: Math.max(0, Number(batchDataDel.quantity_sold) - stockRestored) } as any).eq("id", si.batch_id);
                }
              }
            }
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
      case "F10": if (isAdmin) { fetchPastBills(true, deleteDateFilter); setShowDeleteBill(true); } else { toast.error("Only admins can delete bills"); } break;
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
      if (e.key === "F10") { e.preventDefault(); if (isAdmin) { fetchPastBills(true, deleteDateFilter); setShowDeleteBill(true); } else { toast.error("Only admins can delete bills"); } }
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

  const logToShortageBook = async (itemName: string) => {
    if (!tenantId || !itemName.trim()) return;
    try {
      const { error } = await supabase.from("shortage_book").insert([{
        tenant_id: tenantId,
        item_name: itemName.trim(),
        requested_quantity: "1",
        priority: "high",
        status: "pending",
        notes: "Logged from POS - item not found during billing",
      }]);
      if (error) throw error;
      toast.success(`"${itemName}" logged to Shortage Book!`);
      setSearchQuery("");
    } catch (err: any) {
      toast.error("Failed to log shortage: " + err.message);
    }
  };

  const cashRegKey = tenantId ? `cash_register_enabled_${tenantId}` : "cash_register_enabled";
  const cashRegEnabled = localStorage.getItem(cashRegKey) !== "false";

  if (cashRegEnabled && !checkingShift && !activeShift) {
    return (
      <div className="h-screen py-16 flex items-start justify-center bg-background/50 p-4">
        <div className="glass-card max-w-md w-full p-8 rounded-3xl text-center space-y-6 animate-in slide-in-from-bottom-4 duration-500 mt-20">
          <div className="h-20 w-20 bg-muted mx-auto rounded-full flex items-center justify-center">
             <AlertTriangle className="h-10 w-10 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Shift Closed</h2>
            <p className="text-muted-foreground">You must open a shift to start billing and accept payments.</p>
          </div>
          <Link to="/cash-register" className="inline-block w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all text-lg shadow-lg">
            Open Cash Register
          </Link>
        </div>
      </div>
    );
  }

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

      {/* Offline Status Bar */}
      {!isOnline && (
        <div className="bg-accent text-accent-foreground px-3 py-1.5 text-xs font-medium flex items-center justify-center gap-2 shrink-0 animate-fade-in z-40 relative">
          <WifiOff className="h-3.5 w-3.5" />
          You are currently offline. Working securely. Bills will auto-sync when connected.
        </div>
      )}

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
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-4">
                <Search className="h-8 w-8 opacity-20" />
                <p className="text-sm font-medium">{searchQuery ? `No results for "${searchQuery}"` : 'No products found'}</p>

                {/* Salt/Composition Substitute Suggestions (Feature 2) */}
                {substituteProducts.length > 0 && (
                  <div className="w-full max-w-md">
                    <div className="flex items-center gap-2 mb-2 px-2">
                      <Pill className="h-3.5 w-3.5 text-primary" />
                      <p className="text-xs font-semibold text-primary">Available substitutes (same salt):</p>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 px-2">
                      {substituteProducts.map(item => (
                        <button key={item.id}
                          onClick={() => { addToCart(item); setSearchQuery(""); }}
                          className="flex flex-col items-start p-2.5 rounded-lg bg-primary/8 border border-primary/20 hover:bg-primary/15 transition-all touch-manipulation text-left">
                          <p className="text-[12px] font-semibold text-foreground line-clamp-2 leading-tight">{item.name}</p>
                          <p className="text-[10px] text-primary font-medium mt-0.5">₹{Number(item.price)}</p>
                          <p className="text-[9px] text-muted-foreground">{item.composition}</p>
                          <p className="text-[9px] text-success">{Number(item.stock)} in stock</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {searchQuery && (
                  <button
                    onClick={() => logToShortageBook(searchQuery)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 border border-accent/20 text-accent text-xs font-medium hover:bg-accent/20 transition-colors touch-manipulation"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    Log "{searchQuery}" to Shortage Book
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
                {filteredProducts.map(item => {
                  const outOfStock = Number(item.stock) <= 0;
                  // How much of this item is already in cart (in pack units)
                  const inCartPacks = cart.filter(ci => ci.item.id === item.id).reduce((s, ci) => {
                    if (ci.isLoose && item.weight_per_unit && item.weight_per_unit > 0)
                      return s + ci.quantity / item.weight_per_unit;
                    return s + ci.quantity;
                  }, 0);
                  const fullyInCart = inCartPacks >= Number(item.stock) - 0.0001 && Number(item.stock) > 0;
                  const stockLabel = outOfStock ? "No Stock" : fullyInCart ? "All in Cart" : displayStock(item);
                  const stockColor = outOfStock || fullyInCart ? "text-destructive font-bold" : "text-muted-foreground";
                  const cardDisabled = outOfStock || fullyInCart;

                  return (
                    <div key={item.id} className={`pos-grid-item text-left touch-manipulation p-2 relative ${cardDisabled ? "opacity-50" : ""}`}>
                      {/* Schedule H badge */}
                      {item.is_schedule_h && (
                        <span className="absolute top-1 right-1 text-[8px] font-bold px-1 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/20 leading-none">Rx</span>
                      )}
                      <button
                        onClick={() => { if (cardDisabled) { toast.error(outOfStock ? "No stock!" : "All stock already in cart!"); return; } addToCart(item); }}
                        className="w-full text-left"
                      >
                        <p className="text-[13px] font-medium text-foreground line-clamp-2 leading-tight pr-4">{item.name}</p>
                         <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-xs font-bold text-primary">₹{Number(item.price)}</span>
                          {Number(item.mrp) > Number(item.price) && <span className="text-[10px] text-muted-foreground line-through">₹{Number(item.mrp)}</span>}
                          {item.unit && <span className="text-[9px] px-1 py-0 rounded bg-muted text-muted-foreground font-medium">{item.unit}</span>}
                        </div>
                        <span className={`text-[10px] ${stockColor}`}>{stockLabel}</span>
                        {/* Rack location badge (Feature 3) */}
                        {item.rack_location && (
                          <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground mt-0.5">
                            <MapPin className="h-2 w-2" />{item.rack_location}
                          </span>
                        )}
                      </button>
                      {isPackUnit(item.unit) && item.weight_per_unit && item.weight_per_unit > 0 && !outOfStock && (
                        <button
                          onClick={() => { if (fullyInCart) { toast.error("All stock already in cart!"); return; } addToCart(item, true); }}
                          disabled={fullyInCart}
                          className={`w-full mt-0.5 flex items-center justify-center gap-0.5 py-0.5 rounded text-[10px] font-medium border transition-all touch-manipulation ${fullyInCart ? "bg-muted/40 text-muted-foreground/40 border-border/20 cursor-not-allowed" : "bg-accent/10 text-accent hover:bg-accent/20 border-accent/20"}`}
                        >
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
            {[["F1","Search"],["F6","Hold"],["F8","Reprint"], isAdmin ? ["F10","Delete"] : null, ["F9","Pay"], ["F12","Complete"],["?","Help"]].filter(Boolean).map((s) => {
              const [k, l] = s as string[];
              return (
              <span key={k} className="flex items-center gap-1 whitespace-nowrap"><kbd className="kbd-shortcut">{k}</kbd>{l}</span>
            )})}
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
                {cart.map(ci => {
                  // Compute consumed stock for this item across all cart lines
                  const totalConsumedPacks = cart.filter(x => x.item.id === ci.item.id).reduce((s, x) => {
                    if (x.isLoose && ci.item.weight_per_unit && ci.item.weight_per_unit > 0)
                      return s + x.quantity / ci.item.weight_per_unit;
                    return s + x.quantity;
                  }, 0);
                  const maxStock = Number(ci.item.stock);
                  const isAtMax = totalConsumedPacks >= maxStock - 0.0001;
                  // How much more can this line add (in its own units)?
                  const remainingPacks = maxStock - totalConsumedPacks;
                  const remainingInThisUnit = (ci.isLoose && ci.item.weight_per_unit && ci.item.weight_per_unit > 0)
                    ? Math.floor(remainingPacks * ci.item.weight_per_unit)
                    : Math.floor(remainingPacks);

                  return (
                    <div key={getCartItemKey(ci)} className={`px-2 py-1.5 hover:bg-muted/20 transition-colors ${isAtMax ? "bg-destructive/5" : ""}`}>
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate">
                            {ci.item.name}
                            {ci.isLoose && <span className="ml-1 text-[9px] px-0.5 py-0 rounded bg-accent/10 text-accent">L</span>}
                            {ci.item.unit && !ci.isLoose && <span className="ml-1 text-[9px] px-1 py-0 rounded bg-muted/70 text-muted-foreground font-medium">{ci.item.unit}</span>}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            ₹{(ci.loosePrice || Number(ci.item.price)).toFixed(0)} × {ci.quantity}
                            {isAtMax
                              ? <span className="ml-1 text-destructive font-semibold">• Max stock</span>
                              : remainingInThisUnit > 0 && <span className="ml-1 text-muted-foreground">• {remainingInThisUnit} left</span>
                            }
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => updateQty(ci.item.id, -1, ci.isLoose)} className="p-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground touch-manipulation"><Minus className="h-3 w-3" /></button>
                          <button onClick={() => { setShowQtyEdit(getCartItemKey(ci)); setQtyInput(String(ci.quantity)); }}
                            className="text-[13px] font-mono font-semibold text-foreground w-8 text-center py-0.5 rounded bg-muted/50 touch-manipulation">{ci.quantity}</button>
                          <button
                            onClick={() => updateQty(ci.item.id, 1, ci.isLoose)}
                            disabled={isAtMax}
                            className={`p-0.5 rounded touch-manipulation transition-colors ${isAtMax ? "bg-muted/40 text-muted-foreground/30 cursor-not-allowed" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}
                          ><Plus className="h-3 w-3" /></button>
                        </div>
                        <p className="text-[13px] font-semibold text-foreground whitespace-nowrap w-14 text-right">₹{ci.total.toFixed(0)}</p>
                        <button onClick={() => removeItem(ci.item.id, ci.isLoose)} className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive touch-manipulation"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  );
                })}
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
            {/* Standalone Customer Return button */}
            <button
              onClick={() => { fetchPastBills(); setShowReprint(true); }}
              className="w-full mt-1.5 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium bg-muted/50 text-muted-foreground hover:bg-accent/10 hover:text-accent border border-border/50 hover:border-accent/30 transition-all touch-manipulation"
            >
              <RotateCcw className="h-3 w-3" /> Customer Return
            </button>
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

      {/* Payment Modal - properly bounded on all screen sizes */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => { setShowPayment(false); stopRxCamera(); }}>
          <div
            className="glass-card rounded-t-2xl md:rounded-2xl p-4 w-full max-w-lg md:mx-4 animate-fade-in overflow-y-auto scrollbar-thin"
            style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 8px)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-foreground">Payment</h3>
              <button onClick={() => { setShowPayment(false); stopRxCamera(); }} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <p className="text-2xl font-bold text-gradient-primary text-center my-3">₹{roundedTotal}</p>
            {billDiscount > 0 && <div className="text-center text-xs text-success mb-2">Discount: ₹{billDiscount.toFixed(0)}</div>}

            {/* Customer info */}
            <div className="flex gap-2 mb-3 p-2 rounded-lg bg-muted/30 border border-border/50 flex-col">
              <div className="flex gap-2">
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name" className="flex-1 min-w-0 px-2 py-1.5 rounded bg-muted border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                <input value={customerPhone} onBlur={checkCustomerLoyalty} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone" className="w-24 shrink-0 px-2 py-1.5 rounded bg-muted border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
              {tenantSettings?.loyalty_enabled && customerRewardPoints > 0 && (
                <div className="flex items-center justify-between text-xs px-1 py-0.5 mt-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Zap className="h-3 w-3 text-amber-500" /> {customerRewardPoints.toFixed(0)} Loyalty Points (₹{loyaltyMaxRupeeValue.toFixed(2)})
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={useRewardPoints} onChange={() => setUseRewardPoints(!useRewardPoints)} className="rounded border-border bg-background text-primary" />
                    <span>Redeem</span>
                  </label>
                </div>
              )}
            </div>

            <div className="space-y-2 mb-3">
              {paymentLines.map((line, idx) => (
                <div key={idx} className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/30 border border-border/50">
                  <select value={line.mode} onChange={e => updatePaymentLine(idx, "mode", e.target.value)}
                    className="shrink-0 px-1.5 py-1.5 rounded-lg bg-muted border border-border text-xs text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 w-20">
                    {paymentModes.map(m => <option key={m.code} value={m.code}>{m.icon} {m.name}</option>)}
                  </select>
                  <div className="flex-1 relative min-w-0">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₹</span>
                    <input type="number" value={line.amount || ""} onChange={e => updatePaymentLine(idx, "amount", parseFloat(e.target.value) || 0)}
                      onKeyDown={e => { if (e.key === "Enter") completeSale(); }}
                      autoFocus={idx === 0}
                      className="w-full pl-5 pr-2 py-1.5 rounded-lg bg-muted border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <button onClick={() => fillRemaining(idx)} className="shrink-0 px-1.5 py-1.5 rounded-lg text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 whitespace-nowrap touch-manipulation">Fill</button>
                  {paymentLines.length > 1 && <button onClick={() => removePaymentLine(idx)} className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive touch-manipulation"><X className="h-3 w-3" /></button>}
                </div>
              ))}
            </div>

            <button onClick={addPaymentLine} className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-all touch-manipulation mb-3">
              <Plus className="h-3 w-3" /> Split Payment
            </button>

            {/* Remaining / Change display */}
            {paymentLines.length > 1 ? (
              <div className={`flex justify-between items-center text-sm mb-2 px-3 py-2 rounded-lg border ${
                remaining > 0.01 ? "bg-destructive/10 border-destructive/30" : remaining < -0.01 ? "bg-success/10 border-success/30" : "bg-success/10 border-success/30"
              }`}>
                <span className="font-semibold text-foreground">
                  {remaining > 0.01 ? "Still to Pay" : remaining < -0.01 ? "Change" : "✓ Fully Paid"}
                </span>
                <span className={`text-lg font-bold ${
                  remaining > 0.01 ? "text-destructive" : "text-success"
                }`}>
                  ₹{Math.abs(remaining).toFixed(0)}
                </span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Paid</span>
                  <span className={`font-semibold ${totalPaid >= roundedTotal ? "text-success" : "text-destructive"}`}>₹{totalPaid.toFixed(0)}</span>
                </div>
                {totalPaid > roundedTotal + 0.01 && (
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Change</span>
                    <span className="font-semibold text-success">₹{(totalPaid - roundedTotal).toFixed(0)}</span>
                  </div>
                )}
              </>
            )}

            {/* WhatsApp toggle */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/50 mb-3">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" /> WhatsApp</span>
              <button onClick={() => { setWhatsappShare(!whatsappShare); localStorage.setItem("pos_whatsapp_share", (!whatsappShare).toString()); }}
                className={`px-2.5 py-0.5 rounded text-[10px] font-medium ${whatsappShare ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                {whatsappShare ? "ON" : "OFF"}
              </button>
            </div>

            {/* ─── Prescription (Rx) Panel — Feature 4 ─────────────────── */}
            {hasScheduleH && (
              <div className="mb-3 p-3 rounded-xl bg-destructive/5 border border-destructive/25">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-xs font-semibold text-destructive">Schedule H Drug — Prescription Required</p>
                </div>

                {/* Doctor name */}
                <input value={rxDoctorName} onChange={e => setRxDoctorName(e.target.value)}
                  placeholder="Doctor's name"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-muted border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-destructive/40 mb-2" />

                {/* Camera / Upload */}
                {!rxImageUrl && (
                  <div className="flex gap-2">
                    <button onClick={startRxCamera}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-muted border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors">
                      <Camera className="h-3.5 w-3.5" /> Snap Rx
                    </button>
                    <button onClick={() => rxFileRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-muted border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors">
                      <Upload className="h-3.5 w-3.5" /> Upload
                    </button>
                    <input ref={rxFileRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) uploadRxFile(e.target.files[0]); }} />
                  </div>
                )}

                {/* Webcam view */}
                {rxCamActive && (
                  <div className="mt-2 space-y-2">
                    <video ref={rxVideoRef} className="w-full rounded-lg bg-black" playsInline muted />
                    <canvas ref={rxCanvasRef} className="hidden" />
                    <div className="flex gap-2">
                      <button onClick={stopRxCamera} className="flex-1 py-1.5 rounded-lg bg-muted text-xs text-muted-foreground">Cancel</button>
                      <button onClick={captureRxPhoto} className="flex-1 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium">📸 Capture</button>
                    </div>
                  </div>
                )}

                {/* Captured/uploaded preview */}
                {rxImageUrl && (
                  <div className="mt-2 relative">
                    <img src={rxImageUrl} alt="Prescription" className="w-full rounded-lg object-cover max-h-32" />
                    <button onClick={() => setRxImageUrl(null)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-white">
                      <X className="h-3 w-3" />
                    </button>
                    <p className="text-[10px] text-success mt-1 flex items-center gap-1"><FileText className="h-2.5 w-2.5" /> Prescription captured</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 safe-area-bottom">
              <button onClick={() => { setShowPayment(false); stopRxCamera(); }} className="py-2.5 rounded-lg text-sm font-medium bg-muted text-muted-foreground touch-manipulation">Cancel</button>
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
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{si.item_name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-muted-foreground">Sold: {si.quantity} × ₹{Number(si.unit_price).toFixed(0)}</p>
                      {si.batch_number && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-mono">
                          Batch: {si.batch_number}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="text-xs text-muted-foreground">Qty:</label>
                    <input type="number" min={0} max={si.quantity} value={returnQtys[si.id] || ""} onChange={e => setReturnQtys(prev => ({ ...prev, [si.id]: Math.min(si.quantity, Math.max(0, parseFloat(e.target.value) || 0)) }))}
                      className="w-14 px-2 py-1.5 rounded bg-muted border border-border text-sm text-foreground font-mono text-center focus:outline-none focus:ring-1 focus:ring-accent/50" />
                  </div>
                </div>
              ))}
            </div>
            {(() => {
              const refundAmt = returnItems.reduce((s, si) => s + (Number(si.unit_price) * (returnQtys[si.id] || 0)), 0);
              return refundAmt > 0 ? (
                <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 mb-3">
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-muted-foreground">Refund Amount</span>
                    <span className="text-xl font-bold text-accent">₹{refundAmt.toFixed(0)}</span>
                  </div>
                  {/* Refund Mode Selector */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground shrink-0">Refund via:</label>
                    <div className="flex gap-1 flex-wrap">
                      {paymentModes.map(m => (
                        <button key={m.code} onClick={() => setReturnRefundMode(m.code)}
                          className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${returnRefundMode === m.code ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                          {m.icon} {m.name}
                        </button>
                      ))}
                    </div>
                  </div>
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

      {/* ─── Batch Select Modal ─────────────────────────────────────────────── */}
      {showBatchSelect && batchesForSelection.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => { setShowBatchSelect(false); setPendingItemForBatch(null); }}>
          <div className="glass-card rounded-2xl p-5 w-full max-w-md mx-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="text-base font-bold text-foreground">Select Batch</h3>
                <p className="text-xs text-muted-foreground">{pendingItemForBatch?.item.name}</p>
              </div>
              <button onClick={() => { setShowBatchSelect(false); setPendingItemForBatch(null); }} className="p-1 rounded hover:bg-muted">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mb-3 pb-2 border-b border-border">Multiple batches found. Select the batch from the physical box you picked.</p>
            <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
              {batchesForSelection.map((batch, idx) => {
                const isFefo = idx === 0;
                const daysLeft = batch.expiry_date
                  ? Math.ceil((new Date(batch.expiry_date).getTime() - Date.now()) / 86400000)
                  : null;
                const expiryColor = daysLeft !== null
                  ? daysLeft <= 30 ? "text-destructive" : daysLeft <= 90 ? "text-accent" : "text-success"
                  : "text-muted-foreground";
                return (
                  <button key={batch.id} onClick={() => selectSpecificBatch(batch)}
                    className={`w-full text-left p-3 rounded-xl border transition-all hover:scale-[1.01] touch-manipulation ${
                      isFefo
                        ? "bg-success/8 border-success/30 hover:bg-success/15"
                        : "bg-muted/30 border-border/50 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground font-mono">
                            {batch.batch_number || "No Batch No."}
                          </span>
                          {isFefo && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-success/20 text-success border border-success/30 font-bold uppercase tracking-wide">
                              ✓ FEFO Recommended
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs">
                          {batch.expiry_date && (
                            <span className={`flex items-center gap-1 ${expiryColor}`}>
                              <Calendar className="h-3 w-3" />
                              Exp: {new Date(batch.expiry_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                              {daysLeft !== null && ` (${daysLeft}d)`}
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            Stock: {Number(batch.quantity_remaining).toFixed(0)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold text-primary">₹{Number(batch.selling_price).toFixed(0)}</p>
                        <p className="text-[10px] text-muted-foreground">MRP</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => { setShowBatchSelect(false); setPendingItemForBatch(null); }}
              className="mt-3 w-full py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80">
              Cancel
            </button>
          </div>
        </div>
      )}


      <div className="hidden">
        <Receipt 
          ref={receiptRef}
          sale={lastSaleForPrint?.sale}
          items={lastSaleForPrint?.items || []}
          customerInfo={lastSaleForPrint?.customerInfo}
          branchDetails={currentBranchDetails}
        />
      </div>
    </div>
  );
}
