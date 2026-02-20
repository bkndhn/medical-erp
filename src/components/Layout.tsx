import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";

export default function Layout() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
