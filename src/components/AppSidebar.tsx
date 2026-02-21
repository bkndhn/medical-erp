import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, ShoppingCart, Package, Users, FileText,
  Settings, Truck, CreditCard, Building2,
  Monitor, ChevronLeft, ChevronRight, Zap,
  BarChart3, Wallet, MessageSquare, LogOut, Shield, Menu, X, UserCog
} from "lucide-react";

const allNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, page: "dashboard" },
  { title: "POS Billing", url: "/pos", icon: ShoppingCart, page: "pos", highlight: true },
  { title: "Inventory", url: "/inventory", icon: Package, page: "inventory", section: "Modules" },
  { title: "Purchases", url: "/purchases", icon: Truck, page: "purchases", section: "Modules" },
  { title: "Customers", url: "/customers", icon: Users, page: "customers", section: "Modules" },
  { title: "Suppliers", url: "/suppliers", icon: Users, page: "suppliers", section: "Modules" },
  { title: "Accounting", url: "/accounting", icon: Wallet, page: "accounting", section: "Modules" },
  { title: "Reports", url: "/reports", icon: BarChart3, page: "reports", section: "Modules" },
  { title: "Invoices", url: "/invoices", icon: FileText, page: "invoices", section: "Modules" },
  { title: "Branches", url: "/branches", icon: Building2, page: "branches", section: "Admin" },
  { title: "Devices", url: "/devices", icon: Monitor, page: "devices", section: "Admin" },
  { title: "Payments", url: "/payments", icon: CreditCard, page: "payments", section: "Admin" },
  { title: "Team", url: "/users", icon: UserCog, page: "users", section: "Admin" },
  { title: "WhatsApp", url: "/whatsapp", icon: MessageSquare, page: "whatsapp", section: "Admin" },
  { title: "Settings", url: "/settings", icon: Settings, page: "settings", section: "Admin" },
  { title: "Super Admin", url: "/super-admin", icon: Shield, page: "super-admin", section: "System" },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, getPageAccess } = useAuth();

  const allowedPages = getPageAccess();
  const visibleNav = allNav.filter(n => allowedPages.includes(n.page));

  const isActive = (path: string) => location.pathname === path;

  const handleNav = (url: string) => {
    navigate(url);
    setMobileOpen(false);
  };

  const renderNavItem = (item: typeof allNav[0]) => (
    <li key={item.url}>
      <button
        onClick={() => handleNav(item.url)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group touch-manipulation
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

  const sections = [
    { label: "Main", items: visibleNav.filter(n => !n.section) },
    { label: "Modules", items: visibleNav.filter(n => n.section === "Modules") },
    { label: "Admin", items: visibleNav.filter(n => n.section === "Admin") },
    { label: "System", items: visibleNav.filter(n => n.section === "System") },
  ].filter(s => s.items.length > 0);

  const sidebarContent = (
    <>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
        <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0"><Zap className="h-4 w-4 text-primary" /></div>
        {!collapsed && (
          <div className="overflow-hidden flex-1 min-w-0">
            <h1 className="text-sm font-bold text-foreground tracking-tight">CloudERP</h1>
            <p className="text-[10px] text-muted-foreground truncate">{profile?.full_name || "User"}</p>
          </div>
        )}
        {/* Mobile close button */}
        <button onClick={() => setMobileOpen(false)} className="md:hidden p-1 rounded hover:bg-muted text-muted-foreground ml-auto">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-4">
        {sections.map(s => (
          <div key={s.label} className="mb-4">
            {!collapsed && <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">{s.label}</p>}
            <ul className="space-y-1">{s.items.map(renderNavItem)}</ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2 shrink-0 space-y-1">
        <button onClick={signOut} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-colors touch-manipulation ${collapsed ? 'justify-center' : ''}`}>
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button onClick={() => setCollapsed(!collapsed)} className="hidden md:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-sidebar-accent transition-colors">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>Collapse</span></>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-card border border-border shadow-lg touch-manipulation"
      >
        <Menu className="h-5 w-5 text-foreground" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className={`hidden md:flex h-screen sticky top-0 flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>
        {sidebarContent}
      </aside>
    </>
  );
}
