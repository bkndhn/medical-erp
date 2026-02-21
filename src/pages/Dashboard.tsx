import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp, ShoppingCart, IndianRupee, AlertTriangle, Clock
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function Dashboard() {
  const { profile, tenantId } = useAuth();
  const [stats, setStats] = useState({ totalSales: 0, totalOrders: 0, avgOrder: 0, lowStock: 0 });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [topItems, setTopItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);

    Promise.all([
      supabase.from("sales").select("grand_total, created_at, invoice_number, payment_mode, status").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
      supabase.from("items").select("name, stock, low_stock_threshold, price").eq("tenant_id", tenantId),
    ]).then(([{ data: sales }, { data: items }]) => {
      const s = (sales as any) || [];
      const it = (items as any) || [];
      const total = s.reduce((sum: number, x: any) => sum + Number(x.grand_total), 0);
      const lowStock = it.filter((i: any) => Number(i.stock) <= (Number(i.low_stock_threshold) || 10)).length;

      setStats({
        totalSales: total,
        totalOrders: s.length,
        avgOrder: s.length > 0 ? Math.round(total / s.length) : 0,
        lowStock,
      });
      setRecentSales(s.slice(0, 5));
      setTopItems(it.sort((a: any, b: any) => Number(b.stock) - Number(a.stock)).slice(0, 5));
      setLoading(false);
    });
  }, [tenantId]);

  const statCards = [
    { label: "Total Sales", value: `₹${stats.totalSales.toLocaleString()}`, icon: IndianRupee },
    { label: "Total Orders", value: stats.totalOrders, icon: ShoppingCart },
    { label: "Avg Order Value", value: `₹${stats.avgOrder}`, icon: TrendingUp },
    { label: "Low Stock Items", value: stats.lowStock, icon: AlertTriangle, warning: true },
  ];

  return (
    <div className="h-screen overflow-y-auto scrollbar-thin">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="ml-10 md:ml-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Welcome, {profile?.full_name || "User"} • {new Date().toLocaleDateString()}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Online
          </span>
        </div>
      </header>

      <div className="p-4 sm:p-6 space-y-6">
        {loading ? <div className="text-center text-muted-foreground py-12">Loading dashboard...</div> : <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((s, i) => (
              <div key={i} className="glass-card rounded-xl p-5 animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-lg ${s.warning ? "bg-accent/10" : "bg-primary/10"}`}>
                    <s.icon className={`h-5 w-5 ${s.warning ? "text-accent" : "text-primary"}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>

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
    </div>
  );
}
