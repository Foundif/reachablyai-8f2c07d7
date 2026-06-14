import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCog, Plus, Mail, Trash2, Shield, Crown } from 'lucide-react';
import { toast } from 'sonner';

type Member = { id: string; name: string; email: string; role: 'Owner' | 'Admin' | 'Manager' | 'Agent'; status: 'active' | 'invited' };

const STORAGE = 'foundif_team_members';

const TeamManagement = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Member['role']>('Agent');

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE);
    if (raw) setMembers(JSON.parse(raw));
    else setMembers([{ id: '1', name: 'You', email: 'you@workspace.app', role: 'Owner', status: 'active' }]);
  }, []);
  useEffect(() => { localStorage.setItem(STORAGE, JSON.stringify(members)); }, [members]);

  const invite = () => {
    if (!email || !name) return toast.error('Name and email required');
    setMembers((m) => [...m, { id: crypto.randomUUID(), name, email, role, status: 'invited' }]);
    toast.success(`Invite sent to ${email}`);
    setName(''); setEmail(''); setRole('Agent'); setOpen(false);
  };

  const remove = (id: string) => {
    setMembers((m) => m.filter((x) => x.id !== id));
    toast.success('Member removed');
  };

  const changeRole = (id: string, r: Member['role']) =>
    setMembers((m) => m.map((x) => (x.id === id ? { ...x, role: r } : x)));

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <UserCog className="w-6 h-6 text-primary" /> Team Management
            </h1>
            <p className="text-sm text-muted-foreground">Invite teammates and control who can access what.</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> Invite teammate</Button>
        </div>

        <div className="glass-elevated divide-y divide-border/50">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center font-bold text-sm">
                {m.name[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{m.name} {m.role === 'Owner' && <Crown className="inline w-3.5 h-3.5 text-amber-500" />}</p>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><Mail className="w-3 h-3" />{m.email}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${m.status === 'active' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'}`}>
                {m.status}
              </span>
              <Select value={m.role} onValueChange={(v) => changeRole(m.id, v as any)} disabled={m.role === 'Owner'}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Owner', 'Admin', 'Manager', 'Agent'].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              {m.role !== 'Owner' && (
                <Button variant="ghost" size="icon" onClick={() => remove(m.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              )}
            </div>
          ))}
        </div>

        <div className="glass-panel p-4 flex items-center gap-3">
          <Shield className="w-5 h-5 text-primary" />
          <div className="text-xs text-muted-foreground">Fine-grained module-level permissions are managed in <a href="/roles" className="underline">Roles & Permissions</a>.</div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite teammate</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" /></div>
              <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" /></div>
              <div><Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['Admin', 'Manager', 'Agent'].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={invite}>Send invite</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};
export default TeamManagement;
