import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Shield, Users, Clock, AlertTriangle, DollarSign, LogOut,
  Search, Edit3, Loader2, Check, Settings, TrendingUp,
  Download, QrCode, CheckSquare, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { ACTION_GROUPS, defaultsFor, type Action } from '@/lib/permissions';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';

interface UserProfile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  store_name: string | null;
  role: string | null;
  currency: string | null;
  created_at: string;
  trial_start_date: string | null;
  trial_end_date: string | null;
  subscription_status: string | null;
}

interface Stats {
  totalUsers: number;
  activeTrials: number;
  expiredTrials: number;
  paidUsers: number;
  totalRevenue: number;
  gstRevenue: number;
  nonGstRevenue: number;
  chartData: { month: string; gst: number; nonGst: number; total: number }[];
  roleDistribution?: Record<string, number>;
}

const AVAILABLE_ROLES = [
  { value: 'owner', label: 'Owner', desc: 'Full access to everything' },
  { value: 'manager', label: 'Manager', desc: 'Operations, no admin settings' },
  { value: 'receptionist', label: 'Receptionist', desc: 'Billing & bookings only' },
  { value: 'staff', label: 'Staff', desc: 'Billing & bookings only' },
  { value: 'freelancer', label: 'Freelancer', desc: 'Full access (solo user)' },
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { isAuthenticated, adminUser, logout, apiCall, updateCredentials } = useAdmin();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editTrialEnd, setEditTrialEnd] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editRole, setEditRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [paymentSettingsOpen, setPaymentSettingsOpen] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkTrialEnd, setBulkTrialEnd] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkRole, setBulkRole] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [tab, setTab] = useState<'users' | 'analytics' | 'roles'>('users');

  useEffect(() => {
    if (!isAuthenticated) { navigate('/admin-login', { replace: true }); return; }
    fetchData();
  }, [isAuthenticated]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersData, statsData] = await Promise.all([apiCall('get_users'), apiCall('get_stats')]);
      setUsers(usersData.users || []);
      setStats(statsData);
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [loadingOverrides, setLoadingOverrides] = useState(false);

  const handleEditUser = async (user: UserProfile) => {
    setEditUser(user);
    setEditTrialEnd(user.trial_end_date ? new Date(user.trial_end_date).toISOString().split('T')[0] : '');
    setEditStatus(user.subscription_status || 'trial');
    setEditRole(user.role || 'freelancer');
    setLoadingOverrides(true);
    try {
      const res = await apiCall('list_overrides', { user_id: user.user_id });
      const map: Record<string, boolean> = {};
      (res.overrides || []).forEach((o: any) => { map[o.action] = o.allowed; });
      setOverrides(map);
    } catch { setOverrides({}); }
    finally { setLoadingOverrides(false); }
  };

  const toggleOverride = async (action: Action, allowed: boolean | null) => {
    if (!editUser) return;
    const next = { ...overrides };
    if (allowed === null) {
      delete next[action];
      await apiCall('set_override', { user_id: editUser.user_id, override_action: action, remove: true });
    } else {
      next[action] = allowed;
      await apiCall('set_override', { user_id: editUser.user_id, override_action: action, allowed });
    }
    setOverrides(next);
  };

  const handleSaveUser = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      await apiCall('update_user', {
        user_id: editUser.user_id,
        trial_end_date: editTrialEnd ? new Date(editTrialEnd).toISOString() : null,
        subscription_status: editStatus,
        role: editRole,
      });
      toast.success('User updated!');
      setEditUser(null); fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleBulkUpdate = async () => {
    if (selectedUsers.size === 0) { toast.error('Select users first'); return; }
    setSaving(true);
    try {
      for (const userId of selectedUsers) {
        await apiCall('update_user', {
          user_id: userId,
          ...(bulkTrialEnd ? { trial_end_date: new Date(bulkTrialEnd).toISOString() } : {}),
          ...(bulkStatus ? { subscription_status: bulkStatus } : {}),
          ...(bulkRole ? { role: bulkRole } : {}),
        });
      }
      toast.success(`${selectedUsers.size} users updated!`);
      setBulkOpen(false); setSelectedUsers(new Set()); fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const toggleUserSelect = (userId: string) => {
    const next = new Set(selectedUsers);
    if (next.has(userId)) next.delete(userId); else next.add(userId);
    setSelectedUsers(next);
  };

  const selectAll = () => {
    if (selectedUsers.size === filtered.length) setSelectedUsers(new Set());
    else setSelectedUsers(new Set(filtered.map(u => u.user_id)));
  };

  const exportUsersCSV = () => {
    const headers = ['Name', 'Email', 'Store', 'Role', 'Status', 'Trial End', 'Joined'];
    const rows = users.map(u => [
      u.full_name || '', u.email || '', u.store_name || '', u.role || 'freelancer',
      u.subscription_status || '', u.trial_end_date ? new Date(u.trial_end_date).toLocaleDateString() : '',
      new Date(u.created_at).toLocaleDateString(),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'glamsup-users.csv'; a.click();
    toast.success('Users exported!');
  };

  const handleSaveCredentials = async () => {
    setSaving(true);
    try {
      await updateCredentials(newUsername || undefined, newPassword || undefined);
      toast.success('Credentials updated!');
      setSettingsOpen(false); setNewUsername(''); setNewPassword('');
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleLogout = async () => { await logout(); navigate('/admin-login'); };

  const filtered = users.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.store_name?.toLowerCase().includes(q));
  });

  const getTrialStatus = (user: UserProfile) => {
    if (user.subscription_status === 'active') return { label: 'Active', color: 'text-risk-safe bg-risk-safe/10' };
    if (user.subscription_status === 'expired') return { label: 'Expired', color: 'text-risk-high bg-risk-high/10' };
    if (user.trial_end_date && new Date(user.trial_end_date) <= new Date()) return { label: 'Trial Expired', color: 'text-risk-high bg-risk-high/10' };
    if (user.trial_end_date) {
      const days = Math.ceil((new Date(user.trial_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return { label: `Trial (${days}d)`, color: 'text-risk-medium bg-risk-medium/10' };
    }
    return { label: 'Trial', color: 'text-muted-foreground bg-muted' };
  };

  const getRoleBadge = (role: string | null) => {
    const r = role || 'freelancer';
    const map: Record<string, string> = {
      owner: 'text-primary bg-primary/10',
      admin: 'text-primary bg-primary/10',
      manager: 'text-risk-medium bg-risk-medium/10',
      receptionist: 'text-muted-foreground bg-muted',
      staff: 'text-muted-foreground bg-muted',
      freelancer: 'text-risk-safe bg-risk-safe/10',
    };
    return { label: r.charAt(0).toUpperCase() + r.slice(1), color: map[r] || 'text-muted-foreground bg-muted' };
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-lg font-bold text-foreground">Glamsup Admin</h1>
              <p className="text-xs text-muted-foreground">Logged in as {adminUser}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPaymentSettingsOpen(true)}>
              <QrCode className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-primary" /><span className="text-xs text-muted-foreground">Total Users</span></div>
            <p className="text-2xl font-bold text-foreground">{stats?.totalUsers || 0}</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-risk-medium" /><span className="text-xs text-muted-foreground">Active Trials</span></div>
            <p className="text-2xl font-bold text-foreground">{stats?.activeTrials || 0}</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-risk-high" /><span className="text-xs text-muted-foreground">Expired Trials</span></div>
            <p className="text-2xl font-bold text-foreground">{stats?.expiredTrials || 0}</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2"><DollarSign className="w-4 h-4 text-risk-safe" /><span className="text-xs text-muted-foreground">Platform Revenue</span></div>
            <p className="text-2xl font-bold text-foreground">₹{(stats?.totalRevenue || 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <Button variant={tab === 'users' ? 'trust' : 'outline'} size="sm" onClick={() => setTab('users')}><Users className="w-4 h-4" />Users</Button>
          <Button variant={tab === 'roles' ? 'trust' : 'outline'} size="sm" onClick={() => setTab('roles')}><ShieldCheck className="w-4 h-4" />Role Management</Button>
          <Button variant={tab === 'analytics' ? 'trust' : 'outline'} size="sm" onClick={() => setTab('analytics')}><TrendingUp className="w-4 h-4" />Analytics</Button>
        </div>

        {/* Analytics Tab */}
        {tab === 'analytics' && stats?.chartData && stats.chartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /><h3 className="font-semibold text-foreground text-sm">Revenue Trend</h3>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={stats.chartData}>
                    <defs><linearGradient id="adminGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(270 65% 55%)" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(270 65% 55%)" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="total" stroke="hsl(270 65% 55%)" fill="url(#adminGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="glass-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" /><h3 className="font-semibold text-foreground text-sm">Tax vs General Revenue</h3>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Bar dataKey="gst" fill="hsl(270 65% 55%)" radius={[4, 4, 0, 0]} name="Tax" />
                    <Bar dataKey="nonGst" fill="hsl(330 60% 60%)" radius={[4, 4, 0, 0]} name="General" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Role Management Tab */}
        {tab === 'roles' && (
          <div className="space-y-4">
            <div className="glass-card p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" />Role Permissions Matrix</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Feature</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">Owner</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">Manager</th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">Staff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      { feature: 'Dashboard', owner: true, manager: true, staff: true },
                      { feature: 'Business Profile', owner: true, manager: true, staff: false },
                      { feature: 'Billing', owner: true, manager: true, staff: true },
                      { feature: 'Appointments', owner: true, manager: true, staff: true },
                      { feature: 'Customers', owner: true, manager: true, staff: true },
                      { feature: 'Services', owner: true, manager: true, staff: false },
                      { feature: 'Team Management', owner: true, manager: true, staff: false },
                      { feature: 'Roles & Access', owner: true, manager: true, staff: false },
                      { feature: 'Expenses', owner: true, manager: true, staff: false },
                      { feature: 'Tax Revenue', owner: true, manager: true, staff: false },
                      { feature: 'Revenue Reports', owner: true, manager: true, staff: false },
                      { feature: 'Settings', owner: true, manager: true, staff: true },
                    ].map((row) => (
                      <tr key={row.feature} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3 font-medium text-foreground">{row.feature}</td>
                        <td className="py-2.5 px-3 text-center">{row.owner ? <Check className="w-4 h-4 text-risk-safe mx-auto" /> : <span className="text-muted-foreground">—</span>}</td>
                        <td className="py-2.5 px-3 text-center">{row.manager ? <Check className="w-4 h-4 text-risk-safe mx-auto" /> : <span className="text-muted-foreground">—</span>}</td>
                        <td className="py-2.5 px-3 text-center">{row.staff ? <Check className="w-4 h-4 text-risk-safe mx-auto" /> : <span className="text-muted-foreground">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Role distribution */}
            {stats?.roleDistribution && (
              <div className="glass-card p-6">
                <h3 className="font-semibold text-foreground mb-4">Role Distribution</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {Object.entries(stats.roleDistribution).map(([role, count]) => (
                    <div key={role} className="p-3 rounded-xl bg-muted/50 border border-border text-center">
                      <p className="text-2xl font-bold text-foreground">{count}</p>
                      <p className="text-xs text-muted-foreground capitalize">{role}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Users with role editing */}
            <div className="glass-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Manage User Roles</h3>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-9" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">User</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Current Role</th>
                      <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map(user => {
                      const roleBadge = getRoleBadge(user.role);
                      return (
                        <tr key={user.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-foreground">{user.full_name || 'Unnamed'}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleBadge.color}`}>{roleBadge.label}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)}><Edit3 className="w-4 h-4 mr-1" />Edit</Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">User Management</h3>
                {selectedUsers.size > 0 && (
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setBulkOpen(true)}>
                    <CheckSquare className="w-3 h-3" />Bulk Edit ({selectedUsers.size})
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportUsersCSV}><Download className="w-3 h-3" />Export</Button>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search users..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-9" />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-8">
                      <input type="checkbox" checked={selectedUsers.size === filtered.length && filtered.length > 0} onChange={selectAll} className="rounded" />
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">User</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Store</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Role</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Trial End</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">Joined</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(user => {
                    const status = getTrialStatus(user);
                    const roleBadge = getRoleBadge(user.role);
                    return (
                      <tr key={user.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selectedUsers.has(user.user_id)} onChange={() => toggleUserSelect(user.user_id)} className="rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-foreground">{user.full_name || 'Unnamed'}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-sm text-foreground">{user.store_name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleBadge.color}`}>{roleBadge.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.color}`}>{status.label}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-sm text-muted-foreground">
                          {user.trial_end_date ? new Date(user.trial_end_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-sm text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditUser(user)}><Edit3 className="w-4 h-4" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">No users found</div>}
          </div>
        )}
      </div>

      {/* Edit User Dialog - now includes role */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit User: {editUser?.full_name || editUser?.email}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Role & Access Level</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex flex-col">
                        <span>{r.label}</span>
                        <span className="text-xs text-muted-foreground">{r.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Subscription Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Active (Paid)</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Trial End Date</Label><Input type="date" value={editTrialEnd} onChange={e => setEditTrialEnd(e.target.value)} className="mt-1.5" /></div>

            {/* Permission overrides */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-foreground" />
                <Label className="text-sm font-semibold">Agent Studio & Campaign Permissions</Label>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Grant or revoke individual actions beyond their role defaults.</p>
              {loadingOverrides ? (
                <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin" /></div>
              ) : (
                <div className="space-y-3">
                  {ACTION_GROUPS.map(group => {
                    const defaults = defaultsFor(editRole);
                    return (
                      <div key={group.label} className="bg-muted/30 rounded-lg p-3">
                        <div className="text-xs font-semibold text-foreground mb-2">{group.label}</div>
                        <div className="space-y-1.5">
                          {group.actions.map(action => {
                            const roleDefault = defaults.includes(action);
                            const override = overrides[action];
                            const effective = override !== undefined ? override : roleDefault;
                            return (
                              <div key={action} className="flex items-center justify-between gap-2 text-xs">
                                <div className="min-w-0 flex-1">
                                  <code className="text-[11px] text-muted-foreground">{action}</code>
                                  <div className="text-[10px] text-muted-foreground">
                                    Role default: {roleDefault ? 'Allowed' : 'Denied'} · Effective: <span className={effective ? 'text-foreground font-medium' : 'text-muted-foreground'}>{effective ? 'Allowed' : 'Denied'}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Switch checked={effective} onCheckedChange={(v) => toggleOverride(action, v)} />
                                  {override !== undefined && (
                                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => toggleOverride(action, null)}>Reset</Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditUser(null)}>Close</Button>
              <Button variant="trust" className="flex-1" onClick={handleSaveUser} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Save role & status
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Dialog - now includes role */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>Bulk Update ({selectedUsers.size} users)</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Role (leave blank to skip)</Label>
              <Select value={bulkRole} onValueChange={setBulkRole}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Don't change" /></SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Subscription Status (leave blank to skip)</Label>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Don't change" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Active (Paid)</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Trial End Date (leave blank to skip)</Label><Input type="date" value={bulkTrialEnd} onChange={e => setBulkTrialEnd(e.target.value)} className="mt-1.5" /></div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setBulkOpen(false)}>Cancel</Button>
              <Button variant="trust" className="flex-1" onClick={handleBulkUpdate} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Update All
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings className="w-5 h-5 text-primary" />Admin Settings</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>New Username (leave blank to keep)</Label><Input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="Superadmin" className="mt-1.5" /></div>
            <div><Label>New Password (leave blank to keep)</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="mt-1.5" /></div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSettingsOpen(false)}>Cancel</Button>
              <Button variant="trust" className="flex-1" onClick={handleSaveCredentials} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Update
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Settings Dialog */}
      <Dialog open={paymentSettingsOpen} onOpenChange={setPaymentSettingsOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><QrCode className="w-5 h-5 text-primary" />Payment Settings</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>UPI ID</Label><Input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="yourname@ybl" className="mt-1.5" /></div>
            <div><Label>QR Code Image URL</Label><Input value={qrCodeUrl} onChange={e => setQrCodeUrl(e.target.value)} placeholder="https://..." className="mt-1.5" /></div>
            <p className="text-xs text-muted-foreground">These will be shown to users when they select a paid plan.</p>
            <Button variant="trust" className="w-full" onClick={() => { toast.success('Payment settings saved!'); setPaymentSettingsOpen(false); }}>
              <Check className="w-4 h-4" />Save Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
