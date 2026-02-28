import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp, ShoppingCart, IndianRupee, AlertTriangle, Clock, Bell, Package, X
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";

interface LowStockItem {
  id: string;
  name: string;
  stock: number;
  low_stock_threshold: number;
  price: number;
  unit: string | null;
}

export default function Dashboard() {
  const { profile, tenantId } = useAuth();
  const [stats, setStats] = useState({ totalSales: 0, totalOrders: 0, avgOrder: 0, lowStock: 0 });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [topItems, setTopItems] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAlerts, setShowAlerts] = useState(false);
  const [dailySalesData, setDailySalesData] = useState<any[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);

    Promise.all([
      supabase.from("sales").select("grand_total, created_at, invoice_number, payment_mode, status").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
      supabase.from("items").select("id, name, stock, low_stock_threshold, price, unit").eq("tenant_id", tenantId),
    ]).then(([{ data: sales }, { data: items }]) => {
      const s = (sales as any) || [];
      const it = (items as any) || [];
      const total = s.reduce((sum: number, x: any) => sum + Number(x.grand_total), 0);
      const lowItems = it.filter((i: any) => Number(i.stock) <= (Number(i.low_stock_threshold) || 10));

      setStats({
        totalSales: total,
        totalOrders: s.length,
        avgOrder: s.length > 0 ? Math.round(total / s.length) : 0,
        lowStock: lowItems.length,
      });
      setRecentSales(s.slice(0, 5));
      setTopItems(it.sort((a: any, b: any) => Number(b.stock) - Number(a.stock)).slice(0, 5));
      setLowStockItems(lowItems.sort((a: any, b: any) => Number(a.stock) - Number(b.stock)).slice(0, 20));

      // Build daily sales chart (last 7 days)
      const dayMap: Record<string, number> = {};
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        dayMap[d.toLocaleDateString("en-IN", { weekday: "short" })] = 0;
      }
      s.forEach((sale: any) => {
        const d = new Date(sale.created_at);
        const key = d.toLocaleDateString("en-IN", { weekday: "short" });
        if (dayMap[key] !== undefined) dayMap[key] += Number(sale.grand_total);
      });
      setDailySalesData(Object.entries(dayMap).map(([day, amount]) => ({ day, amount: Math.round(amount) })));

      // Show toast for critical stock
      const outOfStock = lowItems.filter((i: any) => Number(i.stock) === 0);
      if (outOfStock.length > 0) {
        toast.warning(`${outOfStock.length} items are out of stock!`, { duration: 5000 });
      }

      setLoading(false);
    });

    // Real-time subscription for stock changes
    const channel = supabase
      .channel("stock-alerts")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "items", filter: `tenant_id=eq.${tenantId}` }, (payload) => {
        const newItem = payload.new as any;
        const threshold = Number(newItem.low_stock_threshold) || 10;
        if (Number(newItem.stock) <= threshold && Number(newItem.stock) > 0) {
          toast.warning(`⚠️ Low stock: ${newItem.name} (${newItem.stock} left)`, { duration: 4000 });
        } else if (Number(newItem.stock) === 0) {
          toast.error(`🚨 Out of stock: ${newItem.name}`, { duration: 5000 });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const statCards = [
    { label: "Total Sales", value: `₹${stats.totalSales.toLocaleString()}`, icon: IndianRupee },
    { label: "Total Orders", value: stats.totalOrders, icon: ShoppingCart },
    { label: "Avg Order Value", value: `₹${stats.avgOrder}`, icon: TrendingUp },
    { label: "Low Stock Items", value: stats.lowStock, icon: AlertTriangle, warning: stats.lowStock > 0, onClick: () => setShowAlerts(true) },
  ];

  const tooltipStyle = { backgroundColor: 'hsl(222 44% 10%)', border: '1px solid hsl(215 25% 18%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' };

  return (
    <div className="h-screen overflow-y-auto scrollbar-thin pb-20 md:pb-0">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="ml-10 md:ml-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Welcome, {profile?.full_name || "User"} • {new Date().toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-2">
            {stats.lowStock > 0 && (
              <button
                onClick={() => setShowAlerts(true)}
                className="relative p-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-all touch-manipulation"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {stats.lowStock}
                </span>
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Online
            </span>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 space-y-6">
        {loading ? <div className="text-center text-muted-foreground py-12">Loading dashboard...</div> : <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {statCards.map((s, i) => (
              <button
                key={i}
                onClick={s.onClick}
                className={`glass-card rounded-xl p-4 sm:p-5 animate-fade-in text-left transition-all ${s.onClick ? "cursor-pointer hover:border-primary/30" : "cursor-default"}`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
                    <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">{s.value}</p>
                  </div>
                  <div className={`p-2 sm:p-2.5 rounded-lg ${s.warning ? "bg-accent/10" : "bg-primary/10"}`}>
                    <s.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${s.warning ? "text-accent" : "text-primary"}`} />
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Sales Chart */}
          {dailySalesData.length > 0 && (
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Sales This Week</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailySalesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 18%)" />
                  <XAxis dataKey="day" tick={{ fill: 'hsl(210 40% 60%)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'hsl(210 40% 60%)', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`₹${v.toLocaleString()}`, 'Sales']} />
                  <Bar dataKey="amount" fill="hsl(187 72% 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Recent Sales</h3>
              {recentSales.length > 0 ? (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border/50">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Invoice</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Payment</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Amount</th>
                  </tr></thead>
                  <tbody>
                    {recentSales.map((s) => (
                      <tr key={s.invoice_number} className="border-b border-border/30 hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-mono text-primary text-xs">{s.invoice_number}</td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs hidden sm:table-cell">{new Date(s.created_at).toLocaleString()}</td>
                        <td className="py-2.5 px-3 hidden sm:table-cell"><span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground uppercase">{s.payment_mode}</span></td>
                        <td className="py-2.5 px-3 text-right font-semibold text-foreground">₹{Number(s.grand_total).toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-muted-foreground text-center py-8">No sales yet. Start billing from POS!</p>}
            </div>

            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Top Items by Stock</h3>
              {topItems.length > 0 ? (
                <div className="space-y-3">
                  {topItems.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-md bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
                        <p className="text-sm font-medium text-foreground">{p.name}</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{Number(p.stock)}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-muted-foreground text-center py-8">Add items to see stats</p>}
            </div>
          </div>
        </>}
      </div>

      {/* Stock Alerts Panel */}
      {showAlerts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setShowAlerts(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto scrollbar-thin animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-accent" /> Stock Alerts
              </h3>
              <button onClick={() => setShowAlerts(false)} className="p-1 rounded hover:bg-muted">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {lowStockItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">All items well stocked ✅</p>
            ) : (
              <div className="space-y-2">
                {lowStockItems.map(item => (
                  <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    Number(item.stock) === 0
                      ? "bg-destructive/5 border-destructive/30"
                      : "bg-accent/5 border-accent/20"
                  }`}>
                    <div className="flex items-center gap-3">
                      <Package className={`h-4 w-4 ${Number(item.stock) === 0 ? "text-destructive" : "text-accent"}`} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Threshold: {Number(item.low_stock_threshold) || 10} • ₹{Number(item.price)}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      Number(item.stock) === 0
                        ? "bg-destructive/10 text-destructive"
                        : "bg-accent/10 text-accent"
                    }`}>
                      {Number(item.stock) === 0 ? "OUT" : `${Number(item.stock)} left`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
