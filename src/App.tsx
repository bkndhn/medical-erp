import { Suspense, lazy } from "react";
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

// All other pages — lazy loaded for instant navigation
const Onboarding     = lazy(() => import("./pages/Onboarding"));
const Dashboard      = lazy(() => import("./pages/Dashboard"));
const Inventory      = lazy(() => import("./pages/Inventory"));
const Purchases      = lazy(() => import("./pages/Purchases"));
const Customers      = lazy(() => import("./pages/Customers"));
const Suppliers      = lazy(() => import("./pages/Suppliers"));
const Accounting     = lazy(() => import("./pages/Accounting"));
const Reports        = lazy(() => import("./pages/Reports"));
const Invoices       = lazy(() => import("./pages/Invoices"));
const Branches       = lazy(() => import("./pages/Branches"));
const Devices        = lazy(() => import("./pages/Devices"));
const Payments       = lazy(() => import("./pages/Payments"));
const WhatsApp       = lazy(() => import("./pages/WhatsApp"));
const Transfers      = lazy(() => import("./pages/Transfers"));
const SupplierReturns = lazy(() => import("./pages/SupplierReturns"));
const Shortages      = lazy(() => import("./pages/Shortages"));
const Settings       = lazy(() => import("./pages/Settings"));
const SuperAdmin     = lazy(() => import("./pages/SuperAdmin"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const NotFound       = lazy(() => import("./pages/NotFound"));
const Install        = lazy(() => import("./pages/Install"));
const Attendance     = lazy(() => import("./pages/Attendance"));
const CashRegister   = lazy(() => import("./pages/CashRegister"));

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
