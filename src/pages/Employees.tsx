import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useEmployees } from '@/hooks/useEmployees';
import { useSalonInvoices } from '@/hooks/useSalonInvoices';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCurrency } from '@/data/mockData';
import { supabase } from '@/integrations/supabase/client';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus, Search, UserCheck, Phone, Edit3, Trash2, Loader2, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Employee } from '@/types/salon';

const Employees = () => {
  const { user } = useAuth();
  const { employees, loading, refetch } = useEmployees();
  const { invoices } = useSalonInvoices();
  const currency = useCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empName, setEmpName] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empRole, setEmpRole] = useState('stylist');
  const [empCommission, setEmpCommission] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = employees.filter(e => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return e.name.toLowerCase().includes(q) || e.phone?.toLowerCase().includes(q);
  });

  const resetForm = () => { setEmpName(''); setEmpPhone(''); setEmpRole('stylist'); setEmpCommission(''); };

  const getEmployeeStats = (empId: string) => {
    let totalServices = 0, totalRevenue = 0;
    invoices.forEach(inv => {
      (inv.items || []).filter(item => item.employee_id === empId).forEach(item => {
        totalServices += item.quantity;
        totalRevenue += item.price * item.quantity;
      });
    });
    return { totalServices, totalRevenue };
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !empName) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('employees').insert({
        user_id: user.id, name: empName, phone: empPhone || null,
        role: empRole, commission_percentage: Number(empCommission) || 0,
      });
      if (error) throw error;
      toast.success('Employee added!');
      setAddOpen(false); resetForm(); refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const openEdit = (emp: Employee) => {
    setEditingEmp(emp);
    setEmpName(emp.name); setEmpPhone(emp.phone || '');
    setEmpRole(emp.role); setEmpCommission(emp.commission_percentage.toString());
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp || !empName) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('employees').update({
        name: empName, phone: empPhone || null,
        role: empRole, commission_percentage: Number(empCommission) || 0,
      }).eq('id', editingEmp.id);
      if (error) throw error;
      toast.success('Employee updated!');
      setEditOpen(false); resetForm(); setEditingEmp(null); refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this employee?')) return;
    try {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
      toast.success('Employee deleted'); refetch();
    } catch (err: any) { toast.error(err.message); }
  };

  if (loading) return <AppLayout><DashboardSkeleton /></AppLayout>;

  const formContent = (onSubmit: (e: React.FormEvent) => void, submitLabel: string) => (
    <form onSubmit={onSubmit} className="space-y-4 mt-4">
      <div><Label>Name *</Label><Input placeholder="John" value={empName} onChange={e => setEmpName(e.target.value)} className="mt-1.5" /></div>
      <div><Label>Phone</Label><Input placeholder="+91 9876543210" value={empPhone} onChange={e => setEmpPhone(e.target.value)} className="mt-1.5" /></div>
      <div><Label>Role</Label><Input placeholder="Stylist" value={empRole} onChange={e => setEmpRole(e.target.value)} className="mt-1.5" /></div>
      <div><Label>Commission %</Label><Input type="number" placeholder="10" value={empCommission} onChange={e => setEmpCommission(e.target.value)} className="mt-1.5" /></div>
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" className="flex-1" onClick={() => { setAddOpen(false); setEditOpen(false); resetForm(); }}>Cancel</Button>
        <Button type="submit" variant="trust" className="flex-1" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{submitLabel}
        </Button>
      </div>
    </form>
  );

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Employees</h1>
              <p className="text-muted-foreground">Manage your salon employees</p>
            </div>
          </div>
          <Button variant="trust" onClick={() => { resetForm(); setAddOpen(true); }}><Plus className="w-5 h-5" />Add Employee</Button>
        </div>

        <div className="glass-card p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search employees..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 bg-background border-border" />
          </div>
        </div>

        {employees.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <UserCheck className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Employees Yet</h3>
            <p className="text-muted-foreground mb-6">Add your salon employees to track performance.</p>
            <Button variant="trust" onClick={() => setAddOpen(true)}>Add Employee</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((emp, index) => {
              const empStats = getEmployeeStats(emp.id);
              return (
                <div key={emp.id} className="glass-card p-4 sm:p-5 hover-lift animate-fade-up" style={{ animationDelay: `${index * 30}ms` }}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <UserCheck className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">{emp.name}</h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="capitalize px-2 py-0.5 rounded-full bg-primary/10 text-primary">{emp.role}</span>
                        {emp.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{emp.phone}</span>}
                        <span>{emp.commission_percentage}% commission</span>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2 text-xs">
                        <span className="text-muted-foreground">{empStats.totalServices} services</span>
                        <span className="text-foreground font-medium">{formatCurrency(empStats.totalRevenue, currency)} revenue</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(emp)}><Edit3 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-risk-high" onClick={() => handleDelete(emp.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserCheck className="w-5 h-5 text-primary" />Add Employee</DialogTitle></DialogHeader>
          {formContent(handleAdd, "Add")}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit3 className="w-5 h-5 text-primary" />Edit Employee</DialogTitle></DialogHeader>
          {formContent(handleEdit, "Save")}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Employees;
