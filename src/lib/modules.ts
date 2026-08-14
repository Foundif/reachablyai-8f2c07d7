import {
  Inbox, Contact, MessageSquareText,
  UserCog, Settings, UserCircle,
  LayoutDashboard, BarChart3, Wallet, Megaphone, Workflow, Bot, Plug,
  Smartphone, QrCode,
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
      { to: '/', icon: LayoutDashboard, label: 'Home', status: 'live' },
      { to: '/inbox', icon: Inbox, label: 'Team Inbox', status: 'live' },
      { to: '/leads', icon: Contact, label: 'Contacts', status: 'live' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { to: '/templates', icon: MessageSquareText, label: 'Templates', status: 'live' },
      { to: '/campaigns', icon: Megaphone, label: 'Campaigns', status: 'live' },
      { to: '/automation', icon: Workflow, label: 'Automation', status: 'live' },
      { to: '/auto-replies', icon: Bot, label: 'Auto-replies', status: 'live' },
      { to: '/chatbots', icon: Bot, label: 'AI Chatbots', status: 'live' },
    ],
  },

  {
    label: 'Gateway',
    items: [
      { to: '/gateway', icon: Smartphone, label: 'Gateway Home', status: 'live' },
      { to: '/gateway/connect', icon: QrCode, label: 'Connect QR', status: 'live' },
      { to: '/gateway/contacts', icon: Contact, label: 'Gateway Contacts', status: 'live' },
      { to: '/gateway/campaigns', icon: Megaphone, label: 'Gateway Campaigns', status: 'live' },
      { to: '/gateway/inbox', icon: Inbox, label: 'Gateway Inbox', status: 'live' },
      { to: '/gateway/settings', icon: Settings, label: 'Gateway Settings', status: 'live' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/analytics', icon: BarChart3, label: 'Analytics', status: 'live' },
      { to: '/accounting', icon: Wallet, label: 'Accounting', status: 'live' },
    ],
  },

  {
    label: 'Settings',
    items: [
      { to: '/whatsapp-settings', icon: Settings, label: 'WhatsApp API', status: 'live' },
      { to: '/integrations', icon: Plug, label: 'Integrations', status: 'live' },
      { to: '/team', icon: UserCog, label: 'Team', status: 'live' },
      { to: '/profile', icon: UserCircle, label: 'Profile', status: 'live' },
    ],
  },
];

export const MODULE_INDEX: Record<string, ModuleItem> = Object.fromEntries(
  MODULE_GROUPS.flatMap(g => g.items).map(i => [i.to, i])
);
