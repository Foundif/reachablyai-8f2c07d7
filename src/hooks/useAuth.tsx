import { useState, useEffect, useCallback, createContext, useContext, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'manager' | 'receptionist' | 'freelancer' | 'owner' | 'staff';

interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  country: string | null;
  currency: string | null;
  language: string | null;
  onboarding_completed: boolean | null;
  store_name: string | null;
  trial_start_date: string | null;
  trial_end_date: string | null;
  subscription_status: string | null;
  logo_url?: string | null;
  tagline?: string | null;
  services_concept?: string | null;
  price_list_url?: string | null;
  business_type?: string | null;
  phone?: string | null;
  address?: string | null;
  owner_id?: string | null;
  is_staff?: boolean | null;
  allowed_modules?: string[] | null;
}

// Role permission map
// owner = full access (salon owner), staff = receptionist alias
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  freelancer: ['*'],
  owner: ['*'],
  manager: [
    '/', '/shop-info', '/create-bill', '/pos-billing', '/bookings', '/customers',
    '/services', '/employees', '/staffs', '/expenses',
    '/gst-sales', '/without-gst-sales', '/analytics', '/inventory',
    '/suppliers', '/purchases', '/profile', '/pricing',
  ],
  receptionist: [
    '/', '/create-bill', '/pos-billing', '/bookings', '/customers', '/inventory', '/profile',
  ],
  staff: [
    '/', '/create-bill', '/pos-billing', '/bookings', '/customers', '/inventory', '/profile',
  ],
};

export const canAccessRoute = (role: string | null, route: string): boolean => {
  const r = role || 'freelancer';
  const perms = ROLE_PERMISSIONS[r] || ROLE_PERMISSIONS['freelancer'];
  if (perms.includes('*')) return true;
  return perms.includes(route);
};

export const getAccessibleRoutes = (role: AppRole | null): string[] => {
  const r = role || 'freelancer';
  const perms = ROLE_PERMISSIONS[r];
  if (perms.includes('*')) return Object.keys(ROLE_PERMISSIONS).length > 0 ? ['*'] : [];
  return perms;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  canAccess: (route: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        setProfile(data as Profile);
      } else {
        setProfile(null);
      }
      return data;
    } catch (err) {
      console.error('Error fetching profile:', err);
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    // Safety timeout - if loading doesn't resolve in 8 seconds, force it
    const timeout = setTimeout(() => {
      if (!initialized.current) {
        console.warn('Auth loading timeout - forcing loading to false');
        setLoading(false);
        initialized.current = true;
      }
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Use setTimeout to avoid Supabase deadlock on auth state change
        setTimeout(async () => {
          await fetchProfile(session.user.id);
          setLoading(false);
          initialized.current = true;
        }, 0);
      } else {
        setProfile(null);
        setLoading(false);
        initialized.current = true;
      }
    });

    // Also get initial session as fallback
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!initialized.current) {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
        setLoading(false);
        initialized.current = true;
      }
    }).catch(() => {
      setLoading(false);
      initialized.current = true;
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName || '' }
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user logged in') };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);

    if (!error) {
      await fetchProfile(user.id);
    }
    return { error };
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const canAccess = useCallback((route: string) => {
    // Staff users: hard-restrict to their allowed_modules list.
    // Non-staff (owners / admins): fall back to role-based defaults.
    if (profile?.is_staff) {
      const mods = profile?.allowed_modules || [];
      // Always allow profile page so they can sign out / view account
      if (route === '/profile') return true;
      return mods.includes(route);
    }
    return canAccessRoute(profile?.role as AppRole | null, route);
  }, [profile?.role, profile?.is_staff, profile?.allowed_modules]);

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading,
      signUp, signIn, signOut, updateProfile, refreshProfile, canAccess
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
