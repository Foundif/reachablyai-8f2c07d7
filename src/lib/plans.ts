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
      '1–3 users · 1 WhatsApp Business number',
      '5,000 contacts · 10,000 template messages / month',
      'Shared Team Inbox with media, voice notes & labels',
      'Broadcast campaigns with retry for failed sends',
      'WhatsApp Flow Studio — custom forms & bookings in chat',
      'Bookings CRM with unique IDs + Services & Tariff',
      'Razorpay payment links to your own account',
      'Google Sheets live sync, Shopify & webhook alerts',
      'Meta Lead Ads → instant WhatsApp lead alerts',
      'AI chatbot, auto-replies & automations',
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
