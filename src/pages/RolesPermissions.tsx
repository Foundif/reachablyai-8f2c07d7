import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Shield, Save } from 'lucide-react';
import { toast } from 'sonner';

const ROLES = ['Admin', 'Manager', 'Agent'] as const;
const MODULES = [
  'Unified Inbox', 'Broadcast Campaigns', 'Flow Builder', 'Templates Library',
  'AI Agent Studio', 'Analytics Center', 'CRM & Contacts', 'Bookings',
  'Payments', 'WhatsApp Settings', 'Team Management', 'Billing',
];
const ACTIONS = ['View', 'Edit', 'Delete'] as const;

type Matrix = Record<string, Record<string, Record<string, boolean>>>;
const STORAGE = 'foundif_role_matrix';

const seed = (): Matrix => {
  const m: Matrix = {};
  ROLES.forEach((r) => {
    m[r] = {};
    MODULES.forEach((mod) => {
      m[r][mod] = {
        View: true,
        Edit: r !== 'Agent' || ['Unified Inbox', 'CRM & Contacts', 'Bookings'].includes(mod),
        Delete: r === 'Admin',
      };
    });
  });
  return m;
};

const RolesPermissions = () => {
  const [matrix, setMatrix] = useState<Matrix>(seed);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE);
    if (raw) setMatrix(JSON.parse(raw));
  }, []);

  const toggle = (role: string, mod: string, action: string) =>
    setMatrix((m) => ({ ...m, [role]: { ...m[role], [mod]: { ...m[role][mod], [action]: !m[role][mod][action] } } }));

  const save = () => { localStorage.setItem(STORAGE, JSON.stringify(matrix)); toast.success('Permissions saved ✓'); };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" /> Roles & Permissions
            </h1>
            <p className="text-sm text-muted-foreground">Granular access control per role per module.</p>
          </div>
          <Button onClick={save}><Save className="w-4 h-4" /> Save changes</Button>
        </div>

        <div className="glass-elevated overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-3 font-semibold">Module</th>
                {ROLES.map((r) => (
                  <th key={r} colSpan={3} className="text-center p-3 font-semibold border-l border-border/50">{r}</th>
                ))}
              </tr>
              <tr className="border-b border-border/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th></th>
                {ROLES.flatMap((r) => ACTIONS.map((a) => <th key={r + a} className="p-2 font-medium">{a}</th>))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((mod) => (
                <tr key={mod} className="border-b border-border/30 hover:bg-muted/30">
                  <td className="p-3 font-medium">{mod}</td>
                  {ROLES.flatMap((r) => ACTIONS.map((a) => (
                    <td key={r + a} className="p-2 text-center">
                      <Switch checked={matrix[r]?.[mod]?.[a]} onCheckedChange={() => toggle(r, mod, a)} />
                    </td>
                  )))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
};
export default RolesPermissions;
