import {
  TrendingUp, ShoppingCart, IndianRupee, AlertTriangle,
  Package, Clock
} from "lucide-react";
import { dashboardStats } from "@/data/mockData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const stats = [
  { label: "Today's Sales", value: `₹${dashboardStats.todaySales.toLocaleString()}`, icon: IndianRupee, change: "+12.5%", positive: true },
  { label: "Total Orders", value: dashboardStats.todayOrders, icon: ShoppingCart, change: "+8.2%", positive: true },
  { label: "Avg Order Value", value: `₹${dashboardStats.avgOrderValue}`, icon: TrendingUp, change: "+3.1%", positive: true },
  { label: "Low Stock Items", value: dashboardStats.lowStockItems, icon: AlertTriangle, change: "", positive: false, warning: true },
];

export default function Dashboard() {
  return (
    <div className="h-screen overflow-y-auto scrollbar-thin">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Branch: Main Store • Today, {new Date().toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Online
            </span>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <div key={i} className="glass-card rounded-xl p-5 animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
                  {s.change && (
                    <span className={`text-xs font-medium mt-1 inline-block ${s.positive ? 'text-success' : 'text-destructive'}`}>
                      {s.change} vs yesterday
                    </span>
                  )}
                  {s.warning && (
                    <span className="text-xs font-medium text-accent mt-1 inline-block">Needs attention</span>
                  )}
                </div>
                <div className={`p-2.5 rounded-lg ${s.warning ? 'bg-accent/10' : 'bg-primary/10'}`}>
                  <s.icon className={`h-5 w-5 ${s.warning ? 'text-accent' : 'text-primary'}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hourly Sales Chart */}
          <div className="lg:col-span-2 glass-card rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Hourly Sales</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dashboardStats.hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 18%)" />
                <XAxis dataKey="hour" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(222 44% 10%)', border: '1px solid hsl(215 25% 18%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' }}
                  formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Sales']}
                />
                <Bar dataKey="sales" fill="hsl(187 72% 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Products */}
          <div className="glass-card rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Top Selling</h3>
            <div className="space-y-3">
              {dashboardStats.topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-md bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.qty} sold</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-foreground">₹{p.revenue}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Sales */}
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Recent Sales</h3>
            <button className="text-xs text-primary hover:underline">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Invoice</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Customer</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Items</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Time</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody>
                {dashboardStats.recentSales.map((s) => (
                  <tr key={s.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-primary text-xs">{s.id}</td>
                    <td className="py-2.5 px-3 text-foreground">{s.customer}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{s.items}</td>
                    <td className="py-2.5 px-3 text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{s.time}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-foreground">₹{s.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
