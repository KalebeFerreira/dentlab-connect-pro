import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import NewOrder from "./pages/NewOrder";
import OrderDetails from "./pages/OrderDetails";
import Financial from "./pages/Financial";
import ImageGenerator from "./pages/ImageGenerator";
import PriceTable from "./pages/PriceTable";
import Planos from "./pages/Planos";
import Patients from "./pages/Patients";
import Appointments from "./pages/Appointments";
import Laboratory from "./pages/Laboratory";
import Billing from "./pages/Billing";
import Settings from "./pages/Settings";
import ClinicDashboard from "./pages/ClinicDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
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
                <div className="flex min-h-screen w-full bg-background">
                  <AppSidebar />
                  <main className="flex-1 w-full min-w-0">
                    <header className="sticky top-0 z-50 h-14 flex items-center gap-2 border-b bg-card shadow-sm px-3 md:px-4">
                      <SidebarTrigger className="-ml-1" />
                      <h1 className="text-sm md:text-base font-semibold text-foreground truncate">DentLab Connect</h1>
                    </header>
                    <Routes>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/orders" element={<Orders />} />
                      <Route path="/orders/new" element={<NewOrder />} />
                      <Route path="/orders/:id" element={<OrderDetails />} />
                      <Route path="/financial" element={<Financial />} />
                      <Route path="/image-generator" element={<ImageGenerator />} />
                      <Route path="/price-table" element={<PriceTable />} />
                      <Route path="/planos" element={<Planos />} />
                      <Route path="/patients" element={<Patients />} />
                      <Route path="/appointments" element={<Appointments />} />
                      <Route path="/clinic" element={<ClinicDashboard />} />
                      <Route path="/laboratory" element={<Laboratory />} />
                      <Route path="/billing" element={<Billing />} />
                      <Route path="/settings" element={<Settings />} />
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
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
