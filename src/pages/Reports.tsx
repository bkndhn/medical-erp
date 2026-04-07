import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

import { BarChart3, Package, AlertTriangle, Calendar, Building2, FileText, Monitor, Receipt, Eye, X, Printer, MessageSquare, Search, CreditCard, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend } from "recharts";
import DateFilterExport, { exportToExcel, exportToPDF } from "@/components/DateFilterExport";
import { printReceipt, generateWhatsAppText } from "@/lib/printService";

const COLORS = ["hsl(187 72% 50%)", "hsl(37 95% 55%)", "hsl(152 60% 45%)", "hsl(0 72% 55%)", "hsl(270 60% 55%)", "hsl(210 70% 55%)"];
const TABS = ["overview", "bills", "pnl", "stock", "sales", "gst", "payments", "expiry", "devices", "suppliers"] as const;
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
  const [customers, setCustomers] = useState<any[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "overview";
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab as Tab) ? initialTab : "overview");
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [billItems, setBillItems] = useState<any[]>([]);
  const [loadingBillItems, setLoadingBillItems] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    Promise.all([
      supabase.from("sales").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
      supabase.from("sale_items").select("*"),
      supabase.from("items").select("*").eq("tenant_id", tenantId),
      supabase.from("expenses").select("*").eq("tenant_id", tenantId),
      supabase.from("suppliers").select("id, name").eq("tenant_id", tenantId),
      supabase.from("purchases").select("*, supplier_id").eq("tenant_id", tenantId),
      supabase.from("devices").select("*").eq("tenant_id", tenantId),
      supabase.from("customers").select("id, name, phone").eq("tenant_id", tenantId),
      supabase.from("payments").select("*").eq("tenant_id", tenantId),
    ]).then(([{ data: s }, { data: si }, { data: i }, { data: e }, { data: sup }, { data: p }, { data: dev }, { data: cust }, { data: pay }]) => {
      setSales((s as any) || []); setSaleItems((si as any) || []); setItems((i as any) || []);
      setExpenses((e as any) || []); setSuppliers((sup as any) || []); setPurchases((p as any) || []);
      setDevices((dev as any) || []); setCustomers((cust as any) || []); setPaymentRecords((pay as any) || []); setLoading(false);
    });
  }, [tenantId]);

  const filterByDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  const filteredSales = useMemo(() => sales.filter(s => filterByDate(s.created_at)), [sales, dateFrom, dateTo]);
  const filteredSaleItems = useMemo(() => {
    const saleIds = new Set(filteredSales.map(s => s.id));
    return saleItems.filter(si => saleIds.has(si.sale_id));
  }, [saleItems, filteredSales]);
  const filteredExpenses = useMemo(() => expenses.filter(e => filterByDate(e.expense_date || e.created_at)), [expenses, dateFrom, dateTo]);
  const filteredPurchases = useMemo(() => purchases.filter(p => filterByDate(p.created_at)), [purchases, dateFrom, dateTo]);

  const searchFilter = (text: string) => !searchQuery || text.toLowerCase().includes(searchQuery.toLowerCase());

  const totalSales = filteredSales.filter(s => s.status === "completed").reduce((s, x) => s + Number(x.grand_total), 0);
  const totalRefunds = filteredSales.filter(s => s.status === "refunded").reduce((s, x) => s + Number(x.grand_total), 0);
  const netSales = totalSales - totalRefunds;
  const totalExpenses = filteredExpenses.reduce((s, x) => s + Number(x.amount), 0);
  const totalDiscount = filteredSales.reduce((s, x) => s + Number(x.discount || 0), 0);
  const totalTax = filteredSales.filter(s => s.status === "completed").reduce((s, x) => s + Number(x.tax_total || 0), 0);
  const totalPurchases = filteredPurchases.reduce((s, x) => s + Number(x.grand_total), 0);
  const costOfGoods = filteredSaleItems.reduce((s, si) => {
    const item = items.find(i => i.id === si.item_id);
    return s + (Number(item?.cost_price || 0) * Number(si.quantity));
  }, 0);
  const grossProfit = netSales - costOfGoods;
  const netProfit = netSales - totalExpenses - costOfGoods;

  // Use payments table to get actual payment mode breakdown (resolves split payments)
  const filteredPaymentRecords = useMemo(() => {
    const saleIds = new Set(filteredSales.filter(s => s.status === "completed").map(s => s.id));
    return paymentRecords.filter(p => p.sale_id && saleIds.has(p.sale_id));
  }, [paymentRecords, filteredSales]);

  const paymentData = useMemo(() => {
    const breakdown: Record<string, number> = {};
    // Use payment records for accurate mode-wise totals (split payments resolved)
    if (filteredPaymentRecords.length > 0) {
      filteredPaymentRecords.forEach(p => {
        const mode = (p.payment_mode || "cash").toLowerCase();
        if (mode !== "split") { breakdown[mode] = (breakdown[mode] || 0) + Number(p.amount); }
      });
    } else {
      // Fallback: use sales table directly for non-split
      filteredSales.filter(s => s.status === "completed").forEach(s => {
        const mode = (s.payment_mode || "cash").toLowerCase();
        if (mode !== "split") { breakdown[mode] = (breakdown[mode] || 0) + Number(s.grand_total); }
      });
    }
    return Object.entries(breakdown).map(([name, value]) => ({ name, value }));
  }, [filteredSales, filteredPaymentRecords]);

  const paymentWiseReport = useMemo(() => {
    const map: Record<string, { mode: string; count: number; total: number; avgBill: number }> = {};
    if (filteredPaymentRecords.length > 0) {
      filteredPaymentRecords.forEach(p => {
        const mode = (p.payment_mode || "cash").toLowerCase();
        if (mode === "split") return;
        if (!map[mode]) map[mode] = { mode, count: 0, total: 0, avgBill: 0 };
        map[mode].count++; map[mode].total += Number(p.amount);
      });
    } else {
      filteredSales.filter(s => s.status === "completed").forEach(s => {
        const mode = (s.payment_mode || "cash").toLowerCase();
        if (mode === "split") return;
        if (!map[mode]) map[mode] = { mode, count: 0, total: 0, avgBill: 0 };
        map[mode].count++; map[mode].total += Number(s.grand_total);
      });
    }
    Object.values(map).forEach(m => { m.avgBill = m.count > 0 ? m.total / m.count : 0; });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredSales, filteredPaymentRecords]);

  const lowStockItems = useMemo(() => items.filter(i => Number(i.stock) <= (i.low_stock_threshold || 10)).sort((a, b) => Number(a.stock) - Number(b.stock)), [items]);
  const supplierMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s.name])), [suppliers]);
  const customerMap = useMemo(() => Object.fromEntries(customers.map(c => [c.id, c])), [customers]);

  const stockByManufacturer = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    items.forEach(i => {
      const mfr = i.manufacturer || "Unknown";
      if (!map[mfr]) map[mfr] = { count: 0, value: 0 };
      map[mfr].count += Number(i.stock); map[mfr].value += Number(i.stock) * Number(i.price);
    });
    return Object.entries(map).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.value - a.value).slice(0, 15);
  }, [items]);

  const expiryItems = useMemo(() => {
    const today = new Date();
    return items.filter(i => i.expiry_date).map(i => {
      const exp = new Date(i.expiry_date);
      const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const stockVal = Number(i.stock) * Number(i.cost_price || i.price);
      return { ...i, daysLeft, expired: daysLeft <= 0, stockValue: stockVal };
    }).sort((a, b) => a.daysLeft - b.daysLeft);
  }, [items]);

  const itemWiseSales = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    filteredSaleItems.forEach(si => {
      if (!map[si.item_name]) map[si.item_name] = { name: si.item_name, qty: 0, revenue: 0 };
      map[si.item_name].qty += Number(si.quantity); map[si.item_name].revenue += Number(si.total);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 20);
  }, [filteredSaleItems]);

  const hsnWiseSales = useMemo(() => {
    const map: Record<string, { hsn: string; qty: number; revenue: number; tax: number }> = {};
    filteredSaleItems.forEach(si => {
      const item = items.find(i => i.id === si.item_id);
      const hsn = item?.hsn_code || "No HSN";
      if (!map[hsn]) map[hsn] = { hsn, qty: 0, revenue: 0, tax: 0 };
      map[hsn].qty += Number(si.quantity); map[hsn].revenue += Number(si.total); map[hsn].tax += Number(si.tax_amount || 0);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSaleItems, items]);

  const gstWiseReport = useMemo(() => {
    const map: Record<string, { rate: number; taxableValue: number; cgst: number; sgst: number; totalTax: number; items: number }> = {};
    filteredSaleItems.forEach(si => {
      const item = items.find(i => i.id === si.item_id);
      const gstRate = Number(item?.gst_rate || 0);
      const key = `${gstRate}%`;
      if (!map[key]) map[key] = { rate: gstRate, taxableValue: 0, cgst: 0, sgst: 0, totalTax: 0, items: 0 };
      map[key].taxableValue += Number(si.total);
      const tax = Number(si.tax_amount || 0);
      map[key].cgst += tax / 2; map[key].sgst += tax / 2; map[key].totalTax += tax; map[key].items += 1;
    });
    return Object.values(map).sort((a, b) => a.rate - b.rate);
  }, [filteredSaleItems, items]);

  const supplierWise = useMemo(() => {
    const map: Record<string, { name: string; count: number; total: number }> = {};
    filteredPurchases.forEach(p => {
      const name = supplierMap[p.supplier_id] || "Unknown";
      if (!map[name]) map[name] = { name, count: 0, total: 0 };
      map[name].count++; map[name].total += Number(p.grand_total);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredPurchases, supplierMap]);

  const deviceWiseSales = useMemo(() => {
    const deviceMap = Object.fromEntries(devices.map(d => [d.id, d.name]));
    const map: Record<string, { name: string; deviceId: string; count: number; total: number; avgBill: number }> = {};
    filteredSales.filter(s => s.status === "completed").forEach(s => {
      const key = s.device_id || "no_device";
      const name = s.device_id ? (deviceMap[s.device_id] || `Device ${s.device_id.slice(0,6)}`) : "No Device";
      if (!map[key]) map[key] = { name, deviceId: key, count: 0, total: 0, avgBill: 0 };
      map[key].count++; map[key].total += Number(s.grand_total);
    });
    Object.values(map).forEach(d => { d.avgBill = d.count > 0 ? d.total / d.count : 0; });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredSales, devices]);

  // Daily sales trend for P&L
  const dailyTrend = useMemo(() => {
    const salesMap: Record<string, number> = {};
    const expMap: Record<string, number> = {};
    filteredSales.filter(s => s.status === "completed").forEach(s => {
      const d = new Date(s.created_at).toLocaleDateString();
      salesMap[d] = (salesMap[d] || 0) + Number(s.grand_total);
    });
    filteredExpenses.forEach(e => {
      const d = new Date(e.expense_date || e.created_at).toLocaleDateString();
      expMap[d] = (expMap[d] || 0) + Number(e.amount);
    });
    const allDates = [...new Set([...Object.keys(salesMap), ...Object.keys(expMap)])].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return allDates.map(d => ({ date: d, revenue: salesMap[d] || 0, expenses: expMap[d] || 0, profit: (salesMap[d] || 0) - (expMap[d] || 0) }));
  }, [filteredSales, filteredExpenses]);

  // Expense breakdown by category for P&L
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach(e => { map[e.category] = (map[e.category] || 0) + Number(e.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredExpenses]);

  const viewBill = async (sale: any) => {
    setSelectedBill(sale);
    setLoadingBillItems(true);
    const { data } = await supabase.from("sale_items").select("*").eq("sale_id", sale.id);
    setBillItems((data as any) || []);
    setLoadingBillItems(false);
  };

  const printBill = () => {
    if (!selectedBill) return;
    const cust = selectedBill.customer_id ? customerMap[selectedBill.customer_id] : null;
    printReceipt(selectedBill, billItems, undefined, cust ? { name: cust.name, phone: cust.phone } : undefined);
  };

  const shareOnWhatsApp = () => {
    if (!selectedBill) return;
    const cust = selectedBill.customer_id ? customerMap[selectedBill.customer_id] : null;
    const msg = generateWhatsAppText(selectedBill, billItems, cust ? { name: cust.name, phone: cust.phone } : undefined);
    const phone = cust?.phone ? cust.phone.replace(/\D/g, "") : "";
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleExportExcel = () => {
    if (tab === "gst") exportToExcel(gstWiseReport.map(g => ({ "GST Rate": `${g.rate}%`, "Taxable Value": g.taxableValue.toFixed(2), "CGST": g.cgst.toFixed(2), "SGST": g.sgst.toFixed(2), "Total Tax": g.totalTax.toFixed(2), "Items": g.items })), "gst-report");
    else if (tab === "sales") exportToExcel(itemWiseSales.map(s => ({ Item: s.name, Qty: s.qty, Revenue: s.revenue.toFixed(2) })), "sales-report");
    else if (tab === "stock") exportToExcel(items.map(i => ({ Name: i.name, Stock: Number(i.stock), Price: Number(i.price), Unit: i.unit || "pcs" })), "stock-report");
    else if (tab === "bills") exportToExcel(filteredSales.map(s => ({ Invoice: s.invoice_number, Date: new Date(s.created_at).toLocaleDateString(), Payment: s.payment_mode, Status: s.status, Amount: Number(s.grand_total).toFixed(2) })), "bills");
    else if (tab === "expiry") exportToExcel(expiryItems.map(i => ({ Name: i.name, Batch: i.batch_number || "", Manufacturer: i.manufacturer || "", Stock: Number(i.stock), MRP: Number(i.mrp).toFixed(2), "Stock Value": i.stockValue.toFixed(2), Expiry: i.expiry_date, DaysLeft: i.daysLeft })), "expiry-report");
    else if (tab === "devices") exportToExcel(deviceWiseSales.map(d => ({ Device: d.name, Orders: d.count, Total: d.total.toFixed(2), "Avg Bill": d.avgBill.toFixed(2) })), "device-sales");
    else if (tab === "payments") exportToExcel(paymentWiseReport.map(p => ({ Mode: p.mode.toUpperCase(), Transactions: p.count, Total: p.total.toFixed(2), "Avg Bill": p.avgBill.toFixed(2) })), "payment-report");
    else if (tab === "pnl") exportToExcel([{ "Net Sales": netSales.toFixed(2), "Cost of Goods": costOfGoods.toFixed(2), "Gross Profit": grossProfit.toFixed(2), Expenses: totalExpenses.toFixed(2), "Net Profit": netProfit.toFixed(2), Purchases: totalPurchases.toFixed(2), Refunds: totalRefunds.toFixed(2) }], "pnl-report");
    else exportToExcel(filteredSales.map(s => ({ Invoice: s.invoice_number, Date: new Date(s.created_at).toLocaleDateString(), Payment: s.payment_mode, Amount: Number(s.grand_total).toFixed(2) })), "overview-report");
  };

  const handleExportPDF = () => {
    if (tab === "gst") exportToPDF("GST Report", ["Rate", "Taxable", "CGST", "SGST", "Total Tax", "Items"], gstWiseReport.map(g => [`${g.rate}%`, `₹${g.taxableValue.toFixed(0)}`, `₹${g.cgst.toFixed(0)}`, `₹${g.sgst.toFixed(0)}`, `₹${g.totalTax.toFixed(0)}`, String(g.items)]));
    else if (tab === "pnl") exportToPDF("P&L Report", ["Metric", "Amount"], [["Net Sales", `₹${netSales.toFixed(0)}`], ["Refunds", `₹${totalRefunds.toFixed(0)}`], ["COGS", `₹${costOfGoods.toFixed(0)}`], ["Gross Profit", `₹${grossProfit.toFixed(0)}`], ["Expenses", `₹${totalExpenses.toFixed(0)}`], ["Purchases", `₹${totalPurchases.toFixed(0)}`], ["Net Profit", `₹${netProfit.toFixed(0)}`]]);
    else if (tab === "expiry") exportToPDF("Expiry Report", ["Name", "Batch", "Stock", "MRP", "Value", "Expiry", "Days"], expiryItems.map(i => [i.name, i.batch_number || "—", String(Number(i.stock)), `₹${Number(i.mrp).toFixed(0)}`, `₹${i.stockValue.toFixed(0)}`, i.expiry_date, i.expired ? "EXPIRED" : `${i.daysLeft}d`]));
    else if (tab === "payments") exportToPDF("Payment Report", ["Mode", "Transactions", "Total", "Avg Bill"], paymentWiseReport.map(p => [p.mode.toUpperCase(), String(p.count), `₹${p.total.toFixed(0)}`, `₹${p.avgBill.toFixed(0)}`]));
    else if (tab === "devices") exportToPDF("Device Sales", ["Device", "Orders", "Revenue", "Avg Bill"], deviceWiseSales.map(d => [d.name, String(d.count), `₹${d.total.toFixed(0)}`, `₹${d.avgBill.toFixed(0)}`]));
    else exportToPDF("Sales Report", ["Invoice", "Date", "Payment", "Amount"], filteredSales.map(s => [s.invoice_number, new Date(s.created_at).toLocaleDateString(), s.payment_mode, `₹${Number(s.grand_total).toFixed(0)}`]));
  };

  const tooltipStyle = { backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' };
  const tabIcons: Record<Tab, string> = { overview: "📊", bills: "🧾", pnl: "📈", stock: "📦", sales: "💰", gst: "🧾", payments: "💳", expiry: "📅", devices: "🖥️", suppliers: "🏭" };

  const searchedBills = useMemo(() => {
    if (!searchQuery) return filteredSales;
    const q = searchQuery.toLowerCase();
    return filteredSales.filter(s =>
      s.invoice_number?.toLowerCase().includes(q) || s.payment_mode?.toLowerCase().includes(q) || s.status?.toLowerCase().includes(q) || String(s.grand_total).includes(q)
    );
  }, [filteredSales, searchQuery]);

  return (
    <div className="h-screen overflow-y-auto scrollbar-thin pb-20 md:pb-0">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2 ml-10 md:ml-0"><BarChart3 className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Reports</h1>
        <div className="flex gap-1.5 mt-3 overflow-x-auto scrollbar-thin">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all capitalize touch-manipulation ${tab === t ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"}`}>
              {tabIcons[t]} {t === "pnl" ? "P&L" : t}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <DateFilterExport onFilter={(from, to) => { setDateFrom(from); setDateTo(to); }} onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} defaultPreset="today" />
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search reports..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 space-y-6">
        {loading ? <div className="text-center text-muted-foreground py-12">Loading...</div> : <>

          {/* Overview */}
          {tab === "overview" && <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Sales</p><p className="text-2xl font-bold text-foreground mt-1">₹{netSales.toLocaleString()}</p><p className="text-xs text-success">{filteredSales.filter(s => s.status === "completed").length} orders</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Expenses</p><p className="text-2xl font-bold text-foreground mt-1">₹{totalExpenses.toLocaleString()}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Total Tax</p><p className="text-2xl font-bold text-accent mt-1">₹{totalTax.toLocaleString()}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Net Profit</p><p className={`text-2xl font-bold mt-1 ${netProfit >= 0 ? "text-success" : "text-destructive"}`}>₹{netProfit.toLocaleString()}</p></div>
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
                ) : <p className="text-muted-foreground text-center py-8">No data</p>}
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
                ) : <p className="text-muted-foreground text-center py-8">No data</p>}
              </div>
            </div>
          </>}

          {/* P&L - Complete */}
          {tab === "pnl" && <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Net Sales</p><p className="text-2xl font-bold text-success mt-1">₹{netSales.toLocaleString()}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">COGS</p><p className="text-2xl font-bold text-foreground mt-1">₹{costOfGoods.toLocaleString()}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Gross Profit</p><p className={`text-2xl font-bold mt-1 ${grossProfit >= 0 ? "text-success" : "text-destructive"}`}>₹{grossProfit.toLocaleString()}</p><p className="text-xs text-muted-foreground">{netSales > 0 ? ((grossProfit / netSales) * 100).toFixed(1) : 0}% margin</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase flex items-center gap-1"><DollarSign className="h-3 w-3" /> Net Profit</p><p className={`text-2xl font-bold mt-1 ${netProfit >= 0 ? "text-success" : "text-destructive"}`}>₹{netProfit.toLocaleString()}</p></div>
            </div>

            {/* P&L Statement */}
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Profit & Loss Statement</h3>
              <div className="space-y-1">
                <div className="flex justify-between py-2 text-sm"><span className="text-foreground font-medium">Gross Sales</span><span className="text-foreground font-semibold">₹{totalSales.toLocaleString()}</span></div>
                <div className="flex justify-between py-2 text-sm"><span className="text-muted-foreground pl-4">(-) Refunds / Returns</span><span className="text-destructive">₹{totalRefunds.toLocaleString()}</span></div>
                <div className="flex justify-between py-2 text-sm"><span className="text-muted-foreground pl-4">(-) Discounts Given</span><span className="text-destructive">₹{totalDiscount.toLocaleString()}</span></div>
                <div className="flex justify-between py-2 text-sm border-t border-border font-medium"><span className="text-foreground">Net Sales Revenue</span><span className="text-success">₹{netSales.toLocaleString()}</span></div>
                <div className="flex justify-between py-2 text-sm"><span className="text-muted-foreground pl-4">(-) Cost of Goods Sold</span><span className="text-foreground">₹{costOfGoods.toLocaleString()}</span></div>
                <div className="flex justify-between py-2 text-sm border-t border-border font-medium"><span className="text-foreground">Gross Profit</span><span className={grossProfit >= 0 ? "text-success" : "text-destructive"}>₹{grossProfit.toLocaleString()}</span></div>
                <div className="h-2" />
                <div className="flex justify-between py-2 text-sm font-medium text-foreground"><span>Operating Expenses</span><span className="text-destructive">₹{totalExpenses.toLocaleString()}</span></div>
                {expenseByCategory.map((ec, i) => (
                  <div key={i} className="flex justify-between py-1 text-sm"><span className="text-muted-foreground pl-4 capitalize">{ec.name}</span><span className="text-muted-foreground">₹{ec.value.toLocaleString()}</span></div>
                ))}
                <div className="flex justify-between py-2 text-sm"><span className="text-foreground">Purchases</span><span className="text-foreground">₹{totalPurchases.toLocaleString()}</span></div>
                <div className="flex justify-between py-2 text-sm"><span className="text-foreground">Tax Collected (GST)</span><span className="text-accent">₹{totalTax.toLocaleString()}</span></div>
                <div className="h-px bg-border my-2" />
                <div className="flex justify-between py-3 text-lg font-bold border-t-2 border-border"><span className="text-foreground">Net Profit / Loss</span><span className={netProfit >= 0 ? "text-success" : "text-destructive"}>₹{netProfit.toLocaleString()}</span></div>
              </div>
            </div>

            {/* Daily Revenue vs Expenses trend */}
            {dailyTrend.length > 0 && (
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Revenue vs Expenses Trend</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `₹${v.toFixed(0)}`} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(152 60% 45%)" strokeWidth={2} name="Revenue" dot={false} />
                    <Line type="monotone" dataKey="expenses" stroke="hsl(0 72% 55%)" strokeWidth={2} name="Expenses" dot={false} />
                    <Line type="monotone" dataKey="profit" stroke="hsl(187 72% 50%)" strokeWidth={2} name="Profit" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Expense breakdown pie */}
            {expenseByCategory.length > 0 && (
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Expense Breakdown</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart><Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie><Tooltip contentStyle={tooltipStyle} /></PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </>}

          {/* Bills Tab */}
          {tab === "bills" && <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Bills</p><p className="text-2xl font-bold text-foreground mt-1">{searchedBills.length}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Revenue</p><p className="text-2xl font-bold text-primary mt-1">₹{searchedBills.filter(s => s.status === "completed").reduce((s, x) => s + Number(x.grand_total), 0).toLocaleString()}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Cost</p><p className="text-2xl font-bold text-foreground mt-1">₹{searchedBills.filter(s => s.status === "completed").reduce((s, x) => s + (Number(x.cost_total) || 0), 0).toLocaleString()}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Profit</p><p className={`text-2xl font-bold mt-1 ${searchedBills.filter(s => s.status === "completed").reduce((s, x) => s + Number(x.grand_total) - (Number(x.cost_total) || 0), 0) >= 0 ? "text-success" : "text-destructive"}`}>₹{searchedBills.filter(s => s.status === "completed").reduce((s, x) => s + Number(x.grand_total) - (Number(x.cost_total) || 0), 0).toLocaleString()}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Discount Given</p><p className="text-2xl font-bold text-accent mt-1">₹{totalDiscount.toLocaleString()}</p></div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" /> All Bills</h3>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-sm min-w-[800px]">
                  <thead><tr className="border-b border-border">
                    <th className="text-left py-2 text-xs text-muted-foreground">Invoice</th>
                    <th className="text-left py-2 text-xs text-muted-foreground">Date</th>
                    <th className="text-left py-2 text-xs text-muted-foreground">Customer</th>
                    <th className="text-left py-2 text-xs text-muted-foreground">Payment</th>
                    <th className="text-left py-2 text-xs text-muted-foreground">Status</th>
                    <th className="text-right py-2 text-xs text-muted-foreground">Amount</th>
                    <th className="text-right py-2 text-xs text-muted-foreground">Cost</th>
                    <th className="text-right py-2 text-xs text-muted-foreground">Profit</th>
                    <th className="text-center py-2 text-xs text-muted-foreground">View</th>
                  </tr></thead>
                  <tbody>{searchedBills.map(s => {
                    const cust = s.customer_id ? customerMap[s.customer_id] : null;
                    const cost = Number(s.cost_total) || 0;
                    const profit = Number(s.grand_total) - cost;
                    return (
                      <tr key={s.id} className="border-b border-border/30 hover:bg-muted/20 cursor-pointer" onClick={() => viewBill(s)}>
                        <td className="py-2 font-mono text-xs text-primary">{s.invoice_number}</td>
                        <td className="py-2 text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</td>
                        <td className="py-2 text-xs text-foreground">{cust?.name || "—"}</td>
                        <td className="py-2"><span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground uppercase">{s.payment_mode}</span></td>
                        <td className="py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${s.status === "completed" ? "bg-success/10 text-success" : s.status === "refunded" ? "bg-accent/10 text-accent" : s.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{s.status}</span></td>
                        <td className="py-2 text-right font-semibold text-foreground">₹{Number(s.grand_total).toFixed(0)}</td>
                        <td className="py-2 text-right text-xs text-muted-foreground">{cost > 0 ? `₹${cost.toFixed(0)}` : "—"}</td>
                        <td className={`py-2 text-right text-xs font-semibold ${profit >= 0 ? "text-success" : "text-destructive"}`}>{cost > 0 ? `₹${profit.toFixed(0)}` : "—"}</td>
                        <td className="py-2 text-center"><Eye className="h-4 w-4 text-muted-foreground inline hover:text-primary" /></td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
              {searchedBills.length === 0 && <p className="text-muted-foreground text-center py-8">No bills found</p>}
            </div>
          </>}

          {/* Stock */}
          {tab === "stock" && <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Total Items</p><p className="text-2xl font-bold text-foreground mt-1">{items.length}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Low Stock</p><p className="text-2xl font-bold text-accent mt-1">{lowStockItems.length}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Stock Value</p><p className="text-2xl font-bold text-foreground mt-1">₹{items.reduce((s, i) => s + Number(i.stock) * Number(i.price), 0).toLocaleString()}</p></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-accent" /> Low Stock ({lowStockItems.length})</h3>
                <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin">
                  {lowStockItems.filter(i => searchFilter(i.name)).map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/20">
                      <span className="text-sm text-foreground">{item.name}</span>
                      <span className={`text-sm font-semibold ${Number(item.stock) === 0 ? "text-destructive" : "text-accent"}`}>{Number(item.stock)} left</span>
                    </div>
                  ))}
                  {lowStockItems.length === 0 && <p className="text-muted-foreground text-center py-4">All stocked ✅</p>}
                </div>
              </div>
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Stock by Manufacturer</h3>
                {stockByManufacturer.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={stockByManufacturer.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Stock Value (₹)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-muted-foreground text-center py-8">No data</p>}
              </div>
            </div>
          </>}

          {/* Sales */}
          {tab === "sales" && <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Top Selling Items</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border"><th className="text-left py-2 text-xs text-muted-foreground">Item</th><th className="text-right py-2 text-xs text-muted-foreground">Qty</th><th className="text-right py-2 text-xs text-muted-foreground">Revenue</th></tr></thead>
                    <tbody>{itemWiseSales.filter(s => searchFilter(s.name)).map((s, i) => (
                      <tr key={i} className="border-b border-border/30"><td className="py-2 text-foreground">{s.name}</td><td className="py-2 text-right text-muted-foreground">{s.qty}</td><td className="py-2 text-right font-semibold text-primary">₹{s.revenue.toLocaleString()}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">HSN-wise Report</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border"><th className="text-left py-2 text-xs text-muted-foreground">HSN</th><th className="text-right py-2 text-xs text-muted-foreground">Qty</th><th className="text-right py-2 text-xs text-muted-foreground">Revenue</th><th className="text-right py-2 text-xs text-muted-foreground">Tax</th></tr></thead>
                    <tbody>{hsnWiseSales.map((h, i) => (
                      <tr key={i} className="border-b border-border/30"><td className="py-2 font-mono text-xs text-foreground">{h.hsn}</td><td className="py-2 text-right text-muted-foreground">{h.qty}</td><td className="py-2 text-right text-foreground">₹{h.revenue.toLocaleString()}</td><td className="py-2 text-right text-accent">₹{h.tax.toFixed(0)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Supplier-wise Purchases</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border"><th className="text-left py-2 text-xs text-muted-foreground">Supplier</th><th className="text-right py-2 text-xs text-muted-foreground">Orders</th><th className="text-right py-2 text-xs text-muted-foreground">Total</th></tr></thead>
                  <tbody>{supplierWise.filter(s => searchFilter(s.name)).map((s, i) => (
                    <tr key={i} className="border-b border-border/30"><td className="py-2 text-foreground">{s.name}</td><td className="py-2 text-right text-muted-foreground">{s.count}</td><td className="py-2 text-right font-semibold text-primary">₹{s.total.toLocaleString()}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </>}

          {/* GST */}
          {tab === "gst" && <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Total Taxable</p><p className="text-2xl font-bold text-foreground mt-1">₹{gstWiseReport.reduce((s, g) => s + g.taxableValue, 0).toLocaleString()}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Total CGST</p><p className="text-2xl font-bold text-accent mt-1">₹{gstWiseReport.reduce((s, g) => s + g.cgst, 0).toFixed(0)}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Total SGST</p><p className="text-2xl font-bold text-accent mt-1">₹{gstWiseReport.reduce((s, g) => s + g.sgst, 0).toFixed(0)}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Total Tax</p><p className="text-2xl font-bold text-primary mt-1">₹{gstWiseReport.reduce((s, g) => s + g.totalTax, 0).toFixed(0)}</p></div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" /> GST Rate-wise Summary</h3>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-sm min-w-[700px]">
                    <th className="text-right py-2 text-xs text-muted-foreground">Items</th>
                    <th className="text-right py-2 text-xs text-muted-foreground">Taxable Value</th>
                    <th className="text-right py-2 text-xs text-muted-foreground">CGST</th>
                    <th className="text-right py-2 text-xs text-muted-foreground">SGST</th>
                    <th className="text-right py-2 text-xs text-muted-foreground">Total Tax</th>
                  </tr></thead>
                  <tbody>
                    {gstWiseReport.map((g, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-2 font-semibold text-foreground">{g.rate}%</td>
                        <td className="py-2 text-right text-muted-foreground">{g.items}</td>
                        <td className="py-2 text-right text-foreground">₹{g.taxableValue.toLocaleString()}</td>
                        <td className="py-2 text-right text-accent">₹{g.cgst.toFixed(0)}</td>
                        <td className="py-2 text-right text-accent">₹{g.sgst.toFixed(0)}</td>
                        <td className="py-2 text-right font-semibold text-primary">₹{g.totalTax.toFixed(0)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border font-bold">
                      <td className="py-2 text-foreground">TOTAL</td>
                      <td className="py-2 text-right text-foreground">{gstWiseReport.reduce((s, g) => s + g.items, 0)}</td>
                      <td className="py-2 text-right text-foreground">₹{gstWiseReport.reduce((s, g) => s + g.taxableValue, 0).toLocaleString()}</td>
                      <td className="py-2 text-right text-accent">₹{gstWiseReport.reduce((s, g) => s + g.cgst, 0).toFixed(0)}</td>
                      <td className="py-2 text-right text-accent">₹{gstWiseReport.reduce((s, g) => s + g.sgst, 0).toFixed(0)}</td>
                      <td className="py-2 text-right text-primary">₹{gstWiseReport.reduce((s, g) => s + g.totalTax, 0).toFixed(0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {gstWiseReport.length === 0 && <p className="text-muted-foreground text-center py-8">No GST data for selected period</p>}
            </div>
            {gstWiseReport.length > 0 && (
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Tax Collection by Rate</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={gstWiseReport}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="rate" tickFormatter={v => `${v}%`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `₹${value.toFixed(0)}`} />
                    <Bar dataKey="cgst" fill="hsl(187 72% 50%)" name="CGST" stackId="tax" />
                    <Bar dataKey="sgst" fill="hsl(37 95% 55%)" name="SGST" stackId="tax" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>}

          {/* Payment-wise Report */}
          {tab === "payments" && <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Total Revenue</p><p className="text-2xl font-bold text-primary mt-1">₹{totalSales.toLocaleString()}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Payment Modes</p><p className="text-2xl font-bold text-foreground mt-1">{paymentWiseReport.length}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Total Bills</p><p className="text-2xl font-bold text-foreground mt-1">{filteredSales.filter(s => s.status === "completed").length}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Avg Bill</p><p className="text-2xl font-bold text-accent mt-1">₹{filteredSales.filter(s => s.status === "completed").length > 0 ? (totalSales / filteredSales.filter(s => s.status === "completed").length).toFixed(0) : 0}</p></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Payment Mode Summary</h3>
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full text-sm min-w-[600px]">
                      <th className="text-right py-2 text-xs text-muted-foreground">Bills</th>
                      <th className="text-right py-2 text-xs text-muted-foreground">Total</th>
                      <th className="text-right py-2 text-xs text-muted-foreground">Avg Bill</th>
                      <th className="text-right py-2 text-xs text-muted-foreground">Share %</th>
                    </tr></thead>
                    <tbody>
                      {paymentWiseReport.map((p, i) => (
                        <tr key={i} className="border-b border-border/30">
                          <td className="py-2"><span className="px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary uppercase">{p.mode}</span></td>
                          <td className="py-2 text-right text-muted-foreground">{p.count}</td>
                          <td className="py-2 text-right font-semibold text-foreground">₹{p.total.toLocaleString()}</td>
                          <td className="py-2 text-right text-muted-foreground">₹{p.avgBill.toFixed(0)}</td>
                          <td className="py-2 text-right text-accent">{totalSales > 0 ? ((p.total / totalSales) * 100).toFixed(1) : 0}%</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-border font-bold">
                        <td className="py-2 text-foreground">TOTAL</td>
                        <td className="py-2 text-right text-foreground">{filteredSales.filter(s => s.status === "completed").length}</td>
                        <td className="py-2 text-right text-primary">₹{totalSales.toLocaleString()}</td>
                        <td className="py-2 text-right text-foreground">₹{filteredSales.filter(s => s.status === "completed").length > 0 ? (totalSales / filteredSales.filter(s => s.status === "completed").length).toFixed(0) : 0}</td>
                        <td className="py-2 text-right text-foreground">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {paymentWiseReport.length === 0 && <p className="text-muted-foreground text-center py-8">No payment data</p>}
              </div>
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Payment Distribution</h3>
                {paymentData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={paymentWiseReport}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="mode" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => `₹${value.toFixed(0)}`} />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Total (₹)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-muted-foreground text-center py-8">No data</p>}
              </div>
            </div>
          </>}

          {/* Expiry - Fixed columns */}
          {tab === "expiry" && <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Expired</p><p className="text-2xl font-bold text-destructive mt-1">{expiryItems.filter(i => i.expired).length}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Expiring 30d</p><p className="text-2xl font-bold text-accent mt-1">{expiryItems.filter(i => !i.expired && i.daysLeft <= 30).length}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Expiring 90d</p><p className="text-2xl font-bold text-foreground mt-1">{expiryItems.filter(i => !i.expired && i.daysLeft <= 90).length}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">At-Risk Value</p><p className="text-2xl font-bold text-destructive mt-1">₹{expiryItems.filter(i => i.daysLeft <= 90).reduce((s, i) => s + i.stockValue, 0).toLocaleString()}</p></div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4"><Calendar className="h-4 w-4 text-accent inline mr-2" />Expiry Tracker</h3>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-sm min-w-[900px]">
                  <thead><tr className="border-b border-border">
                    <th className="text-left py-2 text-xs text-muted-foreground w-[18%]">Item</th>
                    <th className="text-left py-2 text-xs text-muted-foreground w-[8%]">Batch</th>
                    <th className="text-left py-2 text-xs text-muted-foreground w-[12%]">Manufacturer</th>
                    <th className="text-left py-2 text-xs text-muted-foreground w-[10%]">Supplier</th>
                    <th className="text-right py-2 text-xs text-muted-foreground w-[8%]">Stock</th>
                    <th className="text-right py-2 text-xs text-muted-foreground w-[8%]">MRP</th>
                    <th className="text-right py-2 text-xs text-muted-foreground w-[10%]">Value</th>
                    <th className="text-left py-2 text-xs text-muted-foreground w-[12%]">Expiry Date</th>
                    <th className="text-right py-2 text-xs text-muted-foreground w-[10%]">Days Left</th>
                  </tr></thead>
                  <tbody>{expiryItems.filter(i => searchFilter(i.name)).map((item, i) => (
                    <tr key={i} className={`border-b border-border/30 ${item.expired ? "bg-destructive/5" : item.daysLeft <= 30 ? "bg-accent/5" : ""}`}>
                      <td className="py-2 text-foreground text-xs">{item.name}</td>
                      <td className="py-2 text-muted-foreground font-mono text-xs">{item.batch_number || "—"}</td>
                      <td className="py-2 text-muted-foreground text-xs">{item.manufacturer || "—"}</td>
                      <td className="py-2 text-muted-foreground text-xs">{item.supplier_id ? (suppliers.find((s: any) => s.id === item.supplier_id)?.name || "—") : "—"}</td>
                      <td className="py-2 text-right text-foreground font-medium text-xs">{Number(item.stock)}</td>
                      <td className="py-2 text-right text-muted-foreground text-xs">₹{Number(item.mrp).toFixed(0)}</td>
                      <td className="py-2 text-right text-foreground font-medium text-xs">₹{item.stockValue.toFixed(0)}</td>
                      <td className="py-2 text-xs text-muted-foreground">{item.expiry_date}</td>
                      <td className="py-2 text-right"><span className={`font-semibold text-xs ${item.expired ? "text-destructive" : item.daysLeft <= 30 ? "text-accent" : item.daysLeft <= 90 ? "text-foreground" : "text-success"}`}>{item.expired ? "EXPIRED" : `${item.daysLeft}d`}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {expiryItems.length === 0 && <p className="text-muted-foreground text-center py-8">No expiry data</p>}
            </div>
          </>}

          {/* Devices - Enhanced */}
          {tab === "devices" && <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Total Devices</p><p className="text-2xl font-bold text-foreground mt-1">{devices.length}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Active</p><p className="text-2xl font-bold text-success mt-1">{devices.filter(d => d.status === "active").length}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Revenue</p><p className="text-2xl font-bold text-primary mt-1">₹{deviceWiseSales.reduce((s, d) => s + d.total, 0).toLocaleString()}</p></div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4"><Monitor className="h-4 w-4 text-primary inline mr-2" />Device-wise Sales</h3>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-sm min-w-[600px]">
                    <th className="text-right py-2 text-xs text-muted-foreground">Orders</th>
                    <th className="text-right py-2 text-xs text-muted-foreground">Revenue</th>
                    <th className="text-right py-2 text-xs text-muted-foreground">Avg Bill</th>
                    <th className="text-right py-2 text-xs text-muted-foreground">Share %</th>
                  </tr></thead>
                  <tbody>{deviceWiseSales.map((d, i) => {
                    const totalDevRev = deviceWiseSales.reduce((s, x) => s + x.total, 0);
                    return (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-2 text-foreground">{d.name}</td>
                        <td className="py-2 text-right text-muted-foreground">{d.count}</td>
                        <td className="py-2 text-right font-semibold text-primary">₹{d.total.toLocaleString()}</td>
                        <td className="py-2 text-right text-muted-foreground">₹{d.avgBill.toFixed(0)}</td>
                        <td className="py-2 text-right text-accent">{totalDevRev > 0 ? ((d.total / totalDevRev) * 100).toFixed(1) : 0}%</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
              {deviceWiseSales.length === 0 && <p className="text-muted-foreground text-center py-8">No data</p>}
            </div>
            {deviceWiseSales.length > 0 && (
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Device Revenue Distribution</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart><Pie data={deviceWiseSales} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {deviceWiseSales.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `₹${v.toFixed(0)}`} /></PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </>}

          {/* Suppliers & Purchases Tab */}
          {tab === "suppliers" && <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Total Suppliers</p><p className="text-2xl font-bold text-foreground mt-1">{suppliers.length}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Total Purchases</p><p className="text-2xl font-bold text-primary mt-1">₹{totalPurchases.toLocaleString()}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Purchase Orders</p><p className="text-2xl font-bold text-foreground mt-1">{filteredPurchases.length}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Avg Purchase</p><p className="text-2xl font-bold text-accent mt-1">₹{filteredPurchases.length > 0 ? (totalPurchases / filteredPurchases.length).toFixed(0) : 0}</p></div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Supplier-wise Purchase Summary</h3>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-sm min-w-[600px]">
                  <thead><tr className="border-b border-border">
                    <th className="text-left py-2 text-xs text-muted-foreground">Supplier</th>
                    <th className="text-right py-2 text-xs text-muted-foreground">Orders</th>
                    <th className="text-right py-2 text-xs text-muted-foreground">Total</th>
                    <th className="text-right py-2 text-xs text-muted-foreground">Avg Order</th>
                    <th className="text-right py-2 text-xs text-muted-foreground">Share %</th>
                  </tr></thead>
                  <tbody>
                    {supplierWise.filter(s => searchFilter(s.name)).map((s, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-2 text-foreground font-medium">{s.name}</td>
                        <td className="py-2 text-right text-muted-foreground">{s.count}</td>
                        <td className="py-2 text-right font-semibold text-primary">₹{s.total.toLocaleString()}</td>
                        <td className="py-2 text-right text-muted-foreground">₹{s.count > 0 ? (s.total / s.count).toFixed(0) : 0}</td>
                        <td className="py-2 text-right text-accent">{totalPurchases > 0 ? ((s.total / totalPurchases) * 100).toFixed(1) : 0}%</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border font-bold">
                      <td className="py-2 text-foreground">TOTAL</td>
                      <td className="py-2 text-right text-foreground">{filteredPurchases.length}</td>
                      <td className="py-2 text-right text-primary">₹{totalPurchases.toLocaleString()}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {supplierWise.length === 0 && <p className="text-muted-foreground text-center py-8">No purchase data</p>}
            </div>
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">All Purchase Orders</h3>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-sm min-w-[700px]">
                  <thead><tr className="border-b border-border">
                    <th className="text-left py-2 text-xs text-muted-foreground">Date</th>
                    <th className="text-left py-2 text-xs text-muted-foreground">Supplier</th>
                    <th className="text-left py-2 text-xs text-muted-foreground">Status</th>
                    <th className="text-right py-2 text-xs text-muted-foreground">Amount</th>
                  </tr></thead>
                  <tbody>
                    {filteredPurchases.filter(p => searchFilter(supplierMap[p.supplier_id] || "")).map((p, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-2 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                        <td className="py-2 text-foreground">{supplierMap[p.supplier_id] || "Unknown"}</td>
                        <td className="py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${p.status === "received" ? "bg-success/10 text-success" : p.status === "ordered" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}`}>{p.status}</span></td>
                        <td className="py-2 text-right font-semibold text-foreground">₹{Number(p.grand_total).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredPurchases.length === 0 && <p className="text-muted-foreground text-center py-8">No purchases</p>}
            </div>
          </>}
        </>}
      </div>

      {/* Bill Detail Modal */}
      {selectedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setSelectedBill(null)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto scrollbar-thin animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">{selectedBill.invoice_number}</h3>
                <p className="text-xs text-muted-foreground">{new Date(selectedBill.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedBill(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>

            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${selectedBill.status === "completed" ? "bg-success/10 text-success" : selectedBill.status === "refunded" ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"}`}>{selectedBill.status}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground uppercase">{selectedBill.payment_mode}</span>
            </div>

            {selectedBill.customer_id && customerMap[selectedBill.customer_id] && (
              <div className="mb-3 p-2 rounded-lg bg-muted/30 border border-border/30">
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="text-sm font-medium text-foreground">{customerMap[selectedBill.customer_id].name}</p>
                {customerMap[selectedBill.customer_id].phone && <p className="text-xs text-muted-foreground">{customerMap[selectedBill.customer_id].phone}</p>}
              </div>
            )}

            {loadingBillItems ? <div className="text-center text-muted-foreground py-8">Loading items...</div> : (
              <table className="w-full text-sm mb-4">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-2 text-xs text-muted-foreground">Item</th>
                  <th className="text-right py-2 text-xs text-muted-foreground">Qty</th>
                  <th className="text-right py-2 text-xs text-muted-foreground">Price</th>
                  <th className="text-right py-2 text-xs text-muted-foreground">Total</th>
                </tr></thead>
                <tbody>
                  {billItems.map(si => (
                    <tr key={si.id} className="border-b border-border/30">
                      <td className="py-2 text-foreground text-xs">{si.item_name}</td>
                      <td className="py-2 text-right text-muted-foreground text-xs">{si.quantity}</td>
                      <td className="py-2 text-right text-muted-foreground text-xs">₹{Number(si.unit_price).toFixed(2)}</td>
                      <td className="py-2 text-right font-medium text-foreground text-xs">₹{Number(si.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="space-y-1 border-t border-border pt-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="text-foreground">₹{Number(selectedBill.subtotal).toFixed(2)}</span></div>
              {Number(selectedBill.discount || 0) > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Discount</span><span className="text-success">-₹{Number(selectedBill.discount).toFixed(2)}</span></div>}
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">GST</span><span className="text-foreground">₹{Number(selectedBill.tax_total || 0).toFixed(2)}</span></div>
              <div className="h-px bg-border my-1" />
              <div className="flex justify-between text-lg font-bold"><span className="text-foreground">Total</span><span className="text-primary">₹{Number(selectedBill.grand_total).toFixed(2)}</span></div>
              {Number(selectedBill.amount_paid || 0) > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Paid</span><span className="text-success">₹{Number(selectedBill.amount_paid).toFixed(2)}</span></div>}
              {Number(selectedBill.change_amount || 0) > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Change</span><span className="text-accent">₹{Number(selectedBill.change_amount).toFixed(2)}</span></div>}
            </div>

            <div className="flex gap-3 mt-4 pt-3 border-t border-border">
              <button onClick={printBill} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 touch-manipulation">
                <Printer className="h-4 w-4" /> Print
              </button>
              <button onClick={shareOnWhatsApp} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-success/10 text-success text-sm font-medium hover:bg-success/20 touch-manipulation">
                <MessageSquare className="h-4 w-4" /> WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
