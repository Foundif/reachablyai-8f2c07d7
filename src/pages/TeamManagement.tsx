import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCog, Plus, Mail, Trash2, Shield, Eye, EyeOff, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { MODULE_GROUPS } from '@/lib/modules';
import { useAuth } from '@/hooks/useAuth';

type Member = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  is_staff: boolean;
  allowed_modules: string[];
  created_at: string;
};

const ALL_MODULES = MODULE_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));

const TeamManagement = () => {
  const { profile } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  const [mods, setMods] = useState<string[]>(['/', '/bookings', '/customers']);

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('create-staff-user', { body });
    if (error) throw new Error((error as any)?.context ? await (error as any).context.text() : error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await call({ action: 'list' });
      setMembers(res.members || []);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setEditing(null); setFullName(''); setEmail(''); setPassword('');
    setRole('staff'); setMods(['/', '/bookings', '/customers']); setShowPass(false);
  };

  const openCreate = () => { resetForm(); setOpen(true); };
  const openEdit = (m: Member) => {
    setEditing(m); setFullName(m.full_name || ''); setEmail(m.email || '');
    setRole((m.role === 'admin' ? 'admin' : 'staff'));
    setMods(m.allowed_modules || []);
    setOpen(true);
  };

  const toggleMod = (route: string) =>
    setMods((prev) => prev.includes(route) ? prev.filter((r) => r !== route) : [...prev, route]);

  const submit = async () => {
    try {
      if (editing) {
        await call({ action: 'update', user_id: editing.user_id, full_name: fullName, role, allowed_modules: role === 'admin' ? [] : mods });
        toast.success('User updated');
      } else {
        if (!email || !password) return toast.error('Email and password required');
        if (password.length < 6) return toast.error('Password must be 6+ chars');
        await call({ email, password, full_name: fullName, role, allowed_modules: mods });
        toast.success(`User ${email} created — they can log in now`);
      }
      setOpen(false); resetForm(); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const remove = async (m: Member) => {
    if (!confirm(`Delete ${m.email}? This cannot be undone.`)) return;
    try { await call({ action: 'delete', user_id: m.user_id }); toast.success('Deleted'); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const isOwner = !profile?.is_staff;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <UserCog className="w-6 h-6 text-primary" /> Team & Access
            </h1>
            <p className="text-sm text-muted-foreground">Create staff or admin logins — no invite email needed, they sign in with the email + password you set.</p>
          </div>
          {isOwner && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add user</Button>}
        </div>

        {!isOwner && (
          <div className="glass-panel p-4 text-sm text-muted-foreground">
            <Shield className="inline w-4 h-4 mr-2" /> Only the workspace owner can manage team users.
          </div>
        )}

        <div className="glass-elevated divide-y divide-border/50">
          {loading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
          {!loading && members.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">No team members yet. Click "Add user" to create one.</div>
          )}
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center font-bold text-sm">
                {(m.full_name || m.email || '?')[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{m.full_name || m.email}</p>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><Mail className="w-3 h-3" />{m.email}</p>
                {m.role !== 'admin' && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {m.allowed_modules?.length || 0} tab{(m.allowed_modules?.length || 0) === 1 ? '' : 's'} enabled
                  </p>
                )}
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-semibold ${m.role === 'admin' ? 'bg-primary/15 text-primary' : 'bg-emerald-500/15 text-emerald-600'}`}>
                {m.role || 'staff'}
              </span>
              {isOwner && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>Edit</Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(m)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </>
              )}
            </div>
          ))}
        </div>

        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? 'Edit user' : 'Add user'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" /></div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" disabled={!!editing} />
              </div>
              {!editing && (
                <div>
                  <Label>Password</Label>
                  <div className="relative">
                    <Input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Share these credentials with the user — they log in at your app URL.</p>
                </div>
              )}
              <div>
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'staff')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin — full access</SelectItem>
                    <SelectItem value="staff">Staff — only selected tabs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {role === 'staff' && (
                <div className="space-y-2">
                  <Label>Which tabs can they see?</Label>
                  <div className="glass-panel p-3 space-y-3 max-h-64 overflow-y-auto">
                    {MODULE_GROUPS.map((g) => (
                      <div key={g.label}>
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">{g.label}</div>
                        <div className="space-y-1.5">
                          {g.items.map((i) => (
                            <label key={i.to} className="flex items-center justify-between gap-3 text-sm py-1">
                              <span className="flex items-center gap-2"><i.icon className="w-4 h-4 text-muted-foreground" />{i.label}</span>
                              <Switch checked={mods.includes(i.to)} onCheckedChange={() => toggleMod(i.to)} />
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Profile page is always accessible so they can sign out.</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={submit}><Save className="w-4 h-4" /> {editing ? 'Save changes' : 'Create user'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};
export default TeamManagement;
