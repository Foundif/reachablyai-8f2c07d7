import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import TrialExpiredModal from "@/components/trial/TrialExpiredModal";
import TrialModal from "@/components/trial/TrialModal";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { LanguageProvider } from "@/hooks/useLanguage";
import Dashboard from "./pages/Dashboard";
import WhatsAppSettings from "./pages/WhatsAppSettings";
import WhatsAppCallback from "./pages/WhatsAppCallback";
import Inbox from "./pages/Inbox";
import Analytics from "./pages/Analytics";
import Profile from "./pages/Profile";
import ShopInfo from "./pages/ShopInfo";
import Guide from "./pages/Guide";
import Pricing from "./pages/Pricing";
import Auth from "./pages/Auth";
import OnboardingGate from "@/components/onboarding/OnboardingGate";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import TeamManagement from "./pages/TeamManagement";
import RolesPermissions from "./pages/RolesPermissions";
import AuditLogs from "./pages/AuditLogs";
import Accounting from "./pages/Accounting";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Leads from "./pages/Leads";
import ComingSoonModule from "./pages/ComingSoonModule";
import Templates from "./pages/Templates";
import TemplateEditor from "./pages/TemplateEditor";

import Campaigns, { CampaignDetail } from "./pages/Campaigns";
import Automations from "./pages/Automations";
import AutoReplies from "./pages/AutoReplies";
import Chatbots from "./pages/Chatbots";
import ChatbotDetail from "./pages/ChatbotDetail";



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
  return (<><TrialExpiredModal /><TrialModal />{children}</>);
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <InstallPrompt />
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/whatsapp/callback" element={<WhatsAppCallback />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/admin-login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminDashboard />} />

                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
                <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
                <Route path="/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
                <Route path="/campaigns/:id" element={<ProtectedRoute><CampaignDetail /></ProtectedRoute>} />
                <Route path="/automation" element={<ProtectedRoute><Automations /></ProtectedRoute>} />
                <Route path="/auto-replies" element={<ProtectedRoute><AutoReplies /></ProtectedRoute>} />
                <Route path="/chatbots" element={<ProtectedRoute><Chatbots /></ProtectedRoute>} />
                <Route path="/chatbots/:id" element={<ProtectedRoute><ChatbotDetail /></ProtectedRoute>} />

                <Route path="/scraper" element={<ProtectedRoute><ComingSoonModule title="Lead Scraper" description="Google Maps / GMB lead scraper with location, keyword and 'website missing' filters — shipping in step 2h." /></ProtectedRoute>} />
                <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
                <Route path="/templates/new" element={<ProtectedRoute><TemplateEditor /></ProtectedRoute>} />
                <Route path="/templates/:id" element={<ProtectedRoute><TemplateEditor /></ProtectedRoute>} />


                <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                <Route path="/accounting" element={<ProtectedRoute><Accounting /></ProtectedRoute>} />
                <Route path="/whatsapp-settings" element={<ProtectedRoute><WhatsAppSettings /></ProtectedRoute>} />

                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/shop-info" element={<ProtectedRoute><ShopInfo /></ProtectedRoute>} />
                <Route path="/guide" element={<ProtectedRoute><Guide /></ProtectedRoute>} />
                <Route path="/team" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
                <Route path="/roles" element={<ProtectedRoute><RolesPermissions /></ProtectedRoute>} />
                <Route path="/audit" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />

                {/* Legacy redirects */}
                <Route path="/messages" element={<Navigate to="/inbox" replace />} />
                <Route path="/bookings" element={<Navigate to="/leads" replace />} />
                <Route path="/customers" element={<Navigate to="/leads" replace />} />
                <Route path="/services" element={<Navigate to="/" replace />} />
                <Route path="/payments" element={<Navigate to="/accounting" replace />} />
                <Route path="/sheets" element={<Navigate to="/leads" replace />} />
                <Route path="/flow-editor" element={<Navigate to="/automation" replace />} />
                <Route path="/razorpay" element={<Navigate to="/whatsapp-settings" replace />} />
                <Route path="/billing" element={<Navigate to="/pricing" replace />} />

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
