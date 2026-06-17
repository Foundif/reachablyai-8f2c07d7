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
// payments tab removed
import TNCustomers from "./pages/TNCustomers";
import TNServices from "./pages/TNServices";
import TNWhatsAppSettings from "./pages/TNWhatsAppSettings";
import TNFlow from "./pages/TNFlow";
import Inbox from "./pages/Inbox";
import ComingSoon from "./pages/ComingSoon";
import Analytics from "./pages/Analytics";
import AIStudio from "./pages/AIStudio";
import FlowBuilder from "./pages/FlowBuilder";
import FlowEditor from "./pages/FlowEditor";
import FlowTemplates from "./pages/FlowTemplates";
import { PermissionLoader } from "@/hooks/usePermissionOverrides";
import Campaigns from "./pages/Campaigns";
import CampaignAnalytics from "./pages/CampaignAnalytics";
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
import Integrations from "./pages/Integrations";
import ApiConsole from "./pages/ApiConsole";
import Webhooks from "./pages/Webhooks";
import AuditLogs from "./pages/AuditLogs";
import Billing from "./pages/Billing";

import KnowledgeBase from "./pages/KnowledgeBase";
import Catalog from "./pages/Catalog";
import Orders from "./pages/Orders";
import AICopilot from "./pages/AICopilot";
import Accounting from "./pages/Accounting";

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

const comingSoonRoutes: string[] = [];

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
                <Route path="/admin-login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminDashboard />} />

                <Route path="/" element={<ProtectedRoute><TNDashboard /></ProtectedRoute>} />
                <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
                <Route path="/messages" element={<Navigate to="/inbox" replace />} />
                <Route path="/bookings" element={<ProtectedRoute><TNBookings /></ProtectedRoute>} />
                <Route path="/payments" element={<ProtectedRoute><TNPayments /></ProtectedRoute>} />
                <Route path="/customers" element={<ProtectedRoute><TNCustomers /></ProtectedRoute>} />
                <Route path="/services" element={<ProtectedRoute><TNServices /></ProtectedRoute>} />
                <Route path="/whatsapp-settings" element={<ProtectedRoute><TNWhatsAppSettings /></ProtectedRoute>} />
                <Route path="/tn-flow" element={<ProtectedRoute><TNFlow /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                <Route path="/ai-studio" element={<ProtectedRoute><AIStudio /></ProtectedRoute>} />
                <Route path="/flows" element={<ProtectedRoute><FlowBuilder /></ProtectedRoute>} />
                <Route path="/flows/templates" element={<ProtectedRoute><FlowTemplates /></ProtectedRoute>} />
                <Route path="/flows/:id" element={<ProtectedRoute><FlowEditor /></ProtectedRoute>} />
                <Route path="/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
                <Route path="/campaigns/:id/analytics" element={<ProtectedRoute><CampaignAnalytics /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/shop-info" element={<ProtectedRoute><ShopInfo /></ProtectedRoute>} />
                <Route path="/guide" element={<ProtectedRoute><Guide /></ProtectedRoute>} />
                <Route path="/team" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
                <Route path="/roles" element={<ProtectedRoute><RolesPermissions /></ProtectedRoute>} />
                <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
                <Route path="/api" element={<ProtectedRoute><ApiConsole /></ProtectedRoute>} />
                <Route path="/webhooks" element={<ProtectedRoute><Webhooks /></ProtectedRoute>} />
                <Route path="/audit" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
                <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
                <Route path="/white-label" element={<Navigate to="/profile" replace />} />
                <Route path="/knowledge" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
                <Route path="/catalog" element={<ProtectedRoute><Catalog /></ProtectedRoute>} />
                <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                <Route path="/copilot" element={<ProtectedRoute><AICopilot /></ProtectedRoute>} />
                <Route path="/accounting" element={<ProtectedRoute><Accounting /></ProtectedRoute>} />

                {comingSoonRoutes.filter(r => r !== '/messages').map((r) => (
                  <Route key={r} path={r} element={<ProtectedRoute><ComingSoon /></ProtectedRoute>} />
                ))}

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
