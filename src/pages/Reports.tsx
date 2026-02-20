import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, TrendingUp, ShoppingCart, IndianRupee, Package } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(187 72% 50%)", "hsl(37 95% 55%)", "hsl(152 60% 45%)", "hsl(0 72% 55%)", "hsl(270 60% 55%)"];

export default function Reports() {
  const { tenantId } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    Promise.all([
      supabase.from("sales").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(100),
      supabase.from("items").select("name, stock, price").eq("tenant_id", tenantId),
      supabase.from("expenses").select("*").eq("tenant_id", tenantId),
    ]).then(([{ data: s }, { data: i }, { data: e }]) => {
      setSales((s as any) || []);
      setItems((i as any) || []);
      setExpenses((e as any) || []);
      setLoading(false);
    });
  }, [tenantId]);

  const totalSales = sales.reduce((s, x) => s + Number(x.grand_total), 0);
  const totalExpenses = expenses.reduce((s, x) => s + Number(x.amount), 0);
  const totalOrders = sales.length;

  const paymentBreakdown = sales.reduce((acc: Record<string, number>, s) => {
    acc[s.payment_mode] = (acc[s.payment_mode] || 0) + Number(s.grand_total);
    return acc;
  }, {});
  const paymentData = Object.entries(paymentBreakdown).map(([name, value]) => ({ name, value }));

  const lowStockItems = items.filter(i => Number(i.stock) <= 10).slice(0, 10);

  return (
    <div className="h-screen overflow-y-auto scrollbar-thin">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-6 py-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><BarChart3 className="h-6 w-6 text-primary" /> Reports</h1>
        <p className="text-sm text-muted-foreground">Business analytics & insights</p>
      </header>
      <div className="p-6 space-y-6">
        {loading ? <div className="text-center text-muted-foreground py-12">Loading...</div> : <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Total Sales</p><p className="text-2xl font-bold text-foreground mt-1">₹{totalSales.toLocaleString()}</p><p className="text-xs text-success">{totalOrders} orders</p></div>
            <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Total Expenses</p><p className="text-2xl font-bold text-foreground mt-1">₹{totalExpenses.toLocaleString()}</p></div>
            <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Net Profit</p><p className={`text-2xl font-bold mt-1 ${totalSales - totalExpenses >= 0 ? "text-success" : "text-destructive"}`}>₹{(totalSales - totalExpenses).toLocaleString()}</p></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Payment Breakdown</h3>
              {paymentData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart><Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie><Tooltip contentStyle={{ backgroundColor: 'hsl(222 44% 10%)', border: '1px solid hsl(215 25% 18%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' }} /></PieChart>
                </ResponsiveContainer>
              ) : <p className="text-muted-foreground text-center py-8">No sales data yet</p>}
            </div>

            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Low Stock Items</h3>
              {lowStockItems.length > 0 ? (
                <div className="space-y-2">
                  {lowStockItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border/30">
                      <span className="text-sm text-foreground">{item.name}</span>
                      <span className="text-sm font-semibold text-accent">{Number(item.stock)} left</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-muted-foreground text-center py-8">All items well stocked</p>}
            </div>
          </div>
        </>}
      </div>
    </div>
  );
}
