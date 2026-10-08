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
      'Everything in Plus, with higher limits',
      '4–10 users · 3 WhatsApp Business numbers',
      '20,000 contacts · 40,000 template messages / month',
      'Multi-number inbox & campaigns',
      'Staff roles with per-page access',
      'Public Booking API & API keys',
      'Lead Finder (top-ups ₹1/lead)',
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
      'Everything in Scale, with the highest limits',
      'Up to 25 users · 10 WhatsApp Business numbers',
      '40,000 contacts · 500,000 template messages / month',
      'Built for agencies & multi-brand teams',
      'Audit logs for every team action',
    ],
  },
];

/** Feature comparison rows. Values: true/false or a short text per plan. */
export type CompareValue = boolean | string;
export interface CompareRow { label: string; values: [CompareValue, CompareValue, CompareValue]; }
export interface CompareGroup { title: string; rows: CompareRow[]; }

export const COMPARISON: CompareGroup[] = [
  {
    title: 'Limits',
    rows: [
      { label: 'Team members', values: ['1–3', '4–10', 'Up to 25'] },
      { label: 'WhatsApp Business numbers', values: ['1', '3', '10'] },
      { label: 'Contacts', values: ['5,000', '20,000', '40,000'] },
      { label: 'Template messages / month', values: ['10,000', '40,000', '500,000'] },
      { label: 'Extra numbers & contacts (add-on)', values: [true, true, true] },
    ],
  },
  {
    title: 'WhatsApp messaging',
    rows: [
      { label: 'Shared Team Inbox (media, voice, labels)', values: [true, true, true] },
      { label: 'Template manager incl. carousel & PDF', values: [true, true, true] },
      { label: 'Broadcast campaigns + retry failed', values: [true, true, true] },
      { label: 'Auto-replies & keyword triggers', values: [true, true, true] },
    ],
  },
  {
    title: 'Forms, bookings & payments',
    rows: [
      { label: 'WhatsApp Flow Studio with live preview', values: [true, true, true] },
      { label: 'Bookings CRM with unique booking IDs', values: [true, true, true] },
      { label: 'Services & Tariff with price auto-fill', values: [true, true, true] },
      { label: 'Razorpay links paid to your own account', values: [true, true, true] },
      { label: 'Automatic payment confirmation on WhatsApp', values: [true, true, true] },
    ],
  },
  {
    title: 'Integrations',
    rows: [
      { label: 'Google Sheets live sync', values: [true, true, true] },
      { label: 'Shopify & generic webhook alerts', values: [true, true, true] },
      { label: 'Meta Lead Ads → WhatsApp alerts', values: [true, true, true] },
      { label: 'Public Booking API & API keys', values: [false, true, true] },
    ],
  },
  {
    title: 'AI & growth',
    rows: [
      { label: 'AI chatbot trained on your documents', values: [true, true, true] },
      { label: 'Automations', values: [true, true, true] },
      { label: 'Lead Finder (₹1/lead top-ups)', values: [false, true, true] },
      { label: 'Analytics dashboard', values: [true, true, true] },
    ],
  },
  {
    title: 'Team & security',
    rows: [
      { label: 'Owner, Admin & Staff roles', values: [true, true, true] },
      { label: 'Per-page staff access control', values: [false, true, true] },
      { label: 'Audit logs', values: [false, false, true] },
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
