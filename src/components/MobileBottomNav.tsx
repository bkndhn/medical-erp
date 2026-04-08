import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, ShoppingCart, Package, FileText, MoreHorizontal, X,
  Users, Truck, Wallet, BarChart3, Building2, Monitor, CreditCard, Clock,
  MessageSquare, Settings, Shield, UserCog, Zap, ClipboardList
} from "lucide-react";

const primaryNav = [
  { title: "Home", url: "/", icon: LayoutDashboard, page: "pos" },
  { title: "Inventory", url: "/inventory", icon: Package, page: "inventory" },
  { title: "Invoices", url: "/invoices", icon: FileText, page: "invoices" },
];

const moreNav = [
  { title: "Purchases", url: "/purchases", icon: Truck, page: "purchases" },
  { title: "Shortages", url: "/shortages", icon: ClipboardList, page: "shortages" },
  { title: "Customers", url: "/customers", icon: Users, page: "customers" },
  { title: "Suppliers", url: "/suppliers", icon: Users, page: "suppliers" },
  { title: "Accounting", url: "/accounting", icon: Wallet, page: "accounting" },
  { title: "Reports", url: "/reports", icon: BarChart3, page: "reports" },
  { title: "Transfers", url: "/transfers", icon: Truck, page: "transfers" },
  { title: "Returns", url: "/returns", icon: FileText, page: "returns" },
  { title: "Branches", url: "/branches", icon: Building2, page: "branches" },
  { title: "Devices", url: "/devices", icon: Monitor, page: "devices" },
  { title: "Payments", url: "/payments", icon: CreditCard, page: "payments" },
  { title: "Team", url: "/users", icon: UserCog, page: "users" },
  { title: "Attendance", url: "/attendance", icon: Clock, page: "attendance" },
  { title: "WhatsApp", url: "/whatsapp", icon: MessageSquare, page: "whatsapp" },
  { title: "Settings", url: "/settings", icon: Settings, page: "settings" },
  { title: "Super Admin", url: "/super-admin", icon: Shield, page: "super-admin" },
];

export default function MobileBottomNav() {
  const [showMore, setShowMore] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { getPageAccess } = useAuth();

  const allowedPages = getPageAccess();
  const visiblePrimary = primaryNav.filter(n => allowedPages.includes(n.page));
  const visibleMore = moreNav.filter(n => allowedPages.includes(n.page));

  const isActive = (url: string) => location.pathname === url;

  const handleNav = (url: string) => {
    navigate(url);
    setShowMore(false);
  };

  // Don't show on POS page or root (fullscreen)
  if (location.pathname === "/pos" || location.pathname === "/") return null;

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/90 backdrop-blur-md" onClick={() => setShowMore(false)}>
          <div className="absolute bottom-[4.5rem] left-0 right-0 p-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="glass-card rounded-2xl p-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground">More Options</h3>
                <button onClick={() => setShowMore(false)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {visibleMore.map(item => (
                  <button
                    key={item.url}
                    onClick={() => handleNav(item.url)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all touch-manipulation ${
                      isActive(item.url)
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{item.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-xl border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around px-2 h-16">
          {visiblePrimary.slice(0, 4).map(item => (
            <button
              key={item.url}
              onClick={() => handleNav(item.url)}
              className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-all touch-manipulation ${
                isActive(item.url)
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive(item.url) ? "text-primary" : ""}`} />
              <span className="text-[10px] font-medium">{item.title}</span>
              {isActive(item.url) && <span className="absolute top-0 w-8 h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-all touch-manipulation ${
              showMore ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
