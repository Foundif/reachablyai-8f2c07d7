import {
  Inbox, Users, CalendarDays,
  UserCog, Shield, FileText, Settings, UserCircle, CreditCard,
  LayoutDashboard, Briefcase, BarChart3, Wallet, Workflow, Sheet,
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
    ],
  },
  {
    label: 'Business',
    items: [
      { to: '/accounting', icon: Wallet, label: 'Accounting', status: 'live' },
      { to: '/analytics', icon: BarChart3, label: 'Analytics', status: 'live' },
      { to: '/sheets', icon: Sheet, label: 'Bookings Sheet', status: 'live' },
    ],
  },
  {
    label: 'WhatsApp',
    items: [
      { to: '/flow-editor', icon: Workflow, label: 'Flow Editor', status: 'live' },
      { to: '/whatsapp-settings', icon: Settings, label: 'WhatsApp', status: 'live' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/razorpay', icon: CreditCard, label: 'Razorpay', status: 'live' },
      { to: '/profile', icon: UserCircle, label: 'Profile', status: 'live' },
      { to: '/team', icon: UserCog, label: 'Team', status: 'live' },
      { to: '/roles', icon: Shield, label: 'Roles', status: 'live' },
      { to: '/audit', icon: FileText, label: 'Audit Logs', status: 'live' },
    ],
  },
];

export const MODULE_INDEX: Record<string, ModuleItem> = Object.fromEntries(
  MODULE_GROUPS.flatMap(g => g.items).map(i => [i.to, i])
);
