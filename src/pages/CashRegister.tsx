import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wallet, CheckCircle2, History, RotateCcw, AlertTriangle, Monitor } from "lucide-react";

export default function CashRegister() {
  const { tenantId, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [recentShifts, setRecentShifts] = useState<any[]>([]);

  // Open Shift Form
  const [startingCash, setStartingCash] = useState<string>("");

  // Close Shift Form
  const [countedCash, setCountedCash] = useState<string>("");

  useEffect(() => {
    if (tenantId && user) fetchShifts();
  }, [tenantId, user]);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      // Get current active shift
      const { data: active } = await supabase
        .from("shifts")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("user_id", user?.id)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .single();
        
      if (active) {
        // Calculate expected cash dynamically here
        // Starting cash + all cash sales during this shift - cash refunds
        const { data: sales } = await supabase
          .from("sales")
          .select("amount_paid, change_amount")
          .eq("tenant_id", tenantId)
          .eq("payment_mode", "cash")
          .gte("created_at", active.opened_at)
          .eq("status", "completed");

        const cashSales = (sales || []).reduce((sum, s) => sum + Number(s.amount_paid) - Number(s.change_amount || 0), 0);

        // Also fetch from "payments" table where mode="cash" and sale.created_at >= active.opened_at to be super accurate
        // For simplicity we will use the aggregated cashSales
        const expected = Number(active.starting_cash) + cashSales;
        setActiveShift({ ...active, expected_cash: expected, cash_sales: cashSales });
      } else {
        setActiveShift(null);
      }

      // Get past shifts
      const { data: past } = await supabase
        .from("shifts")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("status", "closed")
        .order("closed_at", { ascending: false })
        .limit(5);
        
      if (past) setRecentShifts(past);

    } catch (e: any) {
      if (e.code !== 'PGRST116') { // PGRST116 is "no rows found" for single()
        console.error("Fetch shifts error:", e);
      } else {
        setActiveShift(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const openShift = async () => {
    if (!tenantId || !user) return;
    const amount = parseFloat(startingCash);
    if (isNaN(amount) || amount < 0) { toast.error("Enter a valid starting cash amount"); return; }
    
    try {
      const { error } = await supabase.from("shifts").insert({
        tenant_id: tenantId,
        user_id: user.id,
        starting_cash: amount,
        status: "open"
      } as any);

      if (error) throw error;
      toast.success("Shift Opened Successfully!");
      setStartingCash("");
      fetchShifts();
    } catch (e: any) {
      toast.error("Error opening shift: " + e.message);
    }
  };

  const closeShift = async () => {
    if (!activeShift) return;
    const counted = parseFloat(countedCash);
    if (isNaN(counted) || counted < 0) { toast.error("Enter a valid counted cash amount"); return; }

    try {
      const difference = counted - activeShift.expected_cash;

      const { error } = await supabase.from("shifts").update({
        closed_at: new Date().toISOString(),
        expected_cash: activeShift.expected_cash,
        counted_cash: counted,
        difference: difference,
        status: "closed"
      } as any).eq("id", activeShift.id);

      if (error) throw error;
      
      if (difference === 0) toast.success("Shift closed: Perfect tally!");
      else if (difference > 0) toast.success(`Shift closed: Overs by ₹${Math.abs(difference)}`);
      else toast.warning(`Shift closed: Short by ₹${Math.abs(difference)}!`);

      setCountedCash("");
      fetchShifts();
    } catch (e: any) {
      toast.error("Error closing shift: " + e.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading Register...</div>;

  return (
    <div className="h-screen overflow-y-auto scrollbar-thin pb-20 md:pb-0">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2 ml-10 md:ml-0">
          <Monitor className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Till / Cash Register
        </h1>
      </header>

      <div className="p-4 sm:p-6 max-w-4xl space-y-6">
        
        {!activeShift ? (
          <div className="glass-card p-6 rounded-2xl flex flex-col items-center justify-center py-12 text-center animate-fade-in border-dashed">
            <div className="h-16 w-16 mb-4 rounded-full bg-muted flex items-center justify-center">
              <Wallet className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Shift is Closed</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">Open a new shift to start billing in POS and tracking cash for this terminal.</p>
            
            <div className="w-full max-w-xs space-y-3">
              <div className="text-left">
                <label className="text-xs font-medium text-muted-foreground ml-1">Starting Cash Float (₹)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={startingCash}
                  onChange={(e) => setStartingCash(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground text-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-center font-mono mt-1"
                />
              </div>
              <button
                onClick={openShift}
                disabled={!startingCash}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5"
              >
                Open Shift
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6 rounded-2xl border-l-4 border-l-success animate-fade-in flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                    <h2 className="text-lg font-bold text-foreground">Active Shift</h2>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">Started: {new Date(activeShift.opened_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end border-b border-border/30 pb-3">
                    <p className="text-sm text-muted-foreground">Opening Float</p>
                    <p className="text-lg font-semibold text-foreground">₹{Number(activeShift.starting_cash).toFixed(2)}</p>
                  </div>
                  <div className="flex justify-between items-end border-b border-border/30 pb-3">
                    <p className="text-sm text-muted-foreground">Cash Sales</p>
                    <p className="text-lg font-semibold text-success">+ ₹{Number(activeShift.cash_sales).toFixed(2)}</p>
                  </div>
                  <div className="flex justify-between items-end bg-primary/5 rounded-lg p-3 border border-primary/10">
                    <p className="text-sm font-medium text-foreground">Expected In Drawer</p>
                    <p className="text-2xl font-bold text-primary tracking-tight">₹{Number(activeShift.expected_cash).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-6 rounded-2xl animate-fade-in flex flex-col justify-center border border-border bg-card/50">
              <h3 className="text-base font-semibold text-foreground mb-4">End of Day Checkout</h3>
              <p className="text-xs text-muted-foreground mb-4">Count the physical cash in the drawer and enter it below to reconcile your shift.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-foreground ml-1">Actual Cash Counted (₹)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary text-foreground text-xl font-bold focus:outline-none focus:ring-4 focus:ring-primary/20 text-center font-mono mt-1 transition-all"
                  />
                </div>

                {countedCash !== "" && !isNaN(Number(countedCash)) && (
                  <div className={`p-3 rounded-lg flex items-start gap-3 border ${Number(countedCash) === activeShift.expected_cash ? "bg-success/10 border-success text-success" : Number(countedCash) > activeShift.expected_cash ? "bg-accent/10 border-accent text-accent" : "bg-destructive/10 border-destructive text-destructive"}`}>
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="font-bold">
                        {Number(countedCash) === activeShift.expected_cash ? "Perfect Match!" : 
                         Number(countedCash) > activeShift.expected_cash ? `Over by ₹${(Number(countedCash) - activeShift.expected_cash).toFixed(2)}` : 
                         `Short by ₹${(activeShift.expected_cash - Number(countedCash)).toFixed(2)}`}
                      </p>
                      <p className="text-[10px] opacity-80 mt-0.5 font-medium">Difference will be logged to reporting.</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={closeShift}
                  disabled={!countedCash}
                  className="w-full py-3.5 rounded-xl bg-foreground text-background font-bold hover:bg-foreground/90 disabled:opacity-50 transition-all shadow-md group mt-2"
                >
                  <span className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-4 w-4 group-hover:scale-110 transition-transform" /> Close Shift
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Shift History */}
        {recentShifts.length > 0 && (
          <div className="mt-8 pt-6 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Recent Shifts
            </h3>
            <div className="grid gap-3">
              {recentShifts.map((shift, i) => (
                <div key={i} className="glass-card p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {new Date(shift.opened_at).toLocaleDateString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      {new Date(shift.opened_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
                      {" - "}
                      {shift.closed_at ? new Date(shift.closed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "Open"}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-6 divide-x divide-border">
                    <div className="flex flex-col text-right pl-0">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Expected</span>
                      <span className="text-sm font-bold text-foreground">₹{Number(shift.expected_cash).toFixed(0)}</span>
                    </div>
                    <div className="flex flex-col text-right pl-6">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Counted</span>
                      <span className="text-sm font-bold text-foreground">₹{Number(shift.counted_cash).toFixed(0)}</span>
                    </div>
                    <div className="flex flex-col text-right pl-6 min-w-[70px]">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Diff</span>
                      <span className={`text-sm font-bold ${Number(shift.difference) === 0 ? "text-success" : Number(shift.difference) < 0 ? "text-destructive" : "text-accent"}`}>
                        {Number(shift.difference) > 0 ? "+" : ""}
                        {Number(shift.difference).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
