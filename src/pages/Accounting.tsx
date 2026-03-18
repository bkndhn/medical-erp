import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, Plus, X, Edit2, Trash2, TrendingUp, TrendingDown, PieChart as PieIcon } from "lucide-react";
import { toast } from "sonner";
import DateFilterExport, { exportToExcel, exportToPDF } from "@/components/DateFilterExport";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const expenseTypes = ["rent", "salary", "utility", "transport", "other"] as const;
const COLORS = ["hsl(187 72% 50%)", "hsl(37 95% 55%)", "hsl(152 60% 45%)", "hsl(0 72% 55%)", "hsl(270 60% 55%)"];

export default function Accounting() {
  const { tenantId } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editExpense, setEditExpense] = useState<any>(null);
  const [form, setForm] = useState({ category: "other", description: "", amount: 0, paid_to: "", payment_mode: "cash", expense_date: new Date().toISOString().split("T")[0] });
  const [saving, setSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [tab, setTab] = useState<"expenses" | "pnl">("expenses");

  const fetch_ = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: exp }, { data: sal }] = await Promise.all([
      supabase.from("expenses").select("*").eq("tenant_id", tenantId).order("expense_date", { ascending: false }),
      supabase.from("sales").select("grand_total, created_at, status").eq("tenant_id", tenantId).eq("status", "completed"),
    ]);
    setExpenses((exp as any) || []);
    setSales((sal as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, [tenantId]);

  const filtered = expenses.filter(e => {
    if (dateFrom && new Date(e.expense_date || e.created_at) < dateFrom) return false;
    if (dateTo && new Date(e.expense_date || e.created_at) > dateTo) return false;
    return true;
  });

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      if (dateFrom && new Date(s.created_at) < dateFrom) return false;
      if (dateTo && new Date(s.created_at) > dateTo) return false;
      return true;
    });
  }, [sales, dateFrom, dateTo]);

  const totalExpenses = filtered.reduce((s, e) => s + Number(e.amount), 0);
  const totalRevenue = filteredSales.reduce((s, x) => s + Number(x.grand_total), 0);
  const netProfit = totalRevenue - totalExpenses;

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(e => { map[e.category] = (map[e.category] || 0) + Number(e.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const handleSave = async () => {
    if (!form.description || !tenantId) return;
    setSaving(true);
    try {
      if (editExpense) {
        const { error } = await supabase.from("expenses").update({ ...form, amount: form.amount } as any).eq("id", editExpense.id);
        if (error) throw error;
        toast.success("Expense updated");
      } else {
        const { error } = await supabase.from("expenses").insert({ ...form, tenant_id: tenantId } as any);
        if (error) throw error;
        toast.success("Expense added");
      }
      setShowForm(false); setEditExpense(null); fetch_();
      setForm({ category: "other", description: "", amount: 0, paid_to: "", payment_mode: "cash", expense_date: new Date().toISOString().split("T")[0] });
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    toast.success("Deleted"); fetch_();
  };

  const editExp = (e: any) => {
    setEditExpense(e);
    setForm({ category: e.category, description: e.description, amount: Number(e.amount), paid_to: e.paid_to || "", payment_mode: e.payment_mode || "cash", expense_date: e.expense_date || new Date().toISOString().split("T")[0] });
    setShowForm(true);
  };

  const tooltipStyle = { backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' };

  return (
    <div className="h-screen flex flex-col overflow-hidden pb-20 md:pb-0">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="ml-10 md:ml-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2"><Wallet className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Accounting</h1>
            <p className="text-sm text-muted-foreground">Total Expenses: ₹{totalExpenses.toLocaleString()}</p>
          </div>
          <button onClick={() => { setEditExpense(null); setForm({ category: "other", description: "", amount: 0, paid_to: "", payment_mode: "cash", expense_date: new Date().toISOString().split("T")[0] }); setShowForm(true); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 touch-manipulation">
            <Plus className="h-4 w-4" /> Add Expense
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          {(["expenses", "pnl"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all touch-manipulation ${tab === t ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent"}`}>
              {t === "expenses" ? "Expenses" : "Profit & Loss"}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <DateFilterExport
            onFilter={(from, to) => { setDateFrom(from); setDateTo(to); }}
            onExportExcel={() => exportToExcel(filtered.map(e => ({ Date: e.expense_date, Category: e.category, Description: e.description, PaidTo: e.paid_to || "", Amount: Number(e.amount).toFixed(2) })), "expenses")}
            onExportPDF={() => exportToPDF("Expenses", ["Date", "Category", "Description", "Paid To", "Amount"], filtered.map(e => [e.expense_date, e.category, e.description, e.paid_to || "—", `₹${Number(e.amount).toFixed(0)}`]))}
          />
        </div>
      </header>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
        {tab === "pnl" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Revenue</p><p className="text-2xl font-bold text-success mt-1">₹{totalRevenue.toLocaleString()}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Expenses</p><p className="text-2xl font-bold text-destructive mt-1">₹{totalExpenses.toLocaleString()}</p></div>
              <div className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground uppercase">Net Profit</p><p className={`text-2xl font-bold mt-1 ${netProfit >= 0 ? "text-success" : "text-destructive"}`}>₹{netProfit.toLocaleString()}</p></div>
            </div>
            {categoryData.length > 0 && (
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><PieIcon className="h-4 w-4 text-primary" /> Expense Breakdown</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart><Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie><Tooltip contentStyle={tooltipStyle} /></PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {tab === "expenses" && <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {expenseTypes.map(type => {
              const total = filtered.filter(e => e.category === type).reduce((s, e) => s + Number(e.amount), 0);
              return (
                <div key={type} className="glass-card rounded-xl p-4">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">{type}</p>
                  <p className="text-lg font-bold text-foreground mt-1">₹{total.toLocaleString()}</p>
                </div>
              );
            })}
          </div>
          {loading ? <div className="flex items-center justify-center h-32 text-muted-foreground">Loading...</div> :
          filtered.length === 0 ? <div className="flex flex-col items-center justify-center h-32 text-muted-foreground"><Wallet className="h-12 w-12 mb-3 opacity-30" /><p>No expenses recorded</p></div> :
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border">
            <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Date</th>
            <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Category</th>
            <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Description</th>
            <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Paid To</th>
            <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Amount</th>
            <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Actions</th>
          </tr></thead><tbody>
            {filtered.map(e => (
              <tr key={e.id} className="border-b border-border/30 hover:bg-muted/20">
                <td className="py-3 px-3 text-muted-foreground">{e.expense_date}</td>
                <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary capitalize">{e.category}</span></td>
                <td className="py-3 px-3 text-foreground">{e.description}</td>
                <td className="py-3 px-3 text-muted-foreground hidden sm:table-cell">{e.paid_to || "—"}</td>
                <td className="py-3 px-3 text-right font-semibold text-foreground">₹{Number(e.amount).toFixed(0)}</td>
                <td className="py-3 px-3 text-right"><div className="flex items-center justify-end gap-1">
                  <button onClick={() => editExp(e)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Edit2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div></td>
              </tr>
            ))}
          </tbody></table></div>}
        </>}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-foreground">{editExpense ? "Edit" : "Add"} Expense</h3><button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  {expenseTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Description *</label><input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Amount</label><input type="number" value={form.amount} onChange={e => setForm({...form, amount: parseFloat(e.target.value)||0})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Paid To</label><input type="text" value={form.paid_to} onChange={e => setForm({...form, paid_to: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Payment Mode</label>
                  <select value={form.payment_mode} onChange={e => setForm({...form, payment_mode: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="cash">Cash</option><option value="card">Card</option><option value="upi">UPI</option>
                  </select>
                </div>
                <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label><input type="date" value={form.expense_date} onChange={e => setForm({...form, expense_date: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium">Cancel</button>
              <button onClick={handleSave} disabled={saving||!form.description} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">{saving?"Saving...":"Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
