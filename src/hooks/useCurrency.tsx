import { useAuth } from './useAuth';

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  JPY: '¥',
  AED: 'د.إ',
};

export const useCurrency = () => {
  const { profile } = useAuth();
  return profile?.currency || 'INR';
};

export const getCurrencySymbol = (currency: string): string => {
  return CURRENCY_SYMBOLS[currency] || currency;
};
