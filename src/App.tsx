import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import { Loader2 } from "lucide-react";

// Critical path — load immediately (no lazy)
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import POS from "./pages/POS";

import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Purchases from "./pages/Purchases";
import Customers from "./pages/Customers";
import Suppliers from "./pages/Suppliers";
import Accounting from "./pages/Accounting";
import Reports from "./pages/Reports";
import Invoices from "./pages/Invoices";
import Branches from "./pages/Branches";
import Devices from "./pages/Devices";
import Payments from "./pages/Payments";
import WhatsApp from "./pages/WhatsApp";
import Transfers from "./pages/Transfers";
import SupplierReturns from "./pages/SupplierReturns";
import Shortages from "./pages/Shortages";
import Settings from "./pages/Settings";
import SuperAdmin from "./pages/SuperAdmin";
import UserManagement from "./pages/UserManagement";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";
import Attendance from "./pages/Attendance";
import CashRegister from "./pages/CashRegister";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,       // cache queries for 1 min → fewer redundant fetches
      gcTime: 300_000,         // keep unused cache for 5 min
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PageFallback = () => (
  <div className="flex items-center justify-center h-screen bg-background">
    <Loader2 className="h-7 w-7 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/install" element={<Install />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/" element={<POS />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/purchases" element={<Purchases />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/suppliers" element={<Suppliers />} />
                <Route path="/accounting" element={<Accounting />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/branches" element={<Branches />} />
                <Route path="/devices" element={<Devices />} />
                <Route path="/transfers" element={<Transfers />} />
                <Route path="/shortages" element={<Shortages />} />
                <Route path="/returns" element={<SupplierReturns />} />
                <Route path="/cash-register" element={<CashRegister />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/whatsapp" element={<WhatsApp />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/super-admin" element={<SuperAdmin />} />
                <Route path="/users" element={<UserManagement />} />
                <Route path="/attendance" element={<Attendance />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
