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
let usbDevice: any = null;
let btCharacteristic: any = null;
let btDevice: any = null;

// Auto-reconnect bluetooth on disconnect
function setupBTReconnect(device: any) {
  if (!device?.gatt) return;
  device.addEventListener("gattserverdisconnected", async () => {
    console.log("BT printer disconnected, attempting reconnect...");
    btCharacteristic = null;
    try {
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService("000018f0-0000-1000-8000-00805f9b34fb");
      btCharacteristic = await service.getCharacteristic("00002af1-0000-1000-8000-00805f9b34fb");
      console.log("BT printer reconnected");
    } catch (e) {
      console.error("BT reconnect failed:", e);
    }
  });
}

export async function connectUSBPrinter(): Promise<boolean> {
  try {
    if (!("usb" in navigator)) return false;
    // Reuse existing device if still open
    if (usbDevice?.opened) return true;
    usbDevice = await (navigator as any).usb.requestDevice({
      filters: [{ classCode: 7 }]
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
    // Reuse existing connection
    if (btCharacteristic && btDevice?.gatt?.connected) return true;
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [{ services: ["000018f0-0000-1000-8000-00805f9b34fb"] }],
      optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb"],
    });
    btDevice = device;
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService("000018f0-0000-1000-8000-00805f9b34fb");
    btCharacteristic = await service.getCharacteristic("00002af1-0000-1000-8000-00805f9b34fb");
    setupBTReconnect(device);
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

interface BizDetails {
  storeName?: string;
  address?: string;
  phone?: string;
  gstNumber?: string;
  fssaiNumber?: string;
  dlNumber?: string;
  tagline?: string;
}

function getBizDetails(): BizDetails {
  try {
    const saved = localStorage.getItem("business_details");
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}

// Generate receipt HTML for browser print
export function generateReceiptHTML(sale: any, items: any[], businessName?: string, customerInfo?: { name?: string; phone?: string }, branchDetails?: any): string {
  const is80mm = getPrinterConfig().paperWidth === "80mm";
  const width = is80mm ? "302px" : "218px";
  const biz = getBizDetails();
  const name = branchDetails?.receipt_header || branchDetails?.name || biz.storeName || businessName || "Store";
  
  const itemRows = items.map(si => {
    const qtyDisplay = si.sale_unit === "loose" ? `${si.quantity} loose` : `${si.quantity}`;
    return `<tr><td style="font-size:11px">${si.item_name}</td><td style="text-align:right;font-size:11px">${qtyDisplay}</td><td style="text-align:right;font-size:11px">₹${Number(si.unit_price).toFixed(1)}</td><td style="text-align:right;font-size:11px">₹${Number(si.total).toFixed(1)}</td></tr>`;
  }).join("");

  const headerLines: string[] = [];
  headerLines.push(`<div class="center bold" style="font-size:14px;white-space:pre-line">${name}</div>`);
  if (branchDetails?.address || biz.address) headerLines.push(`<div class="center" style="font-size:9px">${branchDetails?.address || biz.address}</div>`);
  if (branchDetails?.phone || biz.phone) headerLines.push(`<div class="center" style="font-size:9px">Ph: ${branchDetails?.phone || biz.phone}</div>`);
  if (branchDetails?.gst_number || biz.gstNumber) headerLines.push(`<div class="center" style="font-size:9px">GSTIN: ${branchDetails?.gst_number || biz.gstNumber}</div>`);
  if (branchDetails?.fssai_number || biz.fssaiNumber) headerLines.push(`<div class="center" style="font-size:9px">FSSAI: ${branchDetails?.fssai_number || biz.fssaiNumber}</div>`);
  if (branchDetails?.drug_license || biz.dlNumber) headerLines.push(`<div class="center" style="font-size:9px">DL: ${branchDetails?.drug_license || biz.dlNumber}</div>`);
  headerLines.push(`<div class="center" style="font-size:10px;margin-top:2px">Tax Invoice</div>`);

  const customerSection = customerInfo?.name
    ? `<div style="font-size:10px;margin-top:2px">Customer: ${customerInfo.name}${customerInfo.phone ? ` | ${customerInfo.phone}` : ""}</div>`
    : "";

  const tagline = branchDetails?.receipt_footer || branchDetails?.tagline || biz.tagline || "Thank you! Visit again.";

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
  ${headerLines.join("\n")}
  <div class="line"></div>
  <div class="row"><span>Bill: ${sale.invoice_number}</span><span>${new Date(sale.created_at).toLocaleDateString()}</span></div>
  <div style="font-size:10px;color:#666">${new Date(sale.created_at).toLocaleTimeString()}</div>
  ${customerSection}
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
  <div class="center" style="font-size:10px;margin-top:4px">${tagline}</div>
</body></html>`;
}

import { EscPosPrinter } from "./escpos";

export async function printReceipt(sale: any, items: any[], businessName?: string, customerInfo?: { name?: string; phone?: string }, branchDetails?: any) {
  const config = getPrinterConfig();
  if (!config.enabled) return;
  
  if (config.type === "usb") {
    const printer = new EscPosPrinter();
    const connected = await printer.connect();
    if (!connected) {
      alert("Failed to connect to USB printer. Ensure it is plugged in and authorized.");
      return;
    }
    
    const biz = getBizDetails();
    const name = branchDetails?.receipt_header || branchDetails?.name || biz.storeName || businessName || "Store";
    const width = config.paperWidth === "80mm" ? 48 : 32;

    printer.init();
    printer.alignCenter();
    // Handle multi-line header
    const nameLines = name.split('\n');
    nameLines.forEach((line: string, idx: number) => {
        if (idx === 0) printer.bold(true).text(line).newline().bold(false);
        else printer.text(line).newline();
    });
    
    if (branchDetails?.address || biz.address) printer.text(branchDetails?.address || biz.address).newline();
    if (branchDetails?.phone || biz.phone) printer.text(`Ph: ${branchDetails?.phone || biz.phone}`).newline();
    if (branchDetails?.gst_number || biz.gstNumber) printer.text(`GSTIN: ${branchDetails?.gst_number || biz.gstNumber}`).newline();
    if (branchDetails?.drug_license || biz.dlNumber) printer.text(`DL: ${branchDetails?.drug_license || biz.dlNumber}`).newline();
    if (branchDetails?.fssai_number || biz.fssaiNumber) printer.text(`FSSAI: ${branchDetails?.fssai_number || biz.fssaiNumber}`).newline();
    printer.newline();
    
    printer.alignLeft();
    printer.text(`Bill: ${sale.invoice_number}`).newline();
    printer.text(`Date: ${new Date(sale.created_at).toLocaleString()}`).newline();
    if (customerInfo?.name) printer.text(`Customer: ${customerInfo.name} ${customerInfo.phone || ''}`).newline();
    
    printer.separator("-", width);
    items.forEach(si => {
      const qtyDisplay = si.sale_unit === "loose" ? `${si.quantity}L` : `${si.quantity}`;
      printer.columns(`${si.item_name} (x${qtyDisplay})`, `Rs.${Number(si.total).toFixed(1)}`, width);
    });
    
    printer.separator("-", width);
    printer.columns("Subtotal", `Rs.${Number(sale.subtotal).toFixed(2)}`, width);
    if (Number(sale.discount || 0) > 0) printer.columns("Discount", `-Rs.${Number(sale.discount).toFixed(2)}`, width);
    if (Number(sale.tax_total || 0) > 0) printer.columns("GST", `Rs.${Number(sale.tax_total).toFixed(2)}`, width);
    
    printer.separator("-", width);
    printer.bold(true);
    printer.size(1, 1).columns("TOTAL", `Rs.${Number(sale.grand_total).toFixed(0)}`, width).size(0, 0);
    printer.bold(false);
    
    printer.separator("-", width);
    printer.alignCenter();
    
    const footerLines = (branchDetails?.receipt_footer || branchDetails?.tagline || biz.tagline || "Thank you! Visit again.").split('\n');
    footerLines.forEach((line: string) => printer.text(line).newline());
    
    printer.newline(3); // extra padding before cut
    printer.cut();
    
    await printer.flush();
    await printer.close();
    return;
  }

  // Fallback to Browser Print
  const html = generateReceiptHTML(sale, items, businessName, customerInfo, branchDetails);
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

export function generateWhatsAppText(sale: any, items: any[], customerInfo?: { name?: string; phone?: string }, branchDetails?: any): string {
  const biz = getBizDetails();
  const name = branchDetails?.receipt_header || branchDetails?.name || biz.storeName || "Store";
  const itemsText = items.map(si => {
    const qtyLabel = si.sale_unit === "loose" ? `${si.quantity} loose` : `x${si.quantity}`;
    return `${si.item_name} ${qtyLabel} = ₹${Number(si.total).toFixed(0)}`;
  }).join("\n");
  
  let msg = `🧾 *${(name.split('\n')[0])}*\n`;
  if (branchDetails?.gst_number || biz.gstNumber) msg += `GSTIN: ${branchDetails?.gst_number || biz.gstNumber}\n`;
  msg += `\nInvoice: *${sale.invoice_number}*\n${new Date(sale.created_at).toLocaleString()}\n`;
  if (customerInfo?.name) msg += `Customer: ${customerInfo.name}\n`;
  msg += `\n${itemsText}\n\n`;
  if (Number(sale.discount || 0) > 0) msg += `Discount: -₹${Number(sale.discount).toFixed(0)}\n`;
  const footer = branchDetails?.receipt_footer || branchDetails?.tagline || biz.tagline || "Thank you! 🙏";
  msg += `*Total: ₹${Number(sale.grand_total).toFixed(0)}*\nPayment: ${sale.payment_mode.toUpperCase()}\n\n${footer}`;
  return msg;
}
