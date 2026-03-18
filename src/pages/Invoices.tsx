import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Search, Eye, X, Printer, MessageSquare } from "lucide-react";
import DateFilterExport, { exportToExcel, exportToPDF } from "@/components/DateFilterExport";
import { printReceipt } from "@/lib/printService";

export default function Invoices() {
  const { tenantId } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    supabase.from("sales").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false })
      .then(({ data }) => { setSales((data as any) || []); setLoading(false); });
  }, [tenantId]);

  const filtered = useMemo(() => {
    return sales.filter(s => {
      if (search) {
        const q = search.toLowerCase();
        if (!s.invoice_number?.toLowerCase().includes(q) && !s.payment_mode?.toLowerCase().includes(q) && !s.status?.toLowerCase().includes(q)) return false;
      }
      if (dateFrom) {
        const d = new Date(s.created_at);
        if (d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }
      return true;
    });
  }, [sales, search, dateFrom, dateTo]);

  const viewInvoice = async (sale: any) => {
    setSelectedSale(sale);
    setLoadingItems(true);
    const { data } = await supabase.from("sale_items").select("*").eq("sale_id", sale.id);
    setSaleItems((data as any) || []);
    setLoadingItems(false);
  };

  const printInvoice = () => {
    if (!selectedSale) return;
    printReceipt(selectedSale, saleItems);
  };

  const shareWhatsApp = () => {
    if (!selectedSale) return;
    const itemsText = saleItems.map(si => `${si.item_name} x${si.quantity} = ₹${Number(si.total).toFixed(0)}`).join("\n");
    const msg = `🧾 *${selectedSale.invoice_number}*\n${new Date(selectedSale.created_at).toLocaleString()}\n\n${itemsText}\n\n*Total: ₹${Number(selectedSale.grand_total).toFixed(0)}*\nPayment: ${selectedSale.payment_mode.toUpperCase()}\n\nThank you! 🙏`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleExportExcel = () => exportToExcel(filtered.map(s => ({ "Invoice #": s.invoice_number, Date: new Date(s.created_at).toLocaleDateString(), Payment: s.payment_mode, Status: s.status, Subtotal: Number(s.subtotal).toFixed(2), GST: Number(s.tax_total || 0).toFixed(2), Amount: Number(s.grand_total).toFixed(2) })), "invoices");
  const handleExportPDF = () => exportToPDF("Invoices Report", ["Invoice #", "Date", "Payment", "Status", "Amount"], filtered.map(s => [s.invoice_number, new Date(s.created_at).toLocaleDateString(), s.payment_mode, s.status, `₹${Number(s.grand_total).toFixed(0)}`]));

  const statusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-success/10 text-success";
      case "cancelled": return "bg-destructive/10 text-destructive";
      case "held": return "bg-accent/10 text-accent";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden pb-20 md:pb-0">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2 ml-10 md:ml-0"><FileText className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Invoices</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} of {sales.length} invoices</p>
        <div className="mt-3 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice, payment, status..." className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div className="mt-3">
          <DateFilterExport onFilter={(from, to) => { setDateFrom(from); setDateTo(to); }} onExportExcel={handleExportExcel} onExportPDF={handleExportPDF} defaultPreset="today" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
        {loading ? <div className="text-center text-muted-foreground py-12">Loading...</div> :
        filtered.length === 0 ? <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><FileText className="h-12 w-12 mb-3 opacity-30" /><p>No invoices found</p></div> :
        <>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm"><thead><tr className="border-b border-border">
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Invoice #</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Date</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Payment</th>
              <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Amount</th>
              <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">View</th>
            </tr></thead><tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-border/30 hover:bg-muted/20 cursor-pointer" onClick={() => viewInvoice(s)}>
                  <td className="py-3 px-3 font-mono text-primary text-xs">{s.invoice_number}</td>
                  <td className="py-3 px-3 text-muted-foreground text-xs">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground uppercase">{s.payment_mode}</span></td>
                  <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusColor(s.status)}`}>{s.status}</span></td>
                  <td className="py-3 px-3 text-right font-semibold text-foreground">₹{Number(s.grand_total).toFixed(0)}</td>
                  <td className="py-3 px-3 text-center"><Eye className="h-4 w-4 text-muted-foreground inline hover:text-primary" /></td>
                </tr>
              ))}
            </tbody></table>
          </div>
          <div className="sm:hidden space-y-2">
            {filtered.map(s => (
              <button key={s.id} onClick={() => viewInvoice(s)} className="w-full glass-card rounded-xl p-4 text-left touch-manipulation">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-primary text-xs font-medium">{s.invoice_number}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusColor(s.status)}`}>{s.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()} • {s.payment_mode.toUpperCase()}</span>
                  <span className="text-sm font-bold text-foreground">₹{Number(s.grand_total).toFixed(0)}</span>
                </div>
              </button>
            ))}
          </div>
        </>}
      </div>

      {/* Invoice Detail Modal with Print + WhatsApp */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setSelectedSale(null)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto scrollbar-thin animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">{selectedSale.invoice_number}</h3>
                <p className="text-xs text-muted-foreground">{new Date(selectedSale.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedSale(null)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusColor(selectedSale.status)}`}>{selectedSale.status}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground uppercase">{selectedSale.payment_mode}</span>
            </div>

            {loadingItems ? <div className="text-center text-muted-foreground py-8">Loading items...</div> : (
              <table className="w-full text-sm mb-4">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-2 text-xs text-muted-foreground">Item</th>
                  <th className="text-right py-2 text-xs text-muted-foreground">Qty</th>
                  <th className="text-right py-2 text-xs text-muted-foreground">Price</th>
                  <th className="text-right py-2 text-xs text-muted-foreground">Total</th>
                </tr></thead>
                <tbody>
                  {saleItems.map(si => (
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
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="text-foreground">₹{Number(selectedSale.subtotal).toFixed(2)}</span></div>
              {Number(selectedSale.discount || 0) > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Discount</span><span className="text-success">-₹{Number(selectedSale.discount).toFixed(2)}</span></div>}
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">GST</span><span className="text-foreground">₹{Number(selectedSale.tax_total || 0).toFixed(2)}</span></div>
              <div className="h-px bg-border my-1" />
              <div className="flex justify-between text-lg font-bold"><span className="text-foreground">Total</span><span className="text-primary">₹{Number(selectedSale.grand_total).toFixed(2)}</span></div>
              {Number(selectedSale.amount_paid || 0) > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Paid</span><span className="text-success">₹{Number(selectedSale.amount_paid).toFixed(2)}</span></div>}
              {Number(selectedSale.change_amount || 0) > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Change</span><span className="text-accent">₹{Number(selectedSale.change_amount).toFixed(2)}</span></div>}
            </div>

            {/* Print and WhatsApp share */}
            <div className="flex gap-3 mt-4 pt-3 border-t border-border">
              <button onClick={printInvoice} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 touch-manipulation">
                <Printer className="h-4 w-4" /> Print
              </button>
              <button onClick={shareWhatsApp} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-success/10 text-success text-sm font-medium hover:bg-success/20 touch-manipulation">
                <MessageSquare className="h-4 w-4" /> WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
