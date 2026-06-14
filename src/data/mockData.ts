import { Client, RiskAlert, CommunityInsight } from '@/types/client';

export const mockClients: Client[] = [
  {
    id: '1',
    name: 'Sarah Mitchell',
    email: 'sarah@techventures.com',
    company: 'Tech Ventures Inc.',
    industry: 'Technology',
    country: 'United States',
    trustScore: 92,
    riskLevel: 'safe',
    totalInvoices: 24,
    totalPaid: 185000,
    totalOutstanding: 12500,
    avgPaymentDelay: 2,
    lastPaymentDate: '2024-01-15',
    createdAt: '2023-01-10',
    paymentHistory: [
      { id: 'ph1', invoiceId: 'INV-001', amount: 15000, currency: 'USD', dueDate: '2024-01-10', paidDate: '2024-01-12', delayDays: 2, status: 'paid' },
      { id: 'ph2', invoiceId: 'INV-002', amount: 12500, currency: 'USD', dueDate: '2024-02-15', paidDate: null, delayDays: 0, status: 'pending' },
    ]
  },
  {
    id: '2',
    name: 'Marcus Chen',
    email: 'marcus@globalretail.com',
    company: 'Global Retail Solutions',
    industry: 'Retail',
    country: 'Canada',
    trustScore: 68,
    riskLevel: 'medium',
    totalInvoices: 18,
    totalPaid: 92000,
    totalOutstanding: 28000,
    avgPaymentDelay: 14,
    lastPaymentDate: '2024-01-08',
    createdAt: '2023-03-22',
    paymentHistory: [
      { id: 'ph3', invoiceId: 'INV-003', amount: 8000, currency: 'USD', dueDate: '2024-01-01', paidDate: '2024-01-08', delayDays: 7, status: 'paid' },
      { id: 'ph4', invoiceId: 'INV-004', amount: 28000, currency: 'USD', dueDate: '2024-01-20', paidDate: null, delayDays: 15, status: 'overdue' },
    ]
  },
  {
    id: '3',
    name: 'Elena Rodriguez',
    email: 'elena@mediagroup.es',
    company: 'MediaGroup España',
    industry: 'Media',
    country: 'Spain',
    trustScore: 35,
    riskLevel: 'high',
    totalInvoices: 8,
    totalPaid: 25000,
    totalOutstanding: 45000,
    avgPaymentDelay: 42,
    lastPaymentDate: '2023-11-20',
    createdAt: '2023-06-15',
    paymentHistory: [
      { id: 'ph5', invoiceId: 'INV-005', amount: 20000, currency: 'EUR', dueDate: '2023-10-15', paidDate: '2023-11-20', delayDays: 36, status: 'paid' },
      { id: 'ph6', invoiceId: 'INV-006', amount: 45000, currency: 'EUR', dueDate: '2023-12-01', paidDate: null, delayDays: 55, status: 'overdue' },
    ]
  },
  {
    id: '4',
    name: 'James Morrison',
    email: 'james@finserve.co.uk',
    company: 'FinServe Ltd',
    industry: 'Finance',
    country: 'United Kingdom',
    trustScore: 88,
    riskLevel: 'safe',
    totalInvoices: 32,
    totalPaid: 420000,
    totalOutstanding: 35000,
    avgPaymentDelay: 1,
    lastPaymentDate: '2024-01-18',
    createdAt: '2022-08-05',
    paymentHistory: [
      { id: 'ph7', invoiceId: 'INV-007', amount: 55000, currency: 'GBP', dueDate: '2024-01-15', paidDate: '2024-01-18', delayDays: 3, status: 'paid' },
      { id: 'ph8', invoiceId: 'INV-008', amount: 35000, currency: 'GBP', dueDate: '2024-02-01', paidDate: null, delayDays: 0, status: 'pending' },
    ]
  },
  {
    id: '5',
    name: 'Yuki Tanaka',
    email: 'yuki@innovatejp.com',
    company: 'Innovate Japan',
    industry: 'Technology',
    country: 'Japan',
    trustScore: 95,
    riskLevel: 'safe',
    totalInvoices: 45,
    totalPaid: 780000,
    totalOutstanding: 0,
    avgPaymentDelay: 0,
    lastPaymentDate: '2024-01-20',
    createdAt: '2022-02-14',
    paymentHistory: [
      { id: 'ph9', invoiceId: 'INV-009', amount: 95000, currency: 'JPY', dueDate: '2024-01-20', paidDate: '2024-01-20', delayDays: 0, status: 'paid' },
    ]
  },
  {
    id: '6',
    name: 'Omar Hassan',
    email: 'omar@buildco.ae',
    company: 'BuildCo UAE',
    industry: 'Construction',
    country: 'United Arab Emirates',
    trustScore: 52,
    riskLevel: 'medium',
    totalInvoices: 12,
    totalPaid: 180000,
    totalOutstanding: 95000,
    avgPaymentDelay: 28,
    lastPaymentDate: '2023-12-05',
    createdAt: '2023-04-01',
    paymentHistory: [
      { id: 'ph10', invoiceId: 'INV-010', amount: 60000, currency: 'AED', dueDate: '2023-11-15', paidDate: '2023-12-05', delayDays: 20, status: 'paid' },
      { id: 'ph11', invoiceId: 'INV-011', amount: 95000, currency: 'AED', dueDate: '2024-01-01', paidDate: null, delayDays: 24, status: 'overdue' },
    ]
  },
];

