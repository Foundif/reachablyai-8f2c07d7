import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';
import { LANGUAGES } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  User, Mail, Globe, DollarSign, Bell, Shield, LogOut,
  Moon, Sun, Loader2, Check, ChevronRight, Crown, Store, Languages,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import ChangePasswordModal from '@/components/profile/ChangePasswordModal';
import { BRAND_ICON_URL } from '@/components/Brand';

const WHITELABEL_STORAGE = 'foundif_whitelabel';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD'];
const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia',
  'Germany', 'France', 'India', 'Singapore', 'Netherlands', 'Other'
];

const Profile = () => {
  const navigate = useNavigate();
  const { user, profile, signOut, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [country, setCountry] = useState(profile?.country || 'India');
  const [currency, setCurrency] = useState(profile?.currency || 'INR');
  const [storeName, setStoreName] = useState(profile?.store_name || 'My Salon');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(true);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [whiteLabel, setWhiteLabel] = useState(() => {
    const raw = localStorage.getItem(WHITELABEL_STORAGE);
    return raw ? JSON.parse(raw) : { brand: 'Chatarly', domain: '', primary: '#111111', hideBadge: false, supportEmail: '' };
  });

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const { error } = await updateProfile({
        full_name: fullName,
        country,
        currency,
        store_name: storeName,
      });
      if (error) throw error;
      toast.success('Settings saved ✓');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const saveWhiteLabel = () => {
    localStorage.setItem(WHITELABEL_STORAGE, JSON.stringify(whiteLabel));
    toast.success('White-label settings saved');
  };

  return (
    <AppLayout>
      <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-0.5 sm:mb-1">{t('profile.title')}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('profile.subtitle')}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4 sm:mb-6">
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <h2 className="font-semibold text-foreground text-sm sm:text-base">{t('profile.profileInfo')}</h2>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex items-center sm:items-start gap-4 sm:flex-col">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center overflow-hidden">
                      {(profile as any)?.logo_url ? <img src={(profile as any).logo_url} alt={storeName} className="w-full h-full object-contain" /> : <img src={BRAND_ICON_URL} alt="Chatarly" className="w-10 h-10 object-contain" />}
                    </div>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="fullName" className="text-xs sm:text-sm">{t('profile.fullName')}</Label>
                        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" className="mt-1.5" />
                      </div>
                      <div>
                        <Label htmlFor="email" className="text-xs sm:text-sm">{t('profile.email')}</Label>
                        <div className="relative mt-1.5">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input id="email" value={user?.email || ''} readOnly className="pl-9 bg-muted" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs sm:text-sm flex items-center gap-1.5"><Store className="w-3.5 h-3.5" />{t('profile.storeName')}</Label>
                      <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="My Salon" className="mt-1.5" />
                      <p className="text-[10px] text-muted-foreground mt-1">This name appears on receipts</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs sm:text-sm flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" />{t('profile.country')}</Label>
                        <Select value={country} onValueChange={setCountry}>
                          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                          <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs sm:text-sm flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" />{t('profile.currency')}</Label>
                        <Select value={currency} onValueChange={setCurrency}>
                          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                          <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button variant="trust" onClick={handleSaveProfile} disabled={loading} className="w-full sm:w-auto">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />{t('profile.saveChanges')}</>}
                  </Button>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4 sm:mb-6">
                <Languages className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <h2 className="font-semibold text-foreground text-sm sm:text-base">{t('profile.language')}</h2>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mb-4">{t('profile.languageDesc')}</p>
              <div className="grid grid-cols-3 gap-3">
                {LANGUAGES.map((lang) => (
                  <button key={lang.id} onClick={() => setLanguage(lang.id)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      language === lang.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 bg-card'
                    }`}>
                    <div className="text-lg font-bold text-foreground">{lang.nativeLabel}</div>
                    <div className="text-xs text-muted-foreground">{lang.label}</div>
                  </button>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4 sm:mb-6">
                {theme === 'dark' ? <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" /> : <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />}
                <h2 className="font-semibold text-foreground text-sm sm:text-base">{t('profile.appearance')}</h2>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground text-sm sm:text-base">{t('profile.darkMode')}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">{t('profile.darkModeDesc')}</p>
                </div>
                <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4 sm:mb-6">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <h2 className="font-semibold text-foreground text-sm sm:text-base">{t('profile.notifications')}</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground text-sm sm:text-base">{t('profile.lowStockAlerts')}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{t('profile.lowStockAlertsDesc')}</p>
                  </div>
                  <Switch checked={emailAlerts} onCheckedChange={setEmailAlerts} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground text-sm sm:text-base">{t('profile.pushNotifications')}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{t('profile.pushNotificationsDesc')}</p>
                  </div>
                  <Switch checked={pushAlerts} onCheckedChange={setPushAlerts} />
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4 sm:mb-6">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <h2 className="font-semibold text-foreground text-sm sm:text-base">{t('profile.security')}</h2>
              </div>
              <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-left" onClick={() => setPasswordModalOpen(true)}>
                <div>
                  <p className="font-medium text-foreground text-sm sm:text-base">{t('profile.changePassword')}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">{t('profile.changePasswordDesc')}</p>
                </div>
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              </button>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4 sm:mb-6">
                <Store className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <h2 className="font-semibold text-foreground text-sm sm:text-base">White label</h2>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><Label className="text-xs sm:text-sm">Brand name</Label><Input value={whiteLabel.brand} onChange={(e) => setWhiteLabel({ ...whiteLabel, brand: e.target.value })} className="mt-1.5" /></div>
                  <div><Label className="text-xs sm:text-sm">Support email</Label><Input type="email" value={whiteLabel.supportEmail} onChange={(e) => setWhiteLabel({ ...whiteLabel, supportEmail: e.target.value })} className="mt-1.5" /></div>
                </div>
                <div><Label className="text-xs sm:text-sm">Custom domain</Label><Input value={whiteLabel.domain} onChange={(e) => setWhiteLabel({ ...whiteLabel, domain: e.target.value })} placeholder="app.yourbrand.com" className="mt-1.5" /></div>
                <div className="flex items-center justify-between">
                  <div><p className="font-medium text-foreground text-sm sm:text-base">Hide Powered by Chatarly</p><p className="text-xs sm:text-sm text-muted-foreground">Available on Growth plan</p></div>
                  <Switch checked={whiteLabel.hideBadge} onCheckedChange={(v) => setWhiteLabel({ ...whiteLabel, hideBadge: v })} />
                </div>
                <Button variant="outline" onClick={saveWhiteLabel} className="w-full sm:w-auto"><Check className="w-4 h-4" />Save white label</Button>
              </div>
            </motion.div>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <h2 className="font-semibold text-foreground text-sm sm:text-base">{t('profile.currentPlan')}</h2>
              </div>
              <div className="p-3 sm:p-4 rounded-xl bg-muted/50 border border-border mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg sm:text-xl font-bold text-foreground">Free</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Current</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">Basic salon management features</p>
              </div>
              <Button variant="trust" className="w-full" onClick={() => navigate('/pricing')}>{t('profile.upgradeToPro')}</Button>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Store className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <h2 className="font-semibold text-foreground text-sm sm:text-base">{t('profile.storeInfo')}</h2>
              </div>
              <div className="flex items-center gap-3 mb-3">
                {(profile as any)?.logo_url ? (
                  <img src={(profile as any).logo_url} alt={storeName} className="w-12 h-12 rounded-lg object-contain border border-border bg-card" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-foreground text-background flex items-center justify-center font-bold">
                    {(storeName?.[0] || 'B').toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm sm:text-base font-medium text-foreground truncate">{storeName}</p>
                  {(profile as any)?.tagline && <p className="text-xs text-muted-foreground truncate">{(profile as any).tagline}</p>}
                  <p className="text-[11px] text-muted-foreground">{t('profile.currency')}: {currency}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/shop-info')}>
                Manage branding & services
              </Button>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Button variant="outline" className="w-full text-risk-high border-risk-high/30 hover:bg-risk-high/10" onClick={handleSignOut}>
                <LogOut className="w-4 h-4" />{t('profile.signOut')}
              </Button>
            </motion.div>
          </div>
        </div>

        <ChangePasswordModal open={passwordModalOpen} onOpenChange={setPasswordModalOpen} />
      </div>
    </AppLayout>
  );
};

export default Profile;
