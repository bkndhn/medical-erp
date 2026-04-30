// WebUSB ESC/POS Thermal Printer Utility
// @ts-nocheck — WebUSB types are not in default TS lib

export class EscPosPrinter {
  private device: any = null;
  private endpointIn: number | null = null;
  private endpointOut: number | null = null;
  private interfaceNumber: number | null = null;

  // Connection Flow
  async connect(): Promise<boolean> {
    try {
      if (!navigator.usb) throw new Error("WebUSB not supported in this browser.");
      
      // Request standard USB Printer class (classCode: 7)
      this.device = await navigator.usb.requestDevice({
        filters: [{ classCode: 7 }] // 7 = Printer
      });

      await this.device.open();
      
      // Select Configuration (usually 1)
      if (this.device.configuration === null) await this.device.selectConfiguration(1);

      // Find the correct interface
      const conf = this.device.configuration;
      if (!conf) throw new Error("No USB configuration found");

      let alt: any = null;
      for (const intf of conf.interfaces) {
        for (const alternate of intf.alternates) {
          if (alternate.interfaceClass === 7) { // Printer class
            this.interfaceNumber = intf.interfaceNumber;
            alt = alternate;
            break;
          }
        }
        if (alt) break;
      }

      if (this.interfaceNumber === null || !alt) throw new Error("Printer interface not found");
      await this.device.claimInterface(this.interfaceNumber);

      // Map Endpoints
      for (const endpoint of alt.endpoints) {
        if (endpoint.direction === "in") this.endpointIn = endpoint.endpointNumber;
        if (endpoint.direction === "out") this.endpointOut = endpoint.endpointNumber;
      }

      if (this.endpointOut === null) throw new Error("Output endpoint not found");
      return true;
    } catch (err) {
      console.error("USB Connect Error:", err);
      this.device = null;
      return false;
    }
  }

  async close() {
    if (this.device && this.device.opened) {
      if (this.interfaceNumber !== null) await this.device.releaseInterface(this.interfaceNumber);
      await this.device.close();
    }
    this.device = null;
  }

  isOpen(): boolean {
    return this.device !== null && this.device.opened;
  }

  // --- Print Payload Builder & Sender ---
  private buffer: number[] = [];

  // Reset/Initialize
  init() { this.buffer.push(0x1B, 0x40); return this; }
  
  // Text Formatting
  text(str: string) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    for (let i = 0; i < bytes.length; i++) this.buffer.push(bytes[i]);
    return this;
  }
  
  newline(count = 1) {
    for (let i = 0; i < count; i++) this.buffer.push(0x0A);
    return this;
  }
  
  alignLeft() { this.buffer.push(0x1B, 0x61, 0); return this; }
  alignCenter() { this.buffer.push(0x1B, 0x61, 1); return this; }
  alignRight() { this.buffer.push(0x1B, 0x61, 2); return this; }
  
  bold(on: boolean) { this.buffer.push(0x1B, 0x45, on ? 1 : 0); return this; }
  
  size(width: number, height: number) {
    // Width and Height range 0-7. 0 is normal. Size byte is (width << 4) | height
    const widthNormalized = Math.max(0, Math.min(7, width));
    const heightNormalized = Math.max(0, Math.min(7, height));
    const sizeByte = (widthNormalized << 4) | heightNormalized;
    this.buffer.push(0x1D, 0x21, sizeByte);
    return this;
  }
  
  separator(char = "-", length = 32) {
    let sep = "";
    for (let i = 0; i < length; i++) sep += char;
    this.text(sep);
    this.newline();
    return this;
  }
  
  // Cut Paper
  cut() {
    this.buffer.push(0x1D, 0x56, 0x41, 0x00);
    return this;
  }

  // Column Print helper (Item Name | Qty | Total)
  columns(left: string, right: string, totalWidth = 32) {
    const leftText = left.length > totalWidth - right.length - 1 
      ? left.substring(0, totalWidth - right.length - 1) 
      : left;
    const spaces = totalWidth - leftText.length - right.length;
    let spaceStr = "";
    for (let i = 0; i < Math.max(1, spaces); i++) spaceStr += " ";
    this.text(leftText + spaceStr + right);
    this.newline();
    return this;
  }

  // Execution
  async flush() {
    if (!this.device || !this.device.opened || this.endpointOut === null) throw new Error("Printer not ready");
    const data = new Uint8Array(this.buffer);
    try {
      await this.device.transferOut(this.endpointOut, data);
      this.buffer = []; // clear after successful print
      return true;
    } catch (e) {
      console.error("Flush error", e);
      return false;
    }
  }
}
