import {
  Inbox, Users, CalendarDays,
  UserCog, Shield, FileText, Settings, UserCircle,
  LayoutDashboard, Briefcase, BarChart3, Wallet,
} from 'lucide-react';

export type ModuleItem = {
  to: string;
  icon: any;
  label: string;
  status: 'live' | 'soon';
  description?: string;
};

export type ModuleGroup = { label: string; items: ModuleItem[] };

// Travel-services focused navigation. Campaigns / Flow Builder / Templates /
// AI Studio / AI Copilot / Knowledge Base routes still exist but are hidden
// from the sidebar (phase 2). Accounting is now a first-class module.
export const MODULE_GROUPS: ModuleGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', status: 'live' },
      { to: '/inbox', icon: Inbox, label: 'Inbox', status: 'live' },
    ],
  },
  {
    label: 'Services',
    items: [
      { to: '/services', icon: Briefcase, label: 'Services & Tariff', status: 'live' },
      { to: '/bookings', icon: CalendarDays, label: 'Bookings', status: 'live' },
      { to: '/customers', icon: Users, label: 'Customers', status: 'live' },
  },
  {
    label: 'Business',
    items: [
      { to: '/accounting', icon: Wallet, label: 'Accounting', status: 'live' },
      { to: '/analytics', icon: BarChart3, label: 'Analytics', status: 'live' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/whatsapp-settings', icon: Settings, label: 'WhatsApp', status: 'live' },
      { to: '/team', icon: UserCog, label: 'Team', status: 'live' },
      { to: '/roles', icon: Shield, label: 'Roles', status: 'live' },
      { to: '/audit', icon: FileText, label: 'Audit Logs', status: 'live' },
    ],
  },
];

export const MODULE_INDEX: Record<string, ModuleItem> = Object.fromEntries(
  MODULE_GROUPS.flatMap(g => g.items).map(i => [i.to, i])
);
