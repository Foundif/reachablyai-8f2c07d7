// Single source of truth for Reachably subscription plans and their limits.
// Limits are mirrored in the database table `plan_limits` (used by triggers
// and edge functions for real enforcement) — keep both in sync.

export type PlanId = 'plus' | 'scale' | 'supreme';
export type BillingPeriod = 'monthly' | 'yearly';

export interface PlanLimits {
  users: number;
  numbers: number;
  contacts: number;
  clients: number;
  messages: number;
}

export interface Plan extends PlanLimits {
  id: PlanId;
  name: string;
  tagline: string;
  usersLabel: string;
  monthly: number;
  /** 50% off, first month only */
  promoMonthly: number;
  yearly: number;
  popular?: boolean;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: 'plus',
    name: 'Plus',
    tagline: 'For small teams getting started on WhatsApp',
    monthly: 3999,
    promoMonthly: 1999.5,
    yearly: 39000,
    users: 3,
    usersLabel: '1–3 users',
    numbers: 1,
    contacts: 5000,
    clients: 5000,
    messages: 10000,
    features: [
      '1–3 users',
      '1 WhatsApp Business number',
      'Up to 5,000 Contacts — Add-ons available',
      'Up to 5,000 Clients — Add-ons available',
      'Up to 10,000 Broadcast/Template messages per month',
      'Additional WhatsApp numbers — Add-ons available',
      'WhatsApp/Meta charges are separate and billed directly with Meta',
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    tagline: 'For growing teams running campaigns at volume',
    monthly: 7999,
    promoMonthly: 3999.5,
    yearly: 79000,
    users: 10,
    usersLabel: '4–10 users',
    numbers: 3,
    contacts: 20000,
    clients: 20000,
    messages: 40000,
    popular: true,
    features: [
      '4–10 users',
      '3 WhatsApp Business numbers',
      'Up to 20,000 Contacts — Add-ons available',
      'Up to 20,000 Clients — Add-ons available',
      'Up to 40,000 Broadcast/Template messages per month',
      'Additional WhatsApp numbers — Add-ons available',
      'WhatsApp/Meta charges are separate and billed directly with Meta',
    ],
  },
  {
    id: 'supreme',
    name: 'Supreme',
    tagline: 'For large teams managing many WhatsApp numbers',
    monthly: 16999,
    promoMonthly: 8499.5,
    yearly: 169000,
    users: 25,
    usersLabel: 'Up to 25 users',
    numbers: 10,
    contacts: 40000,
    clients: 40000,
    messages: 500000,
    features: [
      'Up to 25 users',
      '10 WhatsApp Business numbers',
      'Up to 40,000 Contacts — Add-ons available',
      'Up to 40,000 Clients — Add-ons available',
      'Up to 500,000 Broadcast/Template messages per month',
      'Additional WhatsApp numbers — Add-ons available',
      'WhatsApp/Meta charges are separate and billed directly with Meta',
    ],
  },
];

export const TRIAL_LIMITS: PlanLimits = {
  users: 3, numbers: 1, contacts: 1000, clients: 1000, messages: 1000,
};

export const planById = (id?: string | null): Plan | null =>
  PLANS.find(p => p.id === id) || null;

export const limitsFor = (planId?: string | null): PlanLimits =>
  planById(planId) ?? TRIAL_LIMITS;

export const isPaidPlan = (status?: string | null) =>
  !!status && PLANS.some(p => p.id === status);

export const formatINR = (n: number) =>
  `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
