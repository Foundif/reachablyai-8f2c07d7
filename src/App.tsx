import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import TrialExpiredModal from "@/components/trial/TrialExpiredModal";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { LanguageProvider } from "@/hooks/useLanguage";
import TNDashboard from "./pages/TNDashboard";
import TNBookings from "./pages/TNBookings";
import TNCustomers from "./pages/TNCustomers";
import TNServices from "./pages/TNServices";
import TNWhatsAppSettings from "./pages/TNWhatsAppSettings";
import Inbox from "./pages/Inbox";
import ComingSoon from "./pages/ComingSoon";
import Analytics from "./pages/Analytics";
import { PermissionLoader } from "@/hooks/usePermissionOverrides";
import Profile from "./pages/Profile";
import ShopInfo from "./pages/ShopInfo";
import Guide from "./pages/Guide";
import Pricing from "./pages/Pricing";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import TeamManagement from "./pages/TeamManagement";
import RolesPermissions from "./pages/RolesPermissions";
import AuditLogs from "./pages/AuditLogs";
import Accounting from "./pages/Accounting";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import RazorpaySettings from "./pages/RazorpaySettings";
import BookingDetail from "./pages/BookingDetail";
import FlowEditorPage from "./pages/FlowEditorPage";
import SheetsViewer from "./pages/SheetsViewer";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, profile } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (profile && !profile.onboarding_completed) return <Navigate to="/onboarding" replace />;
  return (<><TrialExpiredModal />{children}</>);
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <PermissionLoader />
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <InstallPrompt />
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/admin-login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminDashboard />} />

                <Route path="/" element={<ProtectedRoute><TNDashboard /></ProtectedRoute>} />
                <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
                <Route path="/messages" element={<Navigate to="/inbox" replace />} />
                <Route path="/bookings" element={<ProtectedRoute><TNBookings /></ProtectedRoute>} />
                <Route path="/bookings/:id" element={<ProtectedRoute><BookingDetail /></ProtectedRoute>} />
                <Route path="/payments" element={<Navigate to="/accounting" replace />} />
                <Route path="/customers" element={<ProtectedRoute><TNCustomers /></ProtectedRoute>} />
                <Route path="/services" element={<ProtectedRoute><TNServices /></ProtectedRoute>} />
                <Route path="/whatsapp-settings" element={<ProtectedRoute><TNWhatsAppSettings /></ProtectedRoute>} />
                <Route path="/flow-editor" element={<ProtectedRoute><FlowEditorPage /></ProtectedRoute>} />
                <Route path="/sheets" element={<ProtectedRoute><SheetsViewer /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/shop-info" element={<ProtectedRoute><ShopInfo /></ProtectedRoute>} />
                <Route path="/guide" element={<ProtectedRoute><Guide /></ProtectedRoute>} />
                <Route path="/team" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
                <Route path="/roles" element={<ProtectedRoute><RolesPermissions /></ProtectedRoute>} />
                <Route path="/audit" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
                <Route path="/accounting" element={<ProtectedRoute><Accounting /></ProtectedRoute>} />
                <Route path="/razorpay" element={<ProtectedRoute><RazorpaySettings /></ProtectedRoute>} />

                {/* Legacy routes redirect to active pages */}
                <Route path="/tn-flow" element={<Navigate to="/flow-editor" replace />} />
                <Route path="/flows" element={<Navigate to="/flow-editor" replace />} />
                <Route path="/flows/templates" element={<Navigate to="/flow-editor" replace />} />
                <Route path="/flows/:id" element={<Navigate to="/flow-editor" replace />} />
                <Route path="/campaigns" element={<Navigate to="/" replace />} />
                <Route path="/campaigns/:id/analytics" element={<Navigate to="/analytics" replace />} />
                <Route path="/ai-studio" element={<Navigate to="/" replace />} />
                <Route path="/copilot" element={<Navigate to="/" replace />} />
                <Route path="/knowledge" element={<Navigate to="/" replace />} />
                <Route path="/catalog" element={<Navigate to="/services" replace />} />
                <Route path="/orders" element={<Navigate to="/bookings" replace />} />
                <Route path="/integrations" element={<Navigate to="/whatsapp-settings" replace />} />
                <Route path="/api" element={<Navigate to="/whatsapp-settings" replace />} />
                <Route path="/webhooks" element={<Navigate to="/whatsapp-settings" replace />} />
                <Route path="/billing" element={<Navigate to="/pricing" replace />} />
                <Route path="/white-label" element={<Navigate to="/profile" replace />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
