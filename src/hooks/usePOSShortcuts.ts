import { useEffect, useCallback } from 'react';

interface ShortcutConfig {
  onSearch?: () => void;
  onAddManual?: () => void;
  onEditQty?: () => void;
  onEditPrice?: () => void;
  onDiscount?: () => void;
  onHoldBill?: () => void;
  onRecallBill?: () => void;
  onReprint?: () => void;
  onPayment?: () => void;
  onPrintComplete?: () => void;
  onHelp?: () => void;
  onFullscreen?: () => void;
  enabled?: boolean;
}

export function usePOSShortcuts(config: ShortcutConfig) {
  const handler = useCallback((e: KeyboardEvent) => {
    if (!config.enabled) return;

    // Don't capture if user is typing in an input (unless it's a function key)
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    const isFKey = e.key.startsWith('F') && e.key.length <= 3;

    if (isInput && !isFKey) return;

    switch (e.key) {
      case 'F1':
        e.preventDefault();
        config.onSearch?.();
        break;
      case 'F2':
        e.preventDefault();
        config.onAddManual?.();
        break;
      case 'F3':
        e.preventDefault();
        config.onEditQty?.();
        break;
      case 'F4':
        e.preventDefault();
        config.onEditPrice?.();
        break;
      case 'F5':
        e.preventDefault();
        config.onDiscount?.();
        break;
      case 'F6':
        e.preventDefault();
        config.onHoldBill?.();
        break;
      case 'F7':
        e.preventDefault();
        config.onRecallBill?.();
        break;
      case 'F8':
        e.preventDefault();
        config.onReprint?.();
        break;
      case 'F9':
        e.preventDefault();
        config.onPayment?.();
        break;
      case 'F11':
        e.preventDefault();
        config.onFullscreen?.();
        break;
      case 'F12':
        e.preventDefault();
        config.onPrintComplete?.();
        break;
      case '?':
        if (!isInput) {
          e.preventDefault();
          config.onHelp?.();
        }
        break;
    }
  }, [config]);

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}
