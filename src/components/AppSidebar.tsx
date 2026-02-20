import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, ShoppingCart, Package, Users, FileText,
  Settings, Truck, CreditCard, Building2,
  Monitor, ChevronLeft, ChevronRight, Zap,
  BarChart3, Wallet, MessageSquare, LogOut
} from "lucide-react";

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "POS Billing", url: "/pos", icon: ShoppingCart, highlight: true },
];

const moduleNav = [
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Purchases", url: "/purchases", icon: Truck },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Suppliers", url: "/suppliers", icon: Users },
  { title: "Accounting", url: "/accounting", icon: Wallet },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Invoices", url: "/invoices", icon: FileText },
];

const adminNav = [
  { title: "Branches", url: "/branches", icon: Building2 },
  { title: "Devices", url: "/devices", icon: Monitor },
  { title: "Payments", url: "/payments", icon: CreditCard },
  { title: "WhatsApp", url: "/whatsapp", icon: MessageSquare },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const renderNavItem = (item: typeof mainNav[0] & { highlight?: boolean }) => (
    <li key={item.url}>
      <button
        onClick={() => navigate(item.url)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group
          ${isActive(item.url)
            ? 'bg-primary/10 text-primary border border-primary/20'
            : item.highlight
              ? 'text-accent hover:bg-accent/10 hover:text-accent'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          }`}
      >
        <item.icon className={`h-4 w-4 shrink-0 ${isActive(item.url) ? 'text-primary' : item.highlight ? 'text-accent' : ''}`} />
        {!collapsed && <span className="truncate">{item.title}</span>}
        {!collapsed && item.highlight && !isActive(item.url) && <Zap className="h-3 w-3 ml-auto text-accent" />}
      </button>
    </li>
  );

  const renderSection = (label: string, items: typeof mainNav) => (
    <div className="mb-4">
      {!collapsed && <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">{label}</p>}
      <ul className="space-y-1">{items.map(renderNavItem)}</ul>
    </div>
  );

  return (
    <aside className={`h-screen sticky top-0 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
        <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0"><Zap className="h-4 w-4 text-primary" /></div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-foreground tracking-tight">CloudERP</h1>
            <p className="text-[10px] text-muted-foreground truncate">{profile?.full_name || "User"}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-4">
        {renderSection("Main", mainNav)}
        {renderSection("Modules", moduleNav)}
        {renderSection("Admin", adminNav)}
      </nav>

      <div className="border-t border-sidebar-border p-2 shrink-0 space-y-1">
        <button onClick={signOut} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-colors ${collapsed ? 'justify-center' : ''}`}>
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button onClick={() => setCollapsed(!collapsed)} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-sidebar-accent transition-colors">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
