import { lazy, Suspense } from "react";
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
const Dashboard = lazy(() => import("./pages/Dashboard"));
const WhatsAppSettings = lazy(() => import("./pages/WhatsAppSettings"));
const WhatsAppCallback = lazy(() => import("./pages/WhatsAppCallback"));
const Inbox = lazy(() => import("./pages/Inbox"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Profile = lazy(() => import("./pages/Profile"));
const ShopInfo = lazy(() => import("./pages/ShopInfo"));
const Guide = lazy(() => import("./pages/Guide"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Auth = lazy(() => import("./pages/Auth"));
import OnboardingGate from "@/components/onboarding/OnboardingGate";
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TeamManagement = lazy(() => import("./pages/TeamManagement"));
const RolesPermissions = lazy(() => import("./pages/RolesPermissions"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const Accounting = lazy(() => import("./pages/Accounting"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Leads = lazy(() => import("./pages/Leads"));
const ComingSoonModule = lazy(() => import("./pages/ComingSoonModule"));
const Templates = lazy(() => import("./pages/Templates"));
const Integrations = lazy(() => import("./pages/Integrations"));
const WebhookDetail = lazy(() => import("./pages/WebhookDetail"));
const TemplateEditor = lazy(() => import("./pages/TemplateEditor"));
const Bookings = lazy(() => import("./pages/Bookings"));
const Flows = lazy(() => import("./pages/Flows"));
const ApiSettings = lazy(() => import("./pages/ApiSettings"));

const Campaigns = lazy(() => import("./pages/Campaigns"));
const CampaignDetail = lazy(() => import("./pages/Campaigns").then((m) => ({ default: m.CampaignDetail })));
const Services = lazy(() => import("./pages/Services"));
const Automations = lazy(() => import("./pages/Automations"));
const AutoReplies = lazy(() => import("./pages/AutoReplies"));
const Chatbots = lazy(() => import("./pages/Chatbots"));
const ChatbotDetail = lazy(() => import("./pages/ChatbotDetail"));





const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 } } });

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

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
  return (<><OnboardingGate /><TrialExpiredModal /><TrialModal />{children}</>);
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
              <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/onboarding" element={<Navigate to="/" replace />} />
                <Route path="/whatsapp/callback" element={<WhatsAppCallback />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/admin-login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminDashboard />} />

                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
                <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
                <Route path="/services" element={<ProtectedRoute><Services /></ProtectedRoute>} />
                <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
                <Route path="/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
                <Route path="/campaigns/:id" element={<ProtectedRoute><CampaignDetail /></ProtectedRoute>} />
                <Route path="/automation" element={<ProtectedRoute><Automations /></ProtectedRoute>} />
                <Route path="/auto-replies" element={<ProtectedRoute><AutoReplies /></ProtectedRoute>} />
                <Route path="/chatbots" element={<ProtectedRoute><Chatbots /></ProtectedRoute>} />
                <Route path="/chatbots/:id" element={<ProtectedRoute><ChatbotDetail /></ProtectedRoute>} />

                <Route path="/scraper" element={<ProtectedRoute><ComingSoonModule title="Lead Scraper" description="Google Maps / GMB lead scraper with location, keyword and 'website missing' filters — shipping in step 2h." /></ProtectedRoute>} />
                <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
                <Route path="/flows" element={<ProtectedRoute><Flows /></ProtectedRoute>} />
                <Route path="/settings/api" element={<ProtectedRoute><ApiSettings /></ProtectedRoute>} />
                <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
                <Route path="/integrations/webhooks/:id" element={<ProtectedRoute><WebhookDetail /></ProtectedRoute>} />

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
                
                <Route path="/customers" element={<Navigate to="/leads" replace />} />
                
                <Route path="/payments" element={<Navigate to="/accounting" replace />} />
                <Route path="/sheets" element={<Navigate to="/leads" replace />} />
                <Route path="/flow-editor" element={<Navigate to="/flows" replace />} />
                <Route path="/razorpay" element={<Navigate to="/whatsapp-settings" replace />} />
                <Route path="/billing" element={<Navigate to="/pricing" replace />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
