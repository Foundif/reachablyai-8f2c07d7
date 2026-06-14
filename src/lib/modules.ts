import {
  Inbox, Send, GitBranch, ShoppingBag,
  Sparkles, BarChart3, Bot,
  Users, Package, CreditCard, CalendarDays,
  UserCog, Shield, Plug, Code2, Webhook, FileText, Receipt, Building2, BookOpen, Settings,
  LayoutDashboard, Library, BookOpen as BookOpenIcon,
} from 'lucide-react';

export type ModuleItem = {
  to: string;
  icon: any;
  label: string;
  status: 'live' | 'soon';
  description?: string;
};

export type ModuleGroup = { label: string; items: ModuleItem[] };

export const MODULE_GROUPS: ModuleGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Command Center', status: 'live' },
      { to: '/guide', icon: BookOpenIcon, label: 'How-to Guide', status: 'live', description: 'Scenario-based walkthroughs for templates, flows and auto-replies' },
    ],
  },
  {
    label: 'Engage',
    items: [
      { to: '/inbox', icon: Inbox, label: 'Unified Inbox', status: 'live', description: 'Every WhatsApp conversation in one beautiful place' },
      { to: '/campaigns', icon: Send, label: 'Broadcast Campaigns', status: 'live', description: 'Send template messages to thousands of customers with analytics' },
      { to: '/flows', icon: GitBranch, label: 'Flow Builder', status: 'live', description: 'Visual drag-drop builder for automated WhatsApp journeys' },
      { to: '/flows/templates', icon: Library, label: 'Templates Library', status: 'live', description: 'Save, share and reuse high-performing flow designs' },
      { to: '/catalog', icon: ShoppingBag, label: 'WhatsApp Catalog', status: 'live', description: 'Sync products to WhatsApp Business catalog' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/ai-studio', icon: Sparkles, label: 'AI Agent Studio', status: 'live', description: 'Build, train and orchestrate AI agents with memory + tools' },
      { to: '/copilot', icon: Bot, label: 'AI Copilot', status: 'live', description: 'Your operational copilot — ask anything about your business' },
      { to: '/analytics', icon: BarChart3, label: 'Analytics Center', status: 'live' },
    ],
  },
  {
    label: 'Operate',
    items: [
      { to: '/customers', icon: Users, label: 'CRM & Contacts', status: 'live' },
      { to: '/bookings', icon: CalendarDays, label: 'Bookings', status: 'live' },
      { to: '/orders', icon: Package, label: 'Orders', status: 'live', description: 'Catalog orders, fulfilment & delivery tracking' },
      { to: '/payments', icon: CreditCard, label: 'Payments', status: 'live' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { to: '/team', icon: UserCog, label: 'Team Management', status: 'live', description: 'Invite teammates, assign conversations, track activity' },
      { to: '/roles', icon: Shield, label: 'Roles & Permissions', status: 'live', description: 'Fine-grained role-based access control' },
      { to: '/integrations', icon: Plug, label: 'Integrations Hub', status: 'live', description: 'Connect Shopify, HubSpot, Stripe, Zapier and 50+ tools' },
      { to: '/api', icon: Code2, label: 'API Console', status: 'live', description: 'API keys, usage and reference for developers' },
      { to: '/webhooks', icon: Webhook, label: 'Webhooks', status: 'live', description: 'Subscribe to real-time events from your workspace' },
      { to: '/audit', icon: FileText, label: 'Audit Logs', status: 'live', description: 'Complete activity trail for compliance & security' },
      { to: '/billing', icon: Receipt, label: 'Billing & Plans', status: 'live', description: 'Manage subscriptions, invoices and credits' },
      { to: '/white-label', icon: Building2, label: 'White Label', status: 'live', description: 'Agency portal — your brand, your domain' },
      { to: '/knowledge', icon: BookOpen, label: 'Knowledge Base', status: 'live', description: 'Train your AI agents with documents and FAQs' },
      { to: '/whatsapp-settings', icon: Settings, label: 'WhatsApp Settings', status: 'live' },
      { to: '/tn-flow', icon: Webhook, label: 'Booking Flow (WhatsApp)', status: 'live', description: 'Native WhatsApp Flow — auto reply when customer says hi' },
      { to: '/services', icon: Package, label: 'Services & Tariff', status: 'live' },
    ],
  },
];

export const MODULE_INDEX: Record<string, ModuleItem> = Object.fromEntries(
  MODULE_GROUPS.flatMap(g => g.items).map(i => [i.to, i])
);
