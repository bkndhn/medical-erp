import { useEffect, useRef } from "react";

interface UseBarcodeScannerProps {
  onScan: (barcode: string) => void;
  debounceTime?: number;
  minLength?: number;
}

export function useBarcodeScanner({ onScan, debounceTime = 50, minLength = 3 }: UseBarcodeScannerProps) {
  const buffer = useRef("");
  const lastKeyTime = useRef<number>(Date.now());
  const isTypingInInput = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      
      // Check if user is legitimately typing into an input field
      // If it's a barcode scanner, it types VERY fast.
      // If it's a human, it's slower. We still want scanners to work even if an input is focused,
      // IF the input isn't intentionally capturing normal text. But to be safe,
      // if an input/textarea is focused, we only intercept if the interval is extremely fast.
      const isInput = activeElement && (
        activeElement.tagName === "INPUT" || 
        activeElement.tagName === "TEXTAREA" ||
        (activeElement as HTMLElement).isContentEditable
      );

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime.current;
      
      // Reset buffer if too much time has passed (not a scanner)
      if (timeDiff > debounceTime) {
        buffer.current = "";
      }
      
      lastKeyTime.current = currentTime;

      // Handle Enter key (end of scan)
      if (e.key === "Enter") {
        if (buffer.current.length >= minLength) {
          // If we are extremely fast, it's a scanner.
          // Trigger the scan callback
          onScan(buffer.current);
          buffer.current = "";
          
          // Optionally prevent default so it doesn't trigger form submits if focused
          e.preventDefault();
        }
        return;
      }

      // Ignore modifiers and long keys
      if (e.key.length > 1) return;

      // Append to buffer
      buffer.current += e.key;

      // If we've built up enough characters very quickly, and focus is on the body/button,
      // prevent default to avoid triggering random app shortcuts.
      if (!isInput && buffer.current.length > 2) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onScan, debounceTime, minLength]);
}
