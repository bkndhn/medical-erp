import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { warmCommonRoutes } from "./lib/prefetch";

// Restore saved accent color
const savedAccent = localStorage.getItem('app-accent');
if (savedAccent) {
  document.documentElement.style.setProperty('--primary', savedAccent);
  document.documentElement.style.setProperty('--ring', savedAccent);
  document.documentElement.style.setProperty('--sidebar-primary', savedAccent);
}

// Restore saved theme
const savedTheme = localStorage.getItem('app-theme');
if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

// PWA: Prevent service worker in iframe/preview contexts
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost = window.location.hostname.includes("id-preview--") || window.location.hostname.includes("lovableproject.com");
if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
}

createRoot(document.getElementById("root")!).render(<App />);

// Warm the most-used route chunks during browser idle time so navigation feels instant.
warmCommonRoutes();
