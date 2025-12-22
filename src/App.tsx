import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Loader2 } from "lucide-react";

// Eager load critical pages
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy load all other pages for faster initial load
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Orders = lazy(() => import("./pages/Orders"));
const NewOrder = lazy(() => import("./pages/NewOrder"));
const OrderDetails = lazy(() => import("./pages/OrderDetails"));
const Financial = lazy(() => import("./pages/Financial"));
const ImageGenerator = lazy(() => import("./pages/ImageGenerator"));
const PriceTable = lazy(() => import("./pages/PriceTable"));
const Planos = lazy(() => import("./pages/Planos"));
const Patients = lazy(() => import("./pages/Patients"));
const Appointments = lazy(() => import("./pages/Appointments"));
const Laboratory = lazy(() => import("./pages/Laboratory"));
const Laboratories = lazy(() => import("./pages/Laboratories"));
const Billing = lazy(() => import("./pages/Billing"));
const Settings = lazy(() => import("./pages/Settings"));
const ClinicDashboard = lazy(() => import("./pages/ClinicDashboard"));
const DentistDashboard = lazy(() => import("./pages/DentistDashboard"));
const Deliveries = lazy(() => import("./pages/Deliveries"));
const NewDelivery = lazy(() => import("./pages/NewDelivery"));
const DeliveryDetails = lazy(() => import("./pages/DeliveryDetails"));
const DeliveryPersons = lazy(() => import("./pages/DeliveryPersons"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Lazy load heavy components
const AppSidebar = lazy(() => import("@/components/AppSidebar").then(m => ({ default: m.AppSidebar })));
const FreemiumNotifications = lazy(() => import("@/components/FreemiumNotifications").then(m => ({ default: m.FreemiumNotifications })));

// Lazy load sidebar provider
const SidebarProviderWrapper = lazy(() => import("@/components/ui/sidebar").then(m => ({ 
  default: ({ children }: { children: React.ReactNode }) => (
    <m.SidebarProvider>{children}</m.SidebarProvider>
  )
})));

const SidebarTriggerWrapper = lazy(() => import("@/components/ui/sidebar").then(m => ({ 
  default: m.SidebarTrigger 
})));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Loading component for suspense
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider delayDuration={0}>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={null}>
              <FreemiumNotifications />
            </Suspense>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <SidebarProviderWrapper>
                        <div className="flex min-h-screen w-full bg-background">
                          <Suspense fallback={null}>
                            <AppSidebar />
                          </Suspense>
                          <main className="flex-1 w-full min-w-0">
                            <header className="sticky top-0 z-50 h-14 flex items-center gap-2 border-b bg-card shadow-sm px-3 md:px-4">
                              <Suspense fallback={<div className="w-8 h-8" />}>
                                <SidebarTriggerWrapper className="-ml-1" />
                              </Suspense>
                              <h1 className="text-sm md:text-base font-semibold text-foreground truncate">DentLab Connect</h1>
                            </header>
                            <Suspense fallback={<PageLoader />}>
                              <Routes>
                                <Route path="/dashboard" element={<Dashboard />} />
                                <Route path="/dentist" element={<DentistDashboard />} />
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
                                <Route path="/laboratories" element={<Laboratories />} />
                                <Route path="/billing" element={<Billing />} />
                                <Route path="/deliveries" element={<Deliveries />} />
                                <Route path="/deliveries/new" element={<NewDelivery />} />
                                <Route path="/deliveries/:id" element={<DeliveryDetails />} />
                                <Route path="/delivery-persons" element={<DeliveryPersons />} />
                                <Route path="/settings" element={<Settings />} />
                                <Route path="*" element={<NotFound />} />
                              </Routes>
                            </Suspense>
                          </main>
                        </div>
                      </SidebarProviderWrapper>
                    </Suspense>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;