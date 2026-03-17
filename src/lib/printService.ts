// Thermal printer service - supports USB and Bluetooth printers

export interface PrinterConfig {
  enabled: boolean;
  type: "usb" | "bluetooth" | "browser";
  paperWidth: "58mm" | "80mm";
  autoPrint: boolean;
  showDialog: boolean;
}

const PRINTER_CONFIG_KEY = "printer_config";

export function getPrinterConfig(): PrinterConfig {
  try {
    const saved = localStorage.getItem(PRINTER_CONFIG_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { enabled: true, type: "browser", paperWidth: "80mm", autoPrint: false, showDialog: true };
}

export function savePrinterConfig(config: PrinterConfig) {
  localStorage.setItem(PRINTER_CONFIG_KEY, JSON.stringify(config));
}

// Store persistent device reference
let usbDevice: USBDevice | null = null;
let btCharacteristic: any = null;

export async function connectUSBPrinter(): Promise<boolean> {
  try {
    if (!("usb" in navigator)) return false;
    usbDevice = await (navigator as any).usb.requestDevice({
      filters: [{ classCode: 7 }] // Printer class
    });
    await usbDevice!.open();
    await usbDevice!.selectConfiguration(1);
    await usbDevice!.claimInterface(0);
    return true;
  } catch (e) {
    console.error("USB printer connect failed:", e);
    return false;
  }
}

export async function connectBluetoothPrinter(): Promise<boolean> {
  try {
    if (!("bluetooth" in navigator)) return false;
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [{ services: ["000018f0-0000-1000-8000-00805f9b34fb"] }],
      optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb"],
    });
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService("000018f0-0000-1000-8000-00805f9b34fb");
    btCharacteristic = await service.getCharacteristic("00002af1-0000-1000-8000-00805f9b34fb");
    return true;
  } catch (e) {
    console.error("Bluetooth printer connect failed:", e);
    return false;
  }
}

export function isUSBConnected(): boolean {
  return usbDevice !== null && usbDevice.opened;
}

export function isBTConnected(): boolean {
  return btCharacteristic !== null;
}

// Generate receipt HTML for browser print
export function generateReceiptHTML(sale: any, items: any[], businessName?: string): string {
  const is80mm = getPrinterConfig().paperWidth === "80mm";
  const width = is80mm ? "302px" : "218px";
  
  const itemRows = items.map(si =>
    `<tr><td style="font-size:11px">${si.item_name}</td><td style="text-align:right;font-size:11px">${si.quantity}</td><td style="text-align:right;font-size:11px">₹${Number(si.unit_price).toFixed(1)}</td><td style="text-align:right;font-size:11px">₹${Number(si.total).toFixed(1)}</td></tr>`
  ).join("");

  return `<!DOCTYPE html><html><head><title>${sale.invoice_number}</title>
<style>
  @page{margin:0;size:${width} auto}
  body{font-family:'Courier New',monospace;width:${width};margin:0 auto;padding:8px;color:#000;font-size:12px}
  .center{text-align:center}
  .bold{font-weight:bold}
  .line{border-top:1px dashed #000;margin:6px 0}
  table{width:100%;border-collapse:collapse}
  th{font-size:10px;text-align:left;border-bottom:1px solid #000;padding:2px 0}
  th:not(:first-child){text-align:right}
  td{padding:2px 0}
  .row{display:flex;justify-content:space-between}
</style></head><body>
  <div class="center bold" style="font-size:14px">${businessName || "Store"}</div>
  <div class="center" style="font-size:10px;margin-bottom:4px">Tax Invoice</div>
  <div class="line"></div>
  <div class="row"><span>Bill: ${sale.invoice_number}</span><span>${new Date(sale.created_at).toLocaleDateString()}</span></div>
  <div style="font-size:10px;color:#666">${new Date(sale.created_at).toLocaleTimeString()}</div>
  <div class="line"></div>
  <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amt</th></tr></thead><tbody>${itemRows}</tbody></table>
  <div class="line"></div>
  <div class="row"><span>Subtotal</span><span>₹${Number(sale.subtotal).toFixed(2)}</span></div>
  ${Number(sale.discount || 0) > 0 ? `<div class="row"><span>Discount</span><span>-₹${Number(sale.discount).toFixed(2)}</span></div>` : ""}
  ${Number(sale.tax_total || 0) > 0 ? `<div class="row"><span>GST</span><span>₹${Number(sale.tax_total).toFixed(2)}</span></div>` : ""}
  <div class="line"></div>
  <div class="row bold" style="font-size:14px"><span>TOTAL</span><span>₹${Number(sale.grand_total).toFixed(0)}</span></div>
  <div class="row" style="font-size:10px"><span>Paid</span><span>₹${Number(sale.amount_paid || sale.grand_total).toFixed(2)}</span></div>
  ${Number(sale.change_amount || 0) > 0 ? `<div class="row" style="font-size:10px"><span>Change</span><span>₹${Number(sale.change_amount).toFixed(2)}</span></div>` : ""}
  <div class="row" style="font-size:10px"><span>Mode</span><span style="text-transform:uppercase">${sale.payment_mode}</span></div>
  <div class="line"></div>
  <div class="center" style="font-size:10px;margin-top:4px">Thank you! Visit again.</div>
</body></html>`;
}

export function printReceipt(sale: any, items: any[], businessName?: string) {
  const config = getPrinterConfig();
  if (!config.enabled) return;
  
  const html = generateReceiptHTML(sale, items, businessName);
  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  
  if (config.autoPrint) {
    win.onload = () => { win.print(); setTimeout(() => win.close(), 1000); };
  } else {
    win.onload = () => win.print();
  }
}
