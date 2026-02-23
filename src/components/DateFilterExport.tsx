import { useState, useMemo } from "react";
import { Calendar, Download, FileText, Table2 } from "lucide-react";

type Preset = "today" | "yesterday" | "this_week" | "this_month" | "this_year" | "all_time" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This Week" },
  { key: "this_month", label: "This Month" },
  { key: "this_year", label: "This Year" },
  { key: "all_time", label: "All Time" },
  { key: "custom", label: "Custom" },
];

function getPresetRange(preset: Preset): { from: Date | null; to: Date | null } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "this_week": {
      const d = now.getDay(); const diff = now.getDate() - d + (d === 0 ? -6 : 1);
      return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), diff)), to: endOfDay(now) };
    }
    case "this_month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
    case "this_year":
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
    case "all_time":
      return { from: null, to: null };
    default:
      return { from: null, to: null };
  }
}

interface Props {
  onFilter: (from: Date | null, to: Date | null) => void;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
  defaultPreset?: Preset;
}

export function exportToExcel(data: Record<string, any>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => {
    const val = row[h];
    if (val === null || val === undefined) return "";
    if (typeof val === "string" && val.includes(",")) return `"${val}"`;
    return String(val);
  }));
  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
}

export function exportToPDF(title: string, headers: string[], rows: string[][]) {
  const style = `<style>
    body{font-family:Arial,sans-serif;padding:20px;color:#222}
    h1{font-size:18px;margin-bottom:10px}
    p{font-size:11px;color:#666;margin-bottom:15px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#1a1a2e;color:#fff;padding:8px 6px;text-align:left;font-weight:600}
    td{padding:6px;border-bottom:1px solid #e0e0e0}
    tr:nth-child(even){background:#f9f9f9}
    @media print{body{padding:0}}
  </style>`;
  const tableHTML = `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const html = `<!DOCTYPE html><html><head><title>${title}</title>${style}</head><body><h1>${title}</h1><p>Generated: ${new Date().toLocaleString()}</p>${tableHTML}</body></html>`;
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); win.print(); }
}

export default function DateFilterExport({ onFilter, onExportExcel, onExportPDF, defaultPreset = "today" }: Props) {
  const [preset, setPreset] = useState<Preset>(defaultPreset);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const handlePreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const { from, to } = getPresetRange(p);
      onFilter(from, to);
    }
  };

  const handleCustomFilter = () => {
    if (customFrom) {
      const from = new Date(customFrom);
      const to = customTo ? new Date(customTo + "T23:59:59") : new Date();
      onFilter(from, to);
    }
  };

  // Initialize on mount
  useMemo(() => {
    const { from, to } = getPresetRange(defaultPreset);
    onFilter(from, to);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 overflow-x-auto scrollbar-thin">
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => handlePreset(p.key)}
            className={`px-2.5 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all touch-manipulation ${preset === p.key ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent hover:border-border"}`}>
            {p.label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-muted border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <span className="text-xs text-muted-foreground">to</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            min={customFrom} // prevent selecting date before from date
            className="px-2 py-1.5 rounded-lg bg-muted border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <button onClick={handleCustomFilter} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 touch-manipulation">
            <Calendar className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 ml-auto">
        {onExportExcel && (
          <button onClick={onExportExcel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-success/10 text-success hover:bg-success/20 border border-success/20 transition-all touch-manipulation">
            <Table2 className="h-3 w-3" /> Excel
          </button>
        )}
        {onExportPDF && (
          <button onClick={onExportPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 transition-all touch-manipulation">
            <FileText className="h-3 w-3" /> PDF
          </button>
        )}
      </div>
    </div>
  );
}
