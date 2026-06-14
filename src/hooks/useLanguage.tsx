import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Language, t as translate } from '@/lib/i18n';
import { useAuth } from './useAuth';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const { profile, updateProfile } = useAuth();
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('chatarly_language');
    return (saved as Language) || 'en';
  });

  useEffect(() => {
    if (profile?.language && ['en', 'hi', 'ta'].includes(profile.language)) {
      setLanguageState(profile.language as Language);
    }
  }, [profile?.language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('chatarly_language', lang);
    updateProfile({ language: lang } as any);
  }, [updateProfile]);

  const t = useCallback((key: string) => translate(key, language), [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback to prevent crashes during HMR or edge cases
    return {
      language: 'en' as Language,
      setLanguage: () => {},
      t: (key: string) => key,
    };
  }
  return context;
};
