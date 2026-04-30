import { useEffect } from "react";

const STORAGE_KEY = "app_keep_screen_on";

export function getKeepScreenOn(): boolean {
  // Default: ON (user asked for always-on)
  return localStorage.getItem(STORAGE_KEY) !== "false";
}

export function setKeepScreenOn(value: boolean) {
  localStorage.setItem(STORAGE_KEY, String(value));
  // Notify any listening hooks in the same tab to re-evaluate.
  window.dispatchEvent(new Event("keep-screen-on-changed"));
}

/**
 * Global Screen Wake Lock — keeps the device display on while the app is open.
 * Re-acquires automatically after tab visibility changes (the browser auto-releases
 * the lock when the tab is hidden). Can be disabled in Settings → POS.
 */
export function useKeepScreenOn() {
  useEffect(() => {
    let wakeLock: any = null;
    let cancelled = false;

    const release = () => {
      try { wakeLock?.release?.(); } catch {}
      wakeLock = null;
    };

    const acquire = async () => {
      if (cancelled) return;
      if (!getKeepScreenOn()) { release(); return; }
      if (!("wakeLock" in navigator)) return;
      try {
        wakeLock = await (navigator as any).wakeLock.request("screen");
        wakeLock?.addEventListener?.("release", () => { wakeLock = null; });
      } catch {
        // Browser may block (no user gesture, low battery, etc.) — silently retry on next visibility.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };
    const onSettingChanged = () => { release(); acquire(); };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keep-screen-on-changed", onSettingChanged);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keep-screen-on-changed", onSettingChanged);
      release();
    };
  }, []);
}
