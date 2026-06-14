import { useLocation, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { MODULE_INDEX } from '@/lib/modules';
import { Sparkles, ArrowLeft, Bell } from 'lucide-react';

const ComingSoon = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const mod = MODULE_INDEX[pathname];
  const Icon = mod?.icon ?? Sparkles;

  return (
    <AppLayout>
      <div className="p-4 md:p-8">
        <div className="relative max-w-3xl mx-auto mt-8 md:mt-16">
          {/* Aurora backdrop */}
          <div className="absolute -inset-20 -z-10">
            <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-primary/20 blur-3xl animate-aurora" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-secondary/20 blur-3xl animate-aurora" style={{ animationDelay: '3s' }} />
          </div>

          <div className="glass-elevated glass-sheen p-8 md:p-12 text-center">
            <div className="relative mx-auto w-20 h-20 mb-6">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent blur-xl opacity-60 animate-pulse-ring" />
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center shadow-glow animate-float">
                <Icon className="w-9 h-9 text-white" />
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/20 text-accent text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles className="w-3 h-3" /> Coming in next wave
            </div>

            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              <span className="aurora-text">{mod?.label ?? 'New module'}</span>
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
              {mod?.description ?? 'This module is being crafted with the same liquid-glass design system you see across the platform.'}
            </p>

            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel hover:bg-white/[0.06] transition-all text-sm font-medium"
              >
                <ArrowLeft className="w-4 h-4" /> Go back
              </button>
              <button
                onClick={() => navigate('/inbox')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold shadow-glow magnetic"
              >
                <Bell className="w-4 h-4" /> Notify me when ready
              </button>
            </div>
          </div>

          {/* Roadmap teaser */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
            {['Built on liquid glass', 'AI-native by design', 'Mobile + desktop perfect'].map((t, i) => (
              <div key={t} className="glass-panel p-4 text-sm text-muted-foreground">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-2">
                  <span className="text-xs font-bold text-primary">{i + 1}</span>
                </div>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ComingSoon;
