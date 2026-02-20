import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import ComingSoon from "./pages/ComingSoon";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/inventory" element={<ComingSoon />} />
            <Route path="/purchases" element={<ComingSoon />} />
            <Route path="/customers" element={<ComingSoon />} />
            <Route path="/suppliers" element={<ComingSoon />} />
            <Route path="/accounting" element={<ComingSoon />} />
            <Route path="/reports" element={<ComingSoon />} />
            <Route path="/invoices" element={<ComingSoon />} />
            <Route path="/branches" element={<ComingSoon />} />
            <Route path="/devices" element={<ComingSoon />} />
            <Route path="/payments" element={<ComingSoon />} />
            <Route path="/whatsapp" element={<ComingSoon />} />
            <Route path="/settings" element={<ComingSoon />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