export const mockAlerts: RiskAlert[] = [
  {
    id: 'alert1',
    clientId: '3',
    clientName: 'MediaGroup España',
    type: 'payment_overdue',
    severity: 'high',
    message: 'Invoice INV-006 is 55 days overdue ($45,000)',
    createdAt: '2024-01-25T10:30:00Z',
    read: false,
  },
  {
    id: 'alert2',
    clientId: '6',
    clientName: 'BuildCo UAE',
    type: 'pattern_detected',
    severity: 'medium',
    message: 'Consistent late payment pattern detected (avg 28 days)',
    createdAt: '2024-01-24T14:15:00Z',
    read: false,
  },
  {
    id: 'alert3',
    clientId: '2',
    clientName: 'Global Retail Solutions',
    type: 'score_drop',
    severity: 'medium',
    message: 'Trust score dropped from 75 to 68 this month',
    createdAt: '2024-01-23T09:45:00Z',
    read: true,
  },
  {
    id: 'alert4',
    clientId: '3',
    clientName: 'MediaGroup España',
    type: 'community_flag',
    severity: 'high',
    message: '3 other users reported payment issues with this client',
    createdAt: '2024-01-22T16:20:00Z',
    read: true,
  },
];

export const mockCommunityInsights: CommunityInsight[] = [
  { industry: 'Technology', country: 'United States', avgTrustScore: 78, totalReports: 1250, riskTrend: 'stable' },
  { industry: 'Retail', country: 'Canada', avgTrustScore: 65, totalReports: 430, riskTrend: 'declining' },
  { industry: 'Media', country: 'Spain', avgTrustScore: 58, totalReports: 180, riskTrend: 'declining' },
  { industry: 'Finance', country: 'United Kingdom', avgTrustScore: 82, totalReports: 890, riskTrend: 'improving' },
  { industry: 'Technology', country: 'Japan', avgTrustScore: 91, totalReports: 560, riskTrend: 'improving' },
  { industry: 'Construction', country: 'United Arab Emirates', avgTrustScore: 54, totalReports: 220, riskTrend: 'stable' },
];

export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  const localeMap: Record<string, string> = {
    INR: 'en-IN', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB',
    AUD: 'en-AU', CAD: 'en-CA', JPY: 'ja-JP', AED: 'ar-AE',
  };
  return new Intl.NumberFormat(localeMap[currency] || 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const getTimeAgo = (date: string): string => {
  const now = new Date();
  const past = new Date(date);
  const diffInHours = Math.floor((now.getTime() - past.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInHours < 48) return 'Yesterday';
  return `${Math.floor(diffInHours / 24)}d ago`;
};
