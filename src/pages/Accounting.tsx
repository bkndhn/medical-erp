import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, Plus, Search, X, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

const expenseTypes = ["rent", "salary", "utility", "transport", "other"] as const;

export default function Accounting() {
  const { tenantId } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: "other", description: "", amount: 0, paid_to: "", payment_mode: "cash", expense_date: new Date().toISOString().split("T")[0] });
  const [saving, setSaving] = useState(false);

  const fetch_ = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase.from("expenses").select("*").eq("tenant_id", tenantId).order("expense_date", { ascending: false });
    setExpenses((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, [tenantId]);

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const handleSave = async () => {
    if (!form.description || !tenantId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("expenses").insert({ ...form, tenant_id: tenantId } as any);
      if (error) throw error;
      toast.success("Expense added");
      setShowForm(false); fetch_();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Wallet className="h-6 w-6 text-primary" /> Accounting</h1>
            <p className="text-sm text-muted-foreground">Total Expenses: ₹{totalExpenses.toLocaleString()}</p>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Add Expense
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {expenseTypes.slice(0, 3).map(type => {
            const total = expenses.filter(e => e.category === type).reduce((s, e) => s + Number(e.amount), 0);
            return (
              <div key={type} className="glass-card rounded-xl p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase">{type}</p>
                <p className="text-xl font-bold text-foreground mt-1">₹{total.toLocaleString()}</p>
              </div>
            );
          })}
        </div>
        {loading ? <div className="flex items-center justify-center h-32 text-muted-foreground">Loading...</div> :
        expenses.length === 0 ? <div className="flex flex-col items-center justify-center h-32 text-muted-foreground"><Wallet className="h-12 w-12 mb-3 opacity-30" /><p>No expenses recorded</p></div> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border">
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Date</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Category</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Description</th>
          <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Paid To</th>
          <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Amount</th>
        </tr></thead><tbody>
          {expenses.map(e => (
            <tr key={e.id} className="border-b border-border/30 hover:bg-muted/20">
              <td className="py-3 px-3 text-muted-foreground">{e.expense_date}</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary capitalize">{e.category}</span></td>
              <td className="py-3 px-3 text-foreground">{e.description}</td>
              <td className="py-3 px-3 text-muted-foreground">{e.paid_to || "—"}</td>
              <td className="py-3 px-3 text-right font-semibold text-foreground">₹{Number(e.amount).toFixed(0)}</td>
            </tr>
          ))}
        </tbody></table></div>}
      </div>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-md mx-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-foreground">Add Expense</h3><button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted"><X className="h-5 w-5 text-muted-foreground" /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  {expenseTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Description *</label><input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Amount</label><input type="number" value={form.amount} onChange={e => setForm({...form, amount: parseFloat(e.target.value)||0})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Paid To</label><input type="text" value={form.paid_to} onChange={e => setForm({...form, paid_to: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label><input type="date" value={form.expense_date} onChange={e => setForm({...form, expense_date: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
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
