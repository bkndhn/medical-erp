import { forwardRef } from "react";
import { getPrinterConfig } from "@/lib/printService";

interface Item {
  item_name: string;
  quantity: number;
  sale_unit?: string;
  unit_price: number;
  total: number;
}

interface ReceiptProps {
  sale: any;
  items: Item[];
  businessName?: string;
  customerInfo?: { name?: string; phone?: string };
}

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(
  ({ sale, items, businessName, customerInfo }, ref) => {
    const biz = JSON.parse(localStorage.getItem("business_details") || "{}");
    const name = biz.storeName || businessName || "Store";
    const config = getPrinterConfig();
    const is80mm = config.paperWidth === "80mm";
    
    // Widths tailored for exact hardware printers (80mm ≈ 302px, 58mm ≈ 218px)
    const containerWidth = is80mm ? "302px" : "218px";
    const fontSize = is80mm ? "12px" : "11px";

    return (
      <div 
        ref={ref} 
        style={{
          width: containerWidth,
          padding: "8px",
          fontFamily: "'Courier New', Courier, monospace",
          color: "#000",
          backgroundColor: "#fff",
          fontSize,
          margin: "0 auto",
          lineHeight: "1.2"
        }}
      >
        <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "14px", marginBottom: "4px" }}>
          {name}
        </div>
        {biz.address && <div style={{ textAlign: "center", fontSize: "9px" }}>{biz.address}</div>}
        {biz.phone && <div style={{ textAlign: "center", fontSize: "9px" }}>Ph: {biz.phone}</div>}
        {biz.gstNumber && <div style={{ textAlign: "center", fontSize: "9px" }}>GSTIN: {biz.gstNumber}</div>}
        {biz.fssaiNumber && <div style={{ textAlign: "center", fontSize: "9px" }}>FSSAI: {biz.fssaiNumber}</div>}
        {biz.dlNumber && <div style={{ textAlign: "center", fontSize: "9px" }}>DL: {biz.dlNumber}</div>}
        
        <div style={{ textAlign: "center", fontSize: "10px", marginTop: "4px", marginBottom: "4px" }}>
          Tax Invoice
        </div>

        <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
          <span>Bill: {sale?.invoice_number}</span>
          <span>{sale?.created_at ? new Date(sale.created_at).toLocaleDateString() : ""}</span>
        </div>
        <div style={{ fontSize: "10px", color: "#666" }}>
          {sale?.created_at ? new Date(sale.created_at).toLocaleTimeString() : ""}
        </div>
        
        {customerInfo?.name && (
          <div style={{ fontSize: "10px", marginTop: "4px" }}>
            Customer: {customerInfo.name} {customerInfo.phone ? `| ${customerInfo.phone}` : ""}
          </div>
        )}

        <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: "45%", textAlign: "left", fontSize: "10px", borderBottom: "1px solid #000", paddingBottom: "2px" }}>Item</th>
              <th style={{ width: "15%", textAlign: "right", fontSize: "10px", borderBottom: "1px solid #000", paddingBottom: "2px" }}>Qty</th>
              <th style={{ width: "20%", textAlign: "right", fontSize: "10px", borderBottom: "1px solid #000", paddingBottom: "2px" }}>Rate</th>
              <th style={{ width: "20%", textAlign: "right", fontSize: "10px", borderBottom: "1px solid #000", paddingBottom: "2px" }}>Amt</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item, idx) => (
              <tr key={idx}>
                <td style={{ textAlign: "left", fontSize: "11px", paddingTop: "4px", paddingBottom: "4px", wordWrap: "break-word" }}>
                  {item.item_name}
                </td>
                <td style={{ textAlign: "right", fontSize: "11px", paddingTop: "4px", paddingBottom: "4px" }}>
                  {item.sale_unit === "loose" ? `${item.quantity}L` : item.quantity}
                </td>
                <td style={{ textAlign: "right", fontSize: "11px", paddingTop: "4px", paddingBottom: "4px" }}>
                  {item.unit_price}
                </td>
                <td style={{ textAlign: "right", fontSize: "11px", paddingTop: "4px", paddingBottom: "4px" }}>
                  {Number(item.total).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
          <span>Subtotal</span>
          <span>₹{Number(sale?.subtotal || 0).toFixed(2)}</span>
        </div>
        
        {Number(sale?.discount || 0) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
            <span>Discount</span>
            <span>-₹{Number(sale.discount).toFixed(2)}</span>
          </div>
        )}
        
        {Number(sale?.tax_total || 0) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
            <span>GST</span>
            <span>₹{Number(sale.tax_total).toFixed(2)}</span>
          </div>
        )}

        <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "14px", marginBottom: "4px" }}>
          <span>TOTAL</span>
          <span>₹{Number(sale?.grand_total || 0).toFixed(0)}</span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
          <span>Paid</span>
          <span>₹{Number(sale?.amount_paid || sale?.grand_total || 0).toFixed(2)}</span>
        </div>
        
        {Number(sale?.change_amount || 0) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
            <span>Change</span>
            <span>₹{Number(sale.change_amount).toFixed(2)}</span>
          </div>
        )}
        
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginTop: "2px" }}>
          <span>Mode</span>
          <span style={{ textTransform: "uppercase" }}>{sale?.payment_mode}</span>
        </div>

        <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

        <div style={{ textAlign: "center", fontSize: "10px", marginTop: "6px" }}>
          {biz.tagline || "Thank you! Visit again."}
        </div>
      </div>
    );
  }
);
