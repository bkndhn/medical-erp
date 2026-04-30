import { useState } from "react";
import * as XLSX from "xlsx";
import { Upload, X, FileSpreadsheet, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  type?: "string" | "number" | "boolean" | "date";
  validate?: (value: any, row: Record<string, any>) => string | null;
  transform?: (value: any) => any;
}

interface BulkImportModalProps {
  open: boolean;
  title: string;
  fields: ImportField[];
  templateRows: Record<string, any>[];
  onClose: () => void;
  onImport: (rows: Record<string, any>[]) => Promise<{ inserted: number; errors: { row: number; message: string }[] }>;
}

type Step = "upload" | "map" | "preview" | "importing" | "done";

export default function BulkImportModal({ open, title, fields, templateRows, onClose, onImport }: BulkImportModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{ inserted: number; errors: { row: number; message: string }[] } | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ row: number; message: string }[]>([]);

  if (!open) return null;

  const reset = () => {
    setStep("upload"); setData([]); setHeaders([]); setMapping({});
    setProgress(0); setResult(null); setValidationErrors([]);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
        if (!rows.length) { toast.error("File is empty"); return; }
        const hdrs = Object.keys(rows[0]);
        setHeaders(hdrs);
        setData(rows);
        // Auto-map
        const auto: Record<string, string> = {};
        hdrs.forEach(h => {
          const norm = h.toLowerCase().replace(/[^a-z0-9]/g, "");
          const match = fields.find(f => {
            const fn = f.key.toLowerCase().replace(/[^a-z0-9]/g, "");
            const ln = f.label.toLowerCase().replace(/[^a-z0-9]/g, "");
            return fn === norm || ln === norm;
          });
          if (match) auto[h] = match.key;
        });
        setMapping(auto);
        setStep("map");
      } catch (err: any) {
        toast.error("Failed to read file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(templateRows.length ? templateRows : [Object.fromEntries(fields.map(f => [f.label, ""]))]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `${title.toLowerCase().replace(/\s+/g, "_")}_template.xlsx`);
  };

  const validateAndPreview = () => {
    const errs: { row: number; message: string }[] = [];
    const requiredFields = fields.filter(f => f.required);
    data.forEach((row, idx) => {
      const mapped: Record<string, any> = {};
      Object.entries(mapping).forEach(([h, k]) => { if (k && k !== "_skip") mapped[k] = row[h]; });
      requiredFields.forEach(f => {
        const v = mapped[f.key];
        if (v === undefined || v === null || v === "") errs.push({ row: idx + 2, message: `Missing ${f.label}` });
      });
      fields.forEach(f => {
        const v = mapped[f.key];
        if (v === undefined || v === null || v === "") return;
        if (f.type === "number" && isNaN(Number(v))) errs.push({ row: idx + 2, message: `${f.label} must be number` });
        if (f.validate) { const e = f.validate(v, mapped); if (e) errs.push({ row: idx + 2, message: e }); }
      });
    });
    setValidationErrors(errs);
    setStep("preview");
  };

  const buildMapped = (): Record<string, any>[] => data.map(row => {
    const m: Record<string, any> = {};
    Object.entries(mapping).forEach(([h, k]) => {
      if (!k || k === "_skip") return;
      const f = fields.find(x => x.key === k); if (!f) return;
      let v = row[h];
      if (v === "" || v === undefined || v === null) return;
      if (f.type === "number") v = Number(v);
      else if (f.type === "boolean") v = ["true", "1", "yes", "y"].includes(String(v).toLowerCase());
      if (f.transform) v = f.transform(v);
      m[k] = v;
    });
    return m;
  });

  const runImport = async () => {
    setStep("importing"); setProgress(10);
    try {
      const mapped = buildMapped().filter((_, i) => !validationErrors.some(e => e.row === i + 2));
      setProgress(40);
      const res = await onImport(mapped);
      setProgress(100);
      setResult(res);
      setStep("done");
    } catch (err: any) {
      toast.error("Import failed: " + err.message);
      setStep("preview");
    }
  };

  const downloadErrors = () => {
    const all = [...validationErrors, ...(result?.errors || [])];
    const ws = XLSX.utils.json_to_sheet(all);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, "import_errors.xlsx");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}>
      <div className="glass-card rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6 shrink-0">
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" /> Import {title}
          </h3>
          {step !== "importing" && <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>}
        </div>

        {step === "upload" && (
          <div className="flex-1 flex flex-col">
            <div className={`flex-1 min-h-[300px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/20"}`}>
              <Upload className={`h-12 w-12 mb-4 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
              <h4 className="text-lg font-semibold mb-2">Drag & Drop your Excel file</h4>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">Supports .xlsx, .xls, .csv. Get a template below.</p>
              <label className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium cursor-pointer hover:bg-primary/90">
                Browse Files
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              </label>
            </div>
            <div className="mt-6 flex justify-between items-center bg-muted/50 p-4 rounded-xl">
              <div className="text-sm text-muted-foreground">Need a template?</div>
              <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background border border-border hover:bg-muted text-sm font-medium">
                <Download className="h-4 w-4" /> Download Template
              </button>
            </div>
          </div>
        )}

        {step === "map" && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="bg-primary/10 text-primary px-4 py-3 rounded-lg text-sm font-medium mb-4">
              Found {data.length} rows. Match your columns:
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="space-y-2">
                {headers.map(h => (
                  <div key={h} className="grid grid-cols-2 gap-4 items-center bg-muted/30 p-2.5 rounded-lg border border-border/50">
                    <span className="text-sm font-medium truncate" title={h}>{h}</span>
                    <select value={mapping[h] || "_skip"} onChange={e => setMapping({ ...mapping, [h]: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-md bg-background border border-border text-sm">
                      <option value="_skip">-- Skip --</option>
                      {fields.map(f => <option key={f.key} value={f.key}>{f.label}{f.required ? " *" : ""}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-border">
              <button onClick={() => setStep("upload")} className="px-5 py-2.5 rounded-lg bg-muted hover:bg-muted/80 text-sm">Back</button>
              <button onClick={validateAndPreview} className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium">Validate & Preview</button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className={`px-4 py-3 rounded-lg text-sm font-medium mb-4 ${validationErrors.length ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
              {validationErrors.length ? <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {validationErrors.length} error(s) — those rows will be skipped</span> : `${data.length} rows ready to import`}
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {validationErrors.length > 0 && (
                <div className="border border-destructive/30 rounded-lg p-3 bg-destructive/5">
                  <div className="text-sm font-semibold text-destructive mb-2">Errors:</div>
                  <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                    {validationErrors.slice(0, 20).map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}
                    {validationErrors.length > 20 && <li className="text-muted-foreground">+ {validationErrors.length - 20} more</li>}
                  </ul>
                </div>
              )}
              <div className="text-xs font-semibold text-muted-foreground uppercase mt-4 mb-2">Preview (first 3 rows)</div>
              {buildMapped().slice(0, 3).map((row, i) => (
                <div key={i} className="p-4 rounded-xl border border-border bg-background text-sm">
                  {Object.entries(row).map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-border/30 py-1 last:border-0">
                      <span className="text-muted-foreground">{fields.find(f => f.key === k)?.label || k}</span>
                      <span className="font-medium">{String(v)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-between gap-3 pt-4 border-t border-border">
              <div>
                {validationErrors.length > 0 && <button onClick={downloadErrors} className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium">Download Error Report</button>}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep("map")} className="px-5 py-2.5 rounded-lg bg-muted hover:bg-muted/80 text-sm">Back</button>
                <button onClick={runImport} disabled={data.length === validationErrors.length} className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-success text-white hover:bg-success/90 disabled:opacity-50 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Import {data.length - validationErrors.length} Valid Rows
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-6" />
            <h4 className="text-xl font-bold mb-2">Importing...</h4>
            <div className="w-full max-w-md bg-muted rounded-full h-3 overflow-hidden">
              <div className="bg-primary h-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm font-medium mt-3 text-primary">{progress}%</p>
          </div>
        )}

        {step === "done" && result && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] text-center">
            <CheckCircle2 className="h-16 w-16 text-success mb-4" />
            <h4 className="text-2xl font-bold mb-2">Import Complete</h4>
            <p className="text-muted-foreground mb-2">{result.inserted} rows imported successfully</p>
            {result.errors.length > 0 && (
              <>
                <p className="text-destructive text-sm mb-3">{result.errors.length} rows failed</p>
                <button onClick={downloadErrors} className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium mb-3">Download Error Report</button>
              </>
            )}
            <button onClick={handleClose} className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium mt-2">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
