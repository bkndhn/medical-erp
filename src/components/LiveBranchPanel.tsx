import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Radio, TrendingUp, ShoppingCart, IndianRupee } from "lucide-react";

interface BranchStat {
  branchId: string;
  branchName: string;
  orders: number;
  revenue: number;
  lastSaleAt?: string;
}

/**
 * Live multi-branch dashboard panel.
 * - Loads today's sales grouped by branch
 * - Subscribes to Supabase Realtime INSERTs on `sales` for the tenant
 * - Renders only when tenant has 2+ branches and user is viewing "All branches"
 */
export default function LiveBranchPanel() {
  const { tenantId, allBranches, activeBranchId } = useAuth();
  const [statsByBranch, setStatsByBranch] = useState<Record<string, BranchStat>>({});
  const [pulse, setPulse] = useState<string | null>(null);

  const branchMap = useMemo(
    () => Object.fromEntries(allBranches.map((b) => [b.id, b.name])),
    [allBranches]
  );

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  // Initial fetch
  useEffect(() => {
    if (!tenantId || allBranches.length < 2 || activeBranchId) return;
    supabase
      .from("sales")
      .select("branch_id, grand_total, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", todayStart)
      .then(({ data }) => {
        const map: Record<string, BranchStat> = {};
        allBranches.forEach((b) => {
          map[b.id] = { branchId: b.id, branchName: b.name, orders: 0, revenue: 0 };
        });
        (data || []).forEach((s: any) => {
          const bid = s.branch_id;
          if (!map[bid]) {
            map[bid] = { branchId: bid, branchName: branchMap[bid] || "Unknown", orders: 0, revenue: 0 };
          }
          map[bid].orders += 1;
          map[bid].revenue += Number(s.grand_total) || 0;
          if (!map[bid].lastSaleAt || s.created_at > map[bid].lastSaleAt!) map[bid].lastSaleAt = s.created_at;
        });
        setStatsByBranch(map);
      });
  }, [tenantId, allBranches, activeBranchId, todayStart, branchMap]);

  // Realtime subscription
  useEffect(() => {
    if (!tenantId || allBranches.length < 2 || activeBranchId) return;
    const channel = supabase
      .channel(`live-branches-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sales", filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          const s = payload.new as any;
          if (!s || s.created_at < todayStart) return;
          setStatsByBranch((prev) => {
            const bid = s.branch_id;
            const cur = prev[bid] || {
              branchId: bid,
              branchName: branchMap[bid] || "Unknown",
              orders: 0,
              revenue: 0,
            };
            return {
              ...prev,
              [bid]: {
                ...cur,
                orders: cur.orders + 1,
                revenue: cur.revenue + (Number(s.grand_total) || 0),
                lastSaleAt: s.created_at,
              },
            };
          });
          setPulse(s.branch_id);
          setTimeout(() => setPulse(null), 1500);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, allBranches, activeBranchId, todayStart, branchMap]);

  if (allBranches.length < 2 || activeBranchId) return null;

  const sorted = Object.values(statsByBranch).sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = sorted.reduce((s, b) => s + b.revenue, 0);
  const totalOrders = sorted.reduce((s, b) => s + b.orders, 0);

  return (
    <div className="glass-card rounded-xl p-4 sm:p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Radio className="h-4 w-4 text-success" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Live Branch Activity</h3>
          <span className="text-[10px] text-muted-foreground">• today</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1 text-muted-foreground">
            <ShoppingCart className="h-3 w-3" />
            <span className="font-semibold text-foreground">{totalOrders}</span>
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <IndianRupee className="h-3 w-3" />
            <span className="font-semibold text-foreground">{Math.round(totalRevenue).toLocaleString("en-IN")}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((b) => {
          const pct = totalRevenue > 0 ? (b.revenue / totalRevenue) * 100 : 0;
          const isPulsing = pulse === b.branchId;
          return (
            <div
              key={b.branchId}
              className={`p-3 rounded-lg border transition-all ${
                isPulsing
                  ? "border-success bg-success/10 scale-[1.02]"
                  : "border-border bg-muted/20 hover:border-primary/30"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-medium text-foreground truncate">{b.branchName}</span>
                {isPulsing && (
                  <span className="text-[9px] font-bold text-success animate-pulse">+SALE</span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-base font-bold text-foreground">
                  ₹{Math.round(b.revenue).toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-muted-foreground">/ {b.orders} orders</span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {b.lastSaleAt && (
                <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                  <TrendingUp className="h-2.5 w-2.5" />
                  Last sale {new Date(b.lastSaleAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
