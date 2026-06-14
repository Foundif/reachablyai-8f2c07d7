export type RiskLevel = 'safe' | 'medium' | 'high';

export interface PaymentHistory {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  dueDate: string;
  paidDate: string | null;
  delayDays: number;
  status: 'paid' | 'pending' | 'overdue';
}

export interface Client {
  id: string;
  name: string;
  email: string;
  company: string;
  industry: string;
  country: string;
  trustScore: number;
  riskLevel: RiskLevel;
  totalInvoices: number;
  totalPaid: number;
  totalOutstanding: number;
  avgPaymentDelay: number;
  lastPaymentDate: string | null;
  createdAt: string;
  paymentHistory: PaymentHistory[];
}

export interface RiskAlert {
  id: string;
  clientId: string;
  clientName: string;
  type: 'payment_overdue' | 'score_drop' | 'pattern_detected' | 'community_flag';
  severity: RiskLevel;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface CommunityInsight {
  industry: string;
  country: string;
  avgTrustScore: number;
  totalReports: number;
  riskTrend: 'improving' | 'stable' | 'declining';
}
