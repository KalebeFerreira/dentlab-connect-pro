import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import NewOrder from "./pages/NewOrder";
import OrderDetails from "./pages/OrderDetails";
import Financial from "./pages/Financial";
import ImageGenerator from "./pages/ImageGenerator";
import PriceTable from "./pages/PriceTable";
import Patients from "./pages/Patients";
import Appointments from "./pages/Appointments";
import MessagesAnalytics from "./pages/MessagesAnalytics";
import Laboratory from "./pages/Laboratory";
import Billing from "./pages/Billing";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/*"
            element={
              <SidebarProvider>
                <div className="flex min-h-screen w-full">
                  <AppSidebar />
                  <main className="flex-1">
                    <header className="sticky top-0 z-10 h-12 flex items-center border-b bg-card">
                      <SidebarTrigger className="ml-2" />
                    </header>
                    <Routes>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/orders" element={<Orders />} />
                      <Route path="/orders/new" element={<NewOrder />} />
                      <Route path="/orders/:id" element={<OrderDetails />} />
                      <Route path="/financial" element={<Financial />} />
                      <Route path="/image-generator" element={<ImageGenerator />} />
                      <Route path="/price-table" element={<PriceTable />} />
                      <Route path="/patients" element={<Patients />} />
                      <Route path="/appointments" element={<Appointments />} />
                      <Route path="/messages-analytics" element={<MessagesAnalytics />} />
                      <Route path="/laboratory" element={<Laboratory />} />
                      <Route path="/billing" element={<Billing />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </main>
                </div>
              </SidebarProvider>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
