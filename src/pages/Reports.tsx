import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Package, AlertTriangle, Calendar, Building2, FileText, Monitor } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import DateFilterExport, { exportToExcel, exportToPDF } from "@/components/DateFilterExport";

const COLORS = ["hsl(187 72% 50%)", "hsl(37 95% 55%)", "hsl(152 60% 45%)", "hsl(0 72% 55%)", "hsl(270 60% 55%)", "hsl(210 70% 55%)"];
const TABS = ["overview", "stock", "sales", "expiry", "devices"] as const;
type Tab = typeof TABS[number];

export default function Reports() {
  const { tenantId } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    Promise.all([
      supabase.from("sales").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(500),
      supabase.from("sale_items").select("*").limit(1000),
      supabase.from("items").select("*").eq("tenant_id", tenantId),
      supabase.from("expenses").select("*").eq("tenant_id", tenantId),
      supabase.from("suppliers").select("id, name").eq("tenant_id", tenantId),
      supabase.from("purchases").select("*, supplier_id").eq("tenant_id", tenantId),
      supabase.from("devices").select("*").eq("tenant_id", tenantId),
    ]).then(([{ data: s }, { data: si }, { data: i }, { data: e }, { data: sup }, { data: p }, { data: dev }]) => {
      setSales((s as any) || []);
      setSaleItems((si as any) || []);
      setItems((i as any) || []);
      setExpenses((e as any) || []);
      setSuppliers((sup as any) || []);
      setPurchases((p as any) || []);
      setDevices((dev as any) || []);
      setLoading(false);
    });
  }, [tenantId]);

  // Date-filtered sales
  const filteredSales = useMemo(() => {
    if (!dateFrom) return sales;
    return sales.filter(s => {
      const d = new Date(s.created_at);
      if (d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [sales, dateFrom, dateTo]);

  const totalSales = filteredSales.reduce((s, x) => s + Number(x.grand_total), 0);
  const totalExpenses = expenses.reduce((s, x) => s + Number(x.amount), 0);

  // Payment breakdown
  const paymentData = useMemo(() => {
    const breakdown: Record<string, number> = {};
    filteredSales.forEach(s => { breakdown[s.payment_mode] = (breakdown[s.payment_mode] || 0) + Number(s.grand_total); });
    return Object.entries(breakdown).map(([name, value]) => ({ name, value }));
  }, [filteredSales]);

  // Stock reports
  const lowStockItems = useMemo(() => items.filter(i => Number(i.stock) <= (i.low_stock_threshold || 10)).sort((a, b) => Number(a.stock) - Number(b.stock)), [items]);
  const supplierMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s.name])), [suppliers]);

  const stockByManufacturer = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    items.forEach(i => {
      const mfr = i.manufacturer || "Unknown";
      if (!map[mfr]) map[mfr] = { count: 0, value: 0 };
      map[mfr].count += Number(i.stock);
      map[mfr].value += Number(i.stock) * Number(i.price);
    });
    return Object.entries(map).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.value - a.value).slice(0, 15);
  }, [items]);

  // Expiry report
  const expiryItems = useMemo(() => {
    const today = new Date();
    return items.filter(i => i.expiry_date).map(i => {
      const exp = new Date(i.expiry_date);
      const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { ...i, daysLeft, expired: daysLeft <= 0 };
    }).sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 50);
  }, [items]);

  // Sales reports - item wise
  const itemWiseSales = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    saleItems.forEach(si => {
      if (!map[si.item_name]) map[si.item_name] = { name: si.item_name, qty: 0, revenue: 0 };
      map[si.item_name].qty += Number(si.quantity);
      map[si.item_name].revenue += Number(si.total);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 20);
  }, [saleItems]);

  // HSN wise
  const hsnWiseSales = useMemo(() => {
    const map: Record<string, { hsn: string; qty: number; revenue: number; tax: number }> = {};
    saleItems.forEach(si => {
      const item = items.find(i => i.id === si.item_id);
      const hsn = item?.hsn_code || "No HSN";
      if (!map[hsn]) map[hsn] = { hsn, qty: 0, revenue: 0, tax: 0 };
      map[hsn].qty += Number(si.quantity);
      map[hsn].revenue += Number(si.total);
      map[hsn].tax += Number(si.tax_amount || 0);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [saleItems, items]);

  // Supplier wise purchases
  const supplierWise = useMemo(() => {
    const map: Record<string, { name: string; count: number; total: number }> = {};
    purchases.forEach(p => {
      const name = supplierMap[p.supplier_id] || "Unknown";
      if (!map[name]) map[name] = { name, count: 0, total: 0 };
      map[name].count++;
      map[name].total += Number(p.grand_total);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [purchases, supplierMap]);

  // Device wise sales
  const deviceWiseSales = useMemo(() => {
    const deviceMap = Object.fromEntries(devices.map(d => [d.id, d.name]));
    const map: Record<string, { name: string; count: number; total: number }> = {};
    filteredSales.forEach(s => {
      const name = s.device_id ? (deviceMap[s.device_id] || "Unknown Device") : "No Device";
      if (!map[name]) map[name] = { name, count: 0, total: 0 };
      map[name].count++;
      map[name].total += Number(s.grand_total);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredSales, devices]);

  const handleExportExcel = () => {
    if (tab === "sales") {
      exportToExcel(itemWiseSales.map(s => ({ Item: s.name, Qty: s.qty, Revenue: s.revenue.toFixed(2) })), "sales-report");
    } else if (tab === "stock") {
      exportToExcel(items.map(i => ({ Name: i.name, Stock: Number(i.stock), Price: Number(i.price), Unit: i.unit || "pcs", Manufacturer: i.manufacturer || "" })), "stock-report");
    } else if (tab === "expiry") {
      exportToExcel(expiryItems.map(i => ({ Name: i.name, Batch: i.batch_number || "", Expiry: i.expiry_date, DaysLeft: i.daysLeft, Stock: Number(i.stock) })), "expiry-report");
    } else if (tab === "devices") {
      exportToExcel(deviceWiseSales.map(d => ({ Device: d.name, Orders: d.count, Total: d.total.toFixed(2) })), "device-sales");
    } else {
      exportToExcel(filteredSales.map(s => ({ Invoice: s.invoice_number, Date: new Date(s.created_at).toLocaleDateString(), Payment: s.payment_mode, Amount: Number(s.grand_total).toFixed(2) })), "overview-report");
    }
  };

  const handleExportPDF = () => {
    if (tab === "sales") {
      exportToPDF("Sales Report", ["Item", "Qty", "Revenue"], itemWiseSales.map(s => [s.name, String(s.qty), `₹${s.revenue.toFixed(0)}`]));
    } else if (tab === "stock") {
      exportToPDF("Stock Report", ["Name", "Stock", "Price", "Unit"], items.map(i => [i.name, String(Number(i.stock)), `₹${Number(i.price)}`, i.unit || "pcs"]));
    } else if (tab === "expiry") {
      exportToPDF("Expiry Report", ["Name", "Batch", "Expiry", "Days Left", "Stock"], expiryItems.map(i => [i.name, i.batch_number || "—", i.expiry_date, i.expired ? "EXPIRED" : `${i.daysLeft}d`, String(Number(i.stock))]));
    } else {
      exportToPDF("Overview Report", ["Invoice", "Date", "Payment", "Amount"], filteredSales.map(s => [s.invoice_number, new Date(s.created_at).toLocaleDateString(), s.payment_mode, `₹${Number(s.grand_total).toFixed(0)}`]));
    }
  };

  const tooltipStyle = { backgroundColor: 'hsl(222 44% 10%)', border: '1px solid hsl(215 25% 18%)', borderRadius: '8px', color: 'hsl(210 40% 96%)' };

  return (
    <div className="h-screen overflow-y-auto scrollbar-thin">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2 ml-10 md:ml-0"><BarChart3 className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Reports</h1>
        <div className="flex gap-1.5 mt-3 overflow-x-auto scrollbar-thin">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all capitalize touch-manipulation ${tab === t ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"}`}>
              {t === "overview" && "📊 "}{t === "stock" && "📦 "}{t === "sales" && "💰 "}{t === "expiry" && "📅 "}{t === "devices" && "🖥️ "}{t}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <DateFilterExport onFilter={(from, to) => { setDateFrom(from); setDateTo(to); }} onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} defaultPreset="today" />
        </div>
      </header>

      <div className="p-4 sm:p-6 space-y-6">
        {loading ? <div className="text-center text-muted-foreground py-12">Loading...</div> : <>

          {/* Overview Tab */}
          {tab === "overview" && <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Total Sales</p><p className="text-2xl font-bold text-foreground mt-1">₹{totalSales.toLocaleString()}</p><p className="text-xs text-success">{filteredSales.length} orders</p></div>
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
                    </Pie><Tooltip contentStyle={tooltipStyle} /></PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-muted-foreground text-center py-8">No sales data yet</p>}
              </div>
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Supplier Purchases</h3>
                {supplierWise.length > 0 ? (
                  <div className="space-y-2">
                    {supplierWise.slice(0, 10).map((s, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-border/30">
                        <div><span className="text-sm text-foreground">{s.name}</span><span className="text-xs text-muted-foreground ml-2">{s.count} orders</span></div>
                        <span className="text-sm font-semibold text-primary">₹{s.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-muted-foreground text-center py-8">No purchase data</p>}
              </div>
            </div>
          </>}

          {/* Stock Tab */}
          {tab === "stock" && <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Total Items</p><p className="text-2xl font-bold text-foreground mt-1">{items.length}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Low Stock</p><p className="text-2xl font-bold text-accent mt-1">{lowStockItems.length}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Total Stock Value</p><p className="text-2xl font-bold text-foreground mt-1">₹{items.reduce((s, i) => s + Number(i.stock) * Number(i.price), 0).toLocaleString()}</p></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-accent" /> Low Stock Items ({lowStockItems.length})</h3>
                <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin">
                  {lowStockItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/20">
                      <div>
                        <span className="text-sm text-foreground">{item.name}</span>
                        {item.manufacturer && <span className="text-xs text-muted-foreground ml-2">by {item.manufacturer}</span>}
                      </div>
                      <span className={`text-sm font-semibold ${Number(item.stock) === 0 ? "text-destructive" : "text-accent"}`}>{Number(item.stock)} left</span>
                    </div>
                  ))}
                  {lowStockItems.length === 0 && <p className="text-muted-foreground text-center py-4">All items well stocked ✅</p>}
                </div>
              </div>

              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Stock by Manufacturer</h3>
                {stockByManufacturer.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={stockByManufacturer.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 18%)" />
                      <XAxis type="number" tick={{ fill: 'hsl(210 40% 60%)', fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fill: 'hsl(210 40% 60%)', fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" fill="hsl(187 72% 50%)" radius={[0, 4, 4, 0]} name="Stock Value (₹)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-muted-foreground text-center py-8">No manufacturer data</p>}
              </div>
            </div>
          </>}

          {/* Sales Tab */}
          {tab === "sales" && <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Top Selling Items</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border"><th className="text-left py-2 text-xs text-muted-foreground">Item</th><th className="text-right py-2 text-xs text-muted-foreground">Qty</th><th className="text-right py-2 text-xs text-muted-foreground">Revenue</th></tr></thead>
                    <tbody>
                      {itemWiseSales.map((s, i) => (
                        <tr key={i} className="border-b border-border/30"><td className="py-2 text-foreground">{s.name}</td><td className="py-2 text-right text-muted-foreground">{s.qty}</td><td className="py-2 text-right font-semibold text-primary">₹{s.revenue.toLocaleString()}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {itemWiseSales.length === 0 && <p className="text-muted-foreground text-center py-8">No sales data</p>}
              </div>

              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> HSN-wise Report</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border"><th className="text-left py-2 text-xs text-muted-foreground">HSN</th><th className="text-right py-2 text-xs text-muted-foreground">Qty</th><th className="text-right py-2 text-xs text-muted-foreground">Revenue</th><th className="text-right py-2 text-xs text-muted-foreground">Tax</th></tr></thead>
                    <tbody>
                      {hsnWiseSales.map((h, i) => (
                        <tr key={i} className="border-b border-border/30"><td className="py-2 font-mono text-xs text-foreground">{h.hsn}</td><td className="py-2 text-right text-muted-foreground">{h.qty}</td><td className="py-2 text-right text-foreground">₹{h.revenue.toLocaleString()}</td><td className="py-2 text-right text-accent">₹{h.tax.toFixed(0)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {hsnWiseSales.length === 0 && <p className="text-muted-foreground text-center py-8">No HSN data</p>}
              </div>
            </div>

            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Supplier-wise Purchases</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border"><th className="text-left py-2 text-xs text-muted-foreground">Supplier</th><th className="text-right py-2 text-xs text-muted-foreground">Orders</th><th className="text-right py-2 text-xs text-muted-foreground">Total</th></tr></thead>
                  <tbody>
                    {supplierWise.map((s, i) => (
                      <tr key={i} className="border-b border-border/30"><td className="py-2 text-foreground">{s.name}</td><td className="py-2 text-right text-muted-foreground">{s.count}</td><td className="py-2 text-right font-semibold text-primary">₹{s.total.toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {supplierWise.length === 0 && <p className="text-muted-foreground text-center py-8">No purchase data</p>}
            </div>
          </>}

          {/* Expiry Tab */}
          {tab === "expiry" && <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Expired</p><p className="text-2xl font-bold text-destructive mt-1">{expiryItems.filter(i => i.expired).length}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Expiring in 30 days</p><p className="text-2xl font-bold text-accent mt-1">{expiryItems.filter(i => !i.expired && i.daysLeft <= 30).length}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Expiring in 90 days</p><p className="text-2xl font-bold text-foreground mt-1">{expiryItems.filter(i => !i.expired && i.daysLeft <= 90).length}</p></div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><Calendar className="h-4 w-4 text-accent" /> Expiry Tracker</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border"><th className="text-left py-2 text-xs text-muted-foreground">Item</th><th className="text-left py-2 text-xs text-muted-foreground hidden sm:table-cell">Batch</th><th className="text-left py-2 text-xs text-muted-foreground hidden sm:table-cell">Manufacturer</th><th className="text-right py-2 text-xs text-muted-foreground">Stock</th><th className="text-left py-2 text-xs text-muted-foreground">Expiry</th><th className="text-right py-2 text-xs text-muted-foreground">Days Left</th></tr></thead>
                  <tbody>
                    {expiryItems.map((item, i) => (
                      <tr key={i} className={`border-b border-border/30 ${item.expired ? "bg-destructive/5" : item.daysLeft <= 30 ? "bg-accent/5" : ""}`}>
                        <td className="py-2 text-foreground">{item.name}</td>
                        <td className="py-2 text-muted-foreground font-mono text-xs hidden sm:table-cell">{item.batch_number || "—"}</td>
                        <td className="py-2 text-muted-foreground text-xs hidden sm:table-cell">{item.manufacturer || "—"}</td>
                        <td className="py-2 text-right text-foreground">{Number(item.stock)}</td>
                        <td className="py-2 text-xs text-muted-foreground">{item.expiry_date}</td>
                        <td className="py-2 text-right">
                          <span className={`font-semibold ${item.expired ? "text-destructive" : item.daysLeft <= 30 ? "text-accent" : "text-success"}`}>
                            {item.expired ? "EXPIRED" : `${item.daysLeft}d`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {expiryItems.length === 0 && <p className="text-muted-foreground text-center py-8">No items with expiry dates</p>}
            </div>
          </>}

          {/* Devices Tab */}
          {tab === "devices" && <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Total Devices</p><p className="text-2xl font-bold text-foreground mt-1">{devices.length}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Active Devices</p><p className="text-2xl font-bold text-success mt-1">{devices.filter(d => d.status === "active").length}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Device Sales</p><p className="text-2xl font-bold text-primary mt-1">₹{deviceWiseSales.reduce((s, d) => s + d.total, 0).toLocaleString()}</p></div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><Monitor className="h-4 w-4 text-primary" /> Device-wise Sales</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border"><th className="text-left py-2 text-xs text-muted-foreground">Device</th><th className="text-right py-2 text-xs text-muted-foreground">Orders</th><th className="text-right py-2 text-xs text-muted-foreground">Revenue</th></tr></thead>
                  <tbody>
                    {deviceWiseSales.map((d, i) => (
                      <tr key={i} className="border-b border-border/30"><td className="py-2 text-foreground">{d.name}</td><td className="py-2 text-right text-muted-foreground">{d.count}</td><td className="py-2 text-right font-semibold text-primary">₹{d.total.toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {deviceWiseSales.length === 0 && <p className="text-muted-foreground text-center py-8">No device sales data</p>}
            </div>
          </>}
        </>}
      </div>
    </div>
  );
}
