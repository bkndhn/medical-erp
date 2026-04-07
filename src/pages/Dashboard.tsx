import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp, ShoppingCart, IndianRupee, AlertTriangle, Clock, Bell,
  Package, X, Zap, Minus, TrendingDown, ChevronDown, ChevronUp, Info
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";

interface LowStockItem {
  id: string; name: string; stock: number; low_stock_threshold: number;
  price: number; cost_price: number | null; unit: string | null;
}

interface ItemVelocity {
  item_id: string; item_name: string; total_qty: number; total_revenue: number;
  velocity: "fast" | "medium" | "slow"; stock: number; cost_price: number | null;
}

const VELOCITY_DAYS = 30;

export default function Dashboard() {
  const { profile, tenantId } = useAuth();
  const [stats, setStats] = useState({ totalSales: 0, totalOrders: 0, avgOrder: 0, lowStock: 0, totalInventoryValue: 0, totalCostValue: 0 });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [allItems, setAllItems] = useState<LowStockItem[]>([]);
  const [itemVelocities, setItemVelocities] = useState<ItemVelocity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showValuation, setShowValuation] = useState(false);
  const [dailySalesData, setDailySalesData] = useState<any[]>([]);
  const [activeVelocityFilter, setActiveVelocityFilter] = useState<"all" | "fast" | "medium" | "slow">("all");
  const [inventorySearch, setInventorySearch] = useState("");

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);

    const since30 = new Date(); since30.setDate(since30.getDate() - VELOCITY_DAYS);

    Promise.all([
      supabase.from("sales").select("grand_total, created_at, invoice_number, payment_mode, status, cost_total").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(100),
      supabase.from("items").select("id, name, stock, low_stock_threshold, price, cost_price, unit").eq("tenant_id", tenantId).eq("is_active", true),
      supabase.from("sale_items").select("item_id, item_name, quantity, total").gte("created_at", since30.toISOString()),
    ]).then(([{ data: sales }, { data: items }, { data: saleItems }]) => {
      const s = (sales as any) || [];
      const it = (items as any) || [];
      const si = (saleItems as any) || [];

      const total = s.reduce((sum: number, x: any) => sum + Number(x.grand_total), 0);
      const lowItems = it.filter((i: any) => Number(i.stock) <= (Number(i.low_stock_threshold) || 10));

      // Inventory value calculations
      const totalInventoryValue = it.reduce((sum: number, i: any) => sum + Number(i.price) * Number(i.stock), 0);
      const totalCostValue = it.reduce((sum: number, i: any) => sum + (Number(i.cost_price) || 0) * Number(i.stock), 0);

      setStats({
        totalSales: total,
        totalOrders: s.length,
        avgOrder: s.length > 0 ? Math.round(total / s.length) : 0,
        lowStock: lowItems.length,
        totalInventoryValue,
        totalCostValue,
      });

      setRecentSales(s.slice(0, 6));
      setLowStockItems(lowItems.sort((a: any, b: any) => Number(a.stock) - Number(b.stock)).slice(0, 30));
      setAllItems(it.sort((a: any, b: any) => a.name.localeCompare(b.name)));

      // ── Item Velocity Calculation ───────────────────────────────────────────
      // Aggregate quantities sold per item in last 30 days
      const velMap: Record<string, { qty: number; rev: number; name: string }> = {};
      si.forEach((row: any) => {
        const key = row.item_id || row.item_name;
        if (!velMap[key]) velMap[key] = { qty: 0, rev: 0, name: row.item_name };
        velMap[key].qty += Number(row.quantity);
        velMap[key].rev += Number(row.total);
      });

      const qtys = Object.values(velMap).map(v => v.qty).sort((a, b) => a - b);
      const p33 = qtys[Math.floor(qtys.length * 0.33)] || 1;
      const p67 = qtys[Math.floor(qtys.length * 0.67)] || 5;

      const velocities: ItemVelocity[] = Object.entries(velMap).map(([itemId, data]) => {
        const itemRecord = it.find((i: any) => i.id === itemId || i.name === data.name);
        const velocity: "fast" | "medium" | "slow" = data.qty >= p67 ? "fast" : data.qty >= p33 ? "medium" : "slow";
        return {
          item_id: itemId, item_name: data.name,
          total_qty: data.qty, total_revenue: data.rev,
          velocity, stock: Number(itemRecord?.stock || 0),
          cost_price: itemRecord?.cost_price || null,
        };
      }).sort((a, b) => b.total_qty - a.total_qty);

      setItemVelocities(velocities);

      // Build daily sales chart (last 7 days)
      const dayMap: Record<string, number> = {};
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        dayMap[d.toLocaleDateString("en-IN", { weekday: "short" })] = 0;
      }
      s.forEach((sale: any) => {
        const key = new Date(sale.created_at).toLocaleDateString("en-IN", { weekday: "short" });
        if (dayMap[key] !== undefined) dayMap[key] += Number(sale.grand_total);
      });
      setDailySalesData(Object.entries(dayMap).map(([day, amount]) => ({ day, amount: Math.round(amount) })));

      const outOfStock = lowItems.filter((i: any) => Number(i.stock) === 0);
      if (outOfStock.length > 0) toast.warning(`${outOfStock.length} items are out of stock!`, { duration: 5000 });

      setLoading(false);
    });

    const channel = supabase.channel("stock-alerts")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "items", filter: `tenant_id=eq.${tenantId}` }, (payload) => {
        const newItem = payload.new as any;
        const threshold = Number(newItem.low_stock_threshold) || 10;
        if (Number(newItem.stock) <= threshold && Number(newItem.stock) > 0)
          toast.warning(`⚠️ Low stock: ${newItem.name} (${newItem.stock} left)`, { duration: 4000 });
        else if (Number(newItem.stock) === 0)
          toast.error(`🚨 Out of stock: ${newItem.name}`, { duration: 5000 });
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const filteredVelocities = itemVelocities.filter(v =>
    activeVelocityFilter === "all" || v.velocity === activeVelocityFilter
  );

  const filteredInventory = allItems.filter(i =>
    !inventorySearch || i.name.toLowerCase().includes(inventorySearch.toLowerCase())
  );

  const velocityConfig = {
    fast: { label: "Fast Mover", color: "text-success", bg: "bg-success/10 border-success/30", icon: Zap, dot: "bg-success" },
    medium: { label: "Medium Mover", color: "text-accent", bg: "bg-accent/10 border-accent/30", icon: Minus, dot: "bg-accent" },
    slow: { label: "Slow Mover", color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", icon: TrendingDown, dot: "bg-destructive" },
  };

  const tooltipStyle = { backgroundColor: 'hsl(222 44% 10%)', border: '1px solid hsl(215 25% 18%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' };

  const statCards = [
    { label: "Total Sales", value: `₹${stats.totalSales.toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-primary", bg: "bg-primary/10" },
    { label: "Orders", value: stats.totalOrders, icon: ShoppingCart, color: "text-primary", bg: "bg-primary/10" },
    { label: "Avg Order", value: `₹${stats.avgOrder.toLocaleString("en-IN")}`, icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
    { label: "Low Stock", value: stats.lowStock, icon: AlertTriangle, color: stats.lowStock > 0 ? "text-accent" : "text-primary", bg: stats.lowStock > 0 ? "bg-accent/10" : "bg-primary/10", onClick: () => setShowAlerts(true), warning: stats.lowStock > 0 },
    { label: "Inventory MRP", value: `₹${Math.round(stats.totalInventoryValue).toLocaleString("en-IN")}`, icon: Package, color: "text-primary", bg: "bg-primary/10", onClick: () => setShowInventory(true) },
    { label: "Inventory Cost", value: `₹${Math.round(stats.totalCostValue).toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-success", bg: "bg-success/10", onClick: () => setShowInventory(true) },
  ];

  return (
    <div className="h-screen overflow-y-auto scrollbar-thin pb-20 md:pb-0">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="ml-10 md:ml-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Welcome, {profile?.full_name || "User"} • {new Date().toLocaleDateString("en-IN")}</p>
          </div>
          <div className="flex items-center gap-2">
            {stats.lowStock > 0 && (
              <button onClick={() => setShowAlerts(true)} className="relative p-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-all touch-manipulation">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">{stats.lowStock}</span>
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Online
            </span>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading dashboard...</div>
        ) : <>

          {/* ── Stat Cards ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {statCards.map((s, i) => (
              <button key={i} onClick={s.onClick}
                className={`glass-card rounded-xl p-4 animate-fade-in text-left transition-all ${s.onClick ? "cursor-pointer hover:border-primary/30" : "cursor-default"}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className={`p-2 rounded-lg ${s.bg}`}>
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                  </div>
                  {s.warning && <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />}
                </div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
                <p className="text-lg font-bold text-foreground mt-0.5">{s.value}</p>
              </button>
            ))}
          </div>

          {/* ── Sales Chart ────────────────────────────────────────────── */}
          {dailySalesData.length > 0 && (
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Sales This Week</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailySalesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 18%)" />
                  <XAxis dataKey="day" tick={{ fill: 'hsl(210 40% 60%)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'hsl(210 40% 60%)', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, 'Sales']} />
                  <Bar dataKey="amount" fill="hsl(187 72% 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Item Velocity ──────────────────────────────────────────── */}
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Zap className="h-4 w-4 text-accent" /> Item Movement Tracker
                  <span className="text-[10px] font-normal text-muted-foreground">Last {VELOCITY_DAYS} days</span>
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Track which items to reorder — Fast = buy more, Slow = reduce purchase</p>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(["all", "fast", "medium", "slow"] as const).map(f => (
                  <button key={f} onClick={() => setActiveVelocityFilter(f)}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${activeVelocityFilter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                    {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                    {f !== "all" && (
                      <span className="ml-1.5 opacity-70">
                        ({itemVelocities.filter(v => v.velocity === f).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary row */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {(["fast", "medium", "slow"] as const).map(v => {
                const cfg = velocityConfig[v];
                const count = itemVelocities.filter(x => x.velocity === v).length;
                return (
                  <div key={v} className={`p-3 rounded-lg border ${cfg.bg} cursor-pointer`} onClick={() => setActiveVelocityFilter(v)}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <cfg.icon className={`h-3 w-3 ${cfg.color}`} />
                      <span className={`text-[10px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <p className={`text-xl font-bold ${cfg.color}`}>{count}</p>
                    <p className="text-[9px] text-muted-foreground">items</p>
                  </div>
                );
              })}
            </div>

            <div className="max-h-72 overflow-y-auto scrollbar-thin">
              {filteredVelocities.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No sales data in last {VELOCITY_DAYS} days</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card/90 backdrop-blur-sm">
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Item</th>
                      <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Qty Sold</th>
                      <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Revenue</th>
                      <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Stock</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground hidden md:table-cell">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVelocities.map((v, i) => {
                      const cfg = velocityConfig[v.velocity];
                      const action = v.velocity === "fast"
                        ? "🛒 Reorder Now"
                        : v.velocity === "medium"
                        ? "📋 Monitor"
                        : "⏸ Reduce Purchase";
                      return (
                        <tr key={i} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                          <td className="py-2 px-2">
                            <p className="text-xs font-medium text-foreground line-clamp-1">{v.item_name}</p>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-semibold ${cfg.bg} ${cfg.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                              {v.velocity.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right text-xs font-semibold text-foreground hidden sm:table-cell">{v.total_qty}</td>
                          <td className="py-2 px-2 text-right text-xs text-muted-foreground hidden sm:table-cell">₹{Math.round(v.total_revenue).toLocaleString("en-IN")}</td>
                          <td className={`py-2 px-2 text-right text-xs font-bold ${v.stock === 0 ? "text-destructive" : v.stock <= 5 ? "text-accent" : "text-success"}`}>
                            {v.stock === 0 ? "OUT" : v.stock}
                          </td>
                          <td className="py-2 px-2 hidden md:table-cell">
                            <span className="text-[10px] text-muted-foreground">{action}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ── Recent Sales + Inventory Summary ──────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />Recent Sales</h3>
              {recentSales.length > 0 ? (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border/50">
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Invoice</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Time</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Amount</th>
                  </tr></thead>
                  <tbody>
                    {recentSales.map((s) => (
                      <tr key={s.invoice_number} className="border-b border-border/30 hover:bg-muted/30">
                        <td className="py-2 px-2 font-mono text-primary text-xs">{s.invoice_number}</td>
                        <td className="py-2 px-2 text-muted-foreground text-xs hidden sm:table-cell">{new Date(s.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="py-2 px-2 text-right font-semibold text-foreground">₹{Number(s.grand_total).toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-muted-foreground text-center py-8">No sales yet. Start billing!</p>}
            </div>

            {/* Inventory overview card */}
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Package className="h-4 w-4 text-primary" />Inventory Overview</h3>
                <button onClick={() => setShowInventory(true)} className="text-xs text-primary hover:underline">View All</button>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Total SKUs</span>
                  <span className="font-semibold text-foreground">{allItems.length}</span>
                </div>
                <div className="flex justify-between text-xs py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">MRP Stock Value</span>
                  <span className="font-semibold text-foreground">₹{Math.round(stats.totalInventoryValue).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-xs py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Cost Stock Value</span>
                  <span className="font-semibold text-success">₹{Math.round(stats.totalCostValue).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-xs py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Unrealised Profit</span>
                  <span className="font-bold text-primary">₹{Math.round(stats.totalInventoryValue - stats.totalCostValue).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-xs py-1.5">
                  <span className="text-muted-foreground">Low / Out of Stock</span>
                  <span className={`font-semibold ${stats.lowStock > 0 ? "text-accent" : "text-success"}`}>{stats.lowStock} items</span>
                </div>
              </div>

              {/* Low stock mini list */}
              {lowStockItems.slice(0, 4).map(item => (
                <div key={item.id} className={`flex items-center justify-between p-2 rounded-lg mb-1 border text-xs ${Number(item.stock) === 0 ? "bg-destructive/5 border-destructive/20 text-destructive" : "bg-accent/5 border-accent/20 text-accent"}`}>
                  <span className="truncate max-w-[60%] font-medium">{item.name}</span>
                  <span className="font-bold">{Number(item.stock) === 0 ? "OUT" : `${item.stock} left`}</span>
                </div>
              ))}
              {lowStockItems.length > 4 && (
                <button onClick={() => setShowAlerts(true)} className="w-full text-center text-[10px] text-muted-foreground hover:text-primary py-1 mt-1">
                  +{lowStockItems.length - 4} more alerts →
                </button>
              )}
            </div>
          </div>

          {/* ── App Valuation Section ─────────────────────────────────── */}
          <div className="glass-card rounded-xl p-5">
            <button onClick={() => setShowValuation(!showValuation)} className="w-full flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Info className="h-4 w-4 text-primary" />App Valuation & Market Worth</h3>
              {showValuation ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {showValuation && (
              <div className="mt-5 space-y-6 animate-fade-in">
                {/* Development cost table */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">💻 Development Cost Estimate</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-border/50">
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Module</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Freelancer (₹)</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Agency (₹)</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium hidden sm:table-cell">Hours</th>
                      </tr></thead>
                      <tbody>
                        {[
                          ["Authentication & Multi-tenant", "15,000", "45,000", "40"],
                          ["POS Billing with Barcode", "25,000", "80,000", "70"],
                          ["Inventory Management", "20,000", "60,000", "55"],
                          ["Supplier & Purchase Module", "18,000", "55,000", "50"],
                          ["Customer & CRM", "12,000", "35,000", "30"],
                          ["Accounting & Payments", "20,000", "65,000", "60"],
                          ["Reports & Analytics", "22,000", "70,000", "65"],
                          ["User Management + RBAC", "15,000", "45,000", "40"],
                          ["WhatsApp Integration", "10,000", "30,000", "25"],
                          ["PWA / Offline Support", "12,000", "40,000", "35"],
                          ["Attendance Module", "8,000", "25,000", "20"],
                          ["Branch Management", "8,000", "25,000", "20"],
                          ["Settings & Customization", "10,000", "30,000", "25"],
                          ["Super Admin Panel", "12,000", "40,000", "30"],
                          ["UI/UX Design", "15,000", "60,000", "50"],
                          ["Testing & QA", "8,000", "30,000", "25"],
                          ["Deployment & DevOps", "5,000", "25,000", "15"],
                        ].map(([mod, fl, ag, hr], i) => (
                          <tr key={i} className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                            <td className="py-2 px-3 font-medium text-foreground">{mod}</td>
                            <td className="py-2 px-3 text-right text-success font-medium">₹{fl}</td>
                            <td className="py-2 px-3 text-right text-accent font-medium">₹{ag}</td>
                            <td className="py-2 px-3 text-right text-muted-foreground hidden sm:table-cell">{hr}h</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-border bg-muted/30 font-bold">
                          <td className="py-3 px-3 text-foreground font-bold">TOTAL</td>
                          <td className="py-3 px-3 text-right text-success font-bold text-sm">₹2,35,000</td>
                          <td className="py-3 px-3 text-right text-accent font-bold text-sm">₹7,60,000</td>
                          <td className="py-3 px-3 text-right text-muted-foreground hidden sm:table-cell">655h</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Market value */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">💰 Market Worth to Customer</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { tier: "Small Medical Store", users: "1–3 users", price: "₹999–₹1,499/mo", annual: "₹12k–18k/yr", note: "Single branch, basic POS & inventory", color: "border-success/30 bg-success/5", tc: "text-success" },
                      { tier: "Mid-size Pharmacy", users: "5–15 users", price: "₹2,999–₹4,999/mo", annual: "₹36k–60k/yr", note: "Multi-branch, reports, WhatsApp, CRM", color: "border-accent/30 bg-accent/5", tc: "text-accent" },
                      { tier: "Chain / Distributor", users: "15+ users", price: "₹9,999–₹19,999/mo", annual: "₹1.2L–2.4L/yr", note: "Full features + custom integrations + SLA", color: "border-primary/30 bg-primary/5", tc: "text-primary" },
                    ].map((t, i) => (
                      <div key={i} className={`p-4 rounded-xl border ${t.color}`}>
                        <p className={`text-sm font-bold ${t.tc}`}>{t.tier}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t.users}</p>
                        <p className={`text-lg font-bold mt-2 ${t.tc}`}>{t.price}</p>
                        <p className="text-[10px] text-muted-foreground">{t.annual}</p>
                        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">{t.note}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comparable SaaS */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">📊 Comparable SaaS Products</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { name: "Busy Accounting", price: "₹7,200/yr", note: "No POS/branch" },
                      { name: "Marg ERP", price: "₹15,000/yr", note: "Desktop only" },
                      { name: "GoFrugal", price: "₹24,000/yr", note: "Pharma-specific" },
                      { name: "Vyapar", price: "₹3,599/yr", note: "No multi-branch" },
                    ].map((c, i) => (
                      <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                        <p className="text-xs font-semibold text-foreground">{c.name}</p>
                        <p className="text-sm font-bold text-primary mt-0.5">{c.price}</p>
                        <p className="text-[10px] text-muted-foreground">{c.note}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <span className="font-semibold text-primary">Your competitive edge:</span> This app matches GoFrugal-level features at 30–40% lower cost, while being cloud-native, PWA-ready, multi-branch, and customizable — placing it in the <span className="font-semibold text-foreground">₹25,000–₹50,000/yr per customer</span> sweet spot for mid-market medical retail.
                  </p>
                </div>
              </div>
            )}
          </div>

        </>}
      </div>

      {/* ── Stock Alerts Modal ─────────────────────────────────────────── */}
      {showAlerts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setShowAlerts(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto scrollbar-thin animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-accent" />Stock Alerts</h3>
              <button onClick={() => setShowAlerts(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            {lowStockItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">All items well stocked ✅</p>
            ) : (
              <div className="space-y-2">
                {lowStockItems.map(item => (
                  <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg border ${Number(item.stock) === 0 ? "bg-destructive/5 border-destructive/30" : "bg-accent/5 border-accent/20"}`}>
                    <div className="flex items-center gap-3">
                      <Package className={`h-4 w-4 ${Number(item.stock) === 0 ? "text-destructive" : "text-accent"}`} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Min: {Number(item.low_stock_threshold) || 10} • MRP ₹{Number(item.price)} • Cost ₹{Number(item.cost_price || 0)}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${Number(item.stock) === 0 ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent"}`}>
                      {Number(item.stock) === 0 ? "OUT" : `${Number(item.stock)} left`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Full Inventory Modal ────────────────────────────────────────── */}
      {showInventory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setShowInventory(false)}>
          <div className="glass-card rounded-2xl p-5 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Package className="h-5 w-5 text-primary" />All Stock Items</h3>
                <p className="text-xs text-muted-foreground">{allItems.length} items • MRP Val: ₹{Math.round(stats.totalInventoryValue).toLocaleString("en-IN")} • Cost Val: ₹{Math.round(stats.totalCostValue).toLocaleString("en-IN")}</p>
              </div>
              <button onClick={() => setShowInventory(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <input
              value={inventorySearch} onChange={e => setInventorySearch(e.target.value)}
              placeholder="Search item..."
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground mb-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <div className="overflow-y-auto scrollbar-thin flex-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card/95 backdrop-blur-sm">
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Item</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Stock</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Min</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground hidden sm:table-cell">MRP</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground hidden sm:table-cell">Cost</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Stock Value (Cost)</th>
                    <th className="text-center py-2 px-3 font-medium text-muted-foreground">Alert</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item, i) => {
                    const minStock = Number(item.low_stock_threshold) || 10;
                    const stockNum = Number(item.stock);
                    const isOut = stockNum === 0;
                    const isLow = stockNum > 0 && stockNum <= minStock;
                    const costVal = (Number(item.cost_price) || 0) * stockNum;
                    return (
                      <tr key={item.id} className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${isOut ? "bg-destructive/5" : isLow ? "bg-accent/5" : i % 2 === 0 ? "" : "bg-muted/5"}`}>
                        <td className="py-2 px-3 font-medium text-foreground">{item.name}</td>
                        <td className={`py-2 px-3 text-right font-bold ${isOut ? "text-destructive" : isLow ? "text-accent" : "text-success"}`}>{stockNum}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{minStock}</td>
                        <td className="py-2 px-3 text-right text-foreground hidden sm:table-cell">₹{Number(item.price)}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground hidden sm:table-cell">₹{Number(item.cost_price || 0)}</td>
                        <td className="py-2 px-3 text-right font-semibold text-primary">₹{Math.round(costVal).toLocaleString("en-IN")}</td>
                        <td className="py-2 px-3 text-center">
                          {isOut ? <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-destructive/10 text-destructive">OUT</span>
                            : isLow ? <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-accent/10 text-accent">LOW</span>
                            : <span className="text-success">✓</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 bg-card/95 backdrop-blur-sm">
                  <tr className="border-t-2 border-border font-bold">
                    <td className="py-2 px-3 text-foreground" colSpan={5}>TOTAL INVENTORY COST VALUE</td>
                    <td className="py-2 px-3 text-right text-primary font-bold text-sm">₹{Math.round(stats.totalCostValue).toLocaleString("en-IN")}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
