import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Plus, Search, X, Save, Play, Square, Calendar, Users } from "lucide-react";
import { toast } from "sonner";
import DateFilterExport, { exportToExcel, exportToPDF } from "@/components/DateFilterExport";

interface AttendanceRecord {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  hours_worked: number | null;
  overtime_hours: number | null;
  notes: string | null;
  status: string;
  created_at: string;
}

interface StaffMember {
  user_id: string;
  full_name: string;
  role: string;
  phone: string | null;
}

export default function Attendance() {
  const { tenantId, user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [myClockIn, setMyClockIn] = useState<AttendanceRecord | null>(null);
  const SHIFT_HOURS = 8;

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: profiles }, { data: att }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, role, phone").eq("tenant_id", tenantId),
      supabase.from("attendance" as any).select("*").eq("tenant_id", tenantId).order("clock_in", { ascending: false }).limit(500),
    ]);
    setStaff((profiles as any) || []);
    setRecords((att as any) || []);
    // Check if current user has open clock-in
    const open = ((att as any) || []).find((r: any) => r.user_id === user?.id && !r.clock_out);
    setMyClockIn(open || null);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [tenantId]);

  const handleClockIn = async () => {
    if (!tenantId || !user) return;
    const { error } = await supabase.from("attendance" as any).insert({
      tenant_id: tenantId, user_id: user.id, clock_in: new Date().toISOString(), status: "present",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Clocked in ✅");
    fetchData();
  };

  const handleClockOut = async () => {
    if (!myClockIn) return;
    const clockIn = new Date(myClockIn.clock_in);
    const now = new Date();
    const hoursWorked = (now.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
    const overtime = Math.max(0, hoursWorked - SHIFT_HOURS);
    const { error } = await supabase.from("attendance" as any).update({
      clock_out: now.toISOString(),
      hours_worked: Math.round(hoursWorked * 100) / 100,
      overtime_hours: Math.round(overtime * 100) / 100,
    }).eq("id", myClockIn.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Clocked out! ${hoursWorked.toFixed(1)} hours worked`);
    fetchData();
  };

  const staffMap = useMemo(() => Object.fromEntries(staff.map(s => [s.user_id, s])), [staff]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (dateFrom && new Date(r.clock_in) < dateFrom) return false;
      if (dateTo && new Date(r.clock_in) > dateTo) return false;
      if (search) {
        const name = staffMap[r.user_id]?.full_name || "";
        if (!name.toLowerCase().includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [records, dateFrom, dateTo, search, staffMap]);

  const totalHours = filtered.reduce((s, r) => s + (r.hours_worked || 0), 0);
  const totalOvertime = filtered.reduce((s, r) => s + (r.overtime_hours || 0), 0);
  const presentToday = records.filter(r => {
    const today = new Date().toDateString();
    return new Date(r.clock_in).toDateString() === today;
  }).length;

  return (
    <div className="h-screen flex flex-col overflow-hidden pb-20 md:pb-0">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="ml-10 md:ml-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2"><Clock className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> Attendance</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} records • {presentToday} present today</p>
          </div>
          <div className="flex gap-2">
            {myClockIn ? (
              <button onClick={handleClockOut} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 touch-manipulation">
                <Square className="h-4 w-4" /> Clock Out
              </button>
            ) : (
              <button onClick={handleClockIn} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-success text-primary-foreground text-sm font-medium hover:bg-success/90 touch-manipulation">
                <Play className="h-4 w-4" /> Clock In
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff..." className="w-full pl-9 pr-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <DateFilterExport
            defaultPreset="today"
            onFilter={(from, to) => { setDateFrom(from); setDateTo(to); }}
            onExportExcel={() => exportToExcel(filtered.map(r => {
              const s = staffMap[r.user_id];
              return { Staff: s?.full_name || "Unknown", "Clock In": new Date(r.clock_in).toLocaleString(), "Clock Out": r.clock_out ? new Date(r.clock_out).toLocaleString() : "—", Hours: (r.hours_worked || 0).toFixed(1), Overtime: (r.overtime_hours || 0).toFixed(1), Status: r.status };
            }), "attendance")}
            onExportPDF={() => exportToPDF("Attendance Report", ["Staff", "Clock In", "Clock Out", "Hours", "OT", "Status"], filtered.map(r => {
              const s = staffMap[r.user_id];
              return [s?.full_name || "Unknown", new Date(r.clock_in).toLocaleString(), r.clock_out ? new Date(r.clock_out).toLocaleString() : "—", (r.hours_worked || 0).toFixed(1), (r.overtime_hours || 0).toFixed(1), r.status];
            }))}
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
        {/* My Status */}
        {myClockIn && (
          <div className="glass-card rounded-xl p-4 mb-4 border-l-4 border-success">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase">You are clocked in since</p>
                <p className="text-sm font-semibold text-foreground">{new Date(myClockIn.clock_in).toLocaleString()}</p>
                <p className="text-xs text-success mt-1">
                  {((new Date().getTime() - new Date(myClockIn.clock_in).getTime()) / (1000 * 60 * 60)).toFixed(1)} hours elapsed
                </p>
              </div>
              <div className="w-3 h-3 rounded-full bg-success animate-pulse" />
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="glass-card rounded-xl p-4"><p className="text-[10px] text-muted-foreground uppercase">Records</p><p className="text-xl font-bold text-foreground">{filtered.length}</p></div>
          <div className="glass-card rounded-xl p-4"><p className="text-[10px] text-muted-foreground uppercase">Present Today</p><p className="text-xl font-bold text-success">{presentToday}</p></div>
          <div className="glass-card rounded-xl p-4"><p className="text-[10px] text-muted-foreground uppercase">Total Hours</p><p className="text-xl font-bold text-foreground">{totalHours.toFixed(1)}</p></div>
          <div className="glass-card rounded-xl p-4"><p className="text-[10px] text-muted-foreground uppercase">Overtime</p><p className="text-xl font-bold text-accent">{totalOvertime.toFixed(1)}h</p></div>
        </div>

        {loading ? <div className="flex items-center justify-center h-48 text-muted-foreground">Loading...</div> :
        filtered.length === 0 ? <div className="flex flex-col items-center justify-center h-48 text-muted-foreground"><Clock className="h-12 w-12 mb-3 opacity-30" /><p>No attendance records</p></div> :
        <>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Staff</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Role</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Clock In</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Clock Out</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Hours</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Overtime</th>
                <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Status</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => {
                  const s = staffMap[r.user_id];
                  return (
                    <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="py-3 px-3 font-medium text-foreground">{s?.full_name || "Unknown"}</td>
                      <td className="py-3 px-3 text-muted-foreground text-xs capitalize">{s?.role || "—"}</td>
                      <td className="py-3 px-3 text-muted-foreground text-xs">{new Date(r.clock_in).toLocaleString()}</td>
                      <td className="py-3 px-3 text-muted-foreground text-xs">{r.clock_out ? new Date(r.clock_out).toLocaleString() : <span className="text-success">Active</span>}</td>
                      <td className="py-3 px-3 text-right font-medium text-foreground">{r.hours_worked ? r.hours_worked.toFixed(1) : "—"}</td>
                      <td className="py-3 px-3 text-right"><span className={r.overtime_hours && r.overtime_hours > 0 ? "text-accent font-semibold" : "text-muted-foreground"}>{r.overtime_hours ? `${r.overtime_hours.toFixed(1)}h` : "—"}</span></td>
                      <td className="py-3 px-3 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${r.status === "present" ? "bg-success/10 text-success" : r.status === "late" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}`}>{r.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="sm:hidden space-y-2">
            {filtered.map(r => {
              const s = staffMap[r.user_id];
              return (
                <div key={r.id} className="glass-card rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div><h4 className="text-sm font-semibold text-foreground">{s?.full_name || "Unknown"}</h4><p className="text-xs text-muted-foreground capitalize">{s?.role || "Staff"}</p></div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${!r.clock_out ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{r.clock_out ? "Done" : "Active"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><p className="text-muted-foreground">In</p><p className="text-foreground">{new Date(r.clock_in).toLocaleTimeString()}</p></div>
                    <div><p className="text-muted-foreground">Out</p><p className="text-foreground">{r.clock_out ? new Date(r.clock_out).toLocaleTimeString() : "—"}</p></div>
                    <div><p className="text-muted-foreground">Hours</p><p className="text-foreground font-medium">{r.hours_worked?.toFixed(1) || "—"}</p></div>
                    <div><p className="text-muted-foreground">OT</p><p className={r.overtime_hours && r.overtime_hours > 0 ? "text-accent font-medium" : "text-foreground"}>{r.overtime_hours?.toFixed(1) || "0"}h</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        </>}
      </div>
    </div>
  );
}
