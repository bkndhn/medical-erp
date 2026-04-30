import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import MobileBottomNav from "@/components/MobileBottomNav";
import { useKeepScreenOn } from "@/hooks/useKeepScreenOn";

export default function Layout() {
  // Keep mobile/tablet display awake across all pages (toggle in Settings → POS).
  useKeepScreenOn();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  );
}

