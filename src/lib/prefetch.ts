// Lazy-route prefetcher: warms the JS chunk for a page so navigation feels instant.
// Called on hover / focus / touchstart of nav items, and on idle for the most-used pages.

type Loader = () => Promise<unknown>;

const loaders: Record<string, Loader> = {
  "/dashboard":      () => import("@/pages/Dashboard"),
  "/pos":            () => import("@/pages/POS"),
  "/":               () => import("@/pages/POS"),
  "/inventory":      () => import("@/pages/Inventory"),
  "/purchases":      () => import("@/pages/Purchases"),
  "/customers":      () => import("@/pages/Customers"),
  "/suppliers":      () => import("@/pages/Suppliers"),
  "/accounting":     () => import("@/pages/Accounting"),
  "/reports":        () => import("@/pages/Reports"),
  "/invoices":       () => import("@/pages/Invoices"),
  "/branches":       () => import("@/pages/Branches"),
  "/devices":        () => import("@/pages/Devices"),
  "/transfers":      () => import("@/pages/Transfers"),
  "/shortages":      () => import("@/pages/Shortages"),
  "/returns":        () => import("@/pages/SupplierReturns"),
  "/cash-register":  () => import("@/pages/CashRegister"),
  "/payments":       () => import("@/pages/Payments"),
  "/whatsapp":       () => import("@/pages/WhatsApp"),
  "/settings":       () => import("@/pages/Settings"),
  "/super-admin":    () => import("@/pages/SuperAdmin"),
  "/users":          () => import("@/pages/UserManagement"),
  "/attendance":     () => import("@/pages/Attendance"),
  "/onboarding":     () => import("@/pages/Onboarding"),
};

const loaded = new Set<string>();

export function prefetchRoute(url: string) {
  const loader = loaders[url];
  if (!loader || loaded.has(url)) return;
  loaded.add(url);
  // Fire-and-forget; ignore failures — user will retry on click.
  loader().catch(() => loaded.delete(url));
}

/** Warm the most-used routes during browser idle time. */
export function warmCommonRoutes() {
  const idle = (cb: () => void) =>
    "requestIdleCallback" in window
      ? (window as any).requestIdleCallback(cb, { timeout: 2000 })
      : setTimeout(cb, 1200);

  idle(() => {
    ["/dashboard", "/inventory", "/invoices", "/customers", "/reports"].forEach(prefetchRoute);
  });
}
