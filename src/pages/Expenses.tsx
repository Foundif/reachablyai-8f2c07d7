import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useExpenses } from '@/hooks/useExpenses';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCurrency } from '@/data/mockData';
import { supabase } from '@/integrations/supabase/client';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, Search, Wallet, Trash2, Edit3, Loader2, Check, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

const EXPENSE_CATEGORIES = ['rent', 'salary', 'utilities', 'products', 'miscellaneous'];

interface ExpenseForm {
  name: string;
  category: string;
  amount: string;
  expense_date: string;
  notes: string;
}

const Expenses = () => {
  const { user } = useAuth();
  const { expenses, loading, refetch } = useExpenses();
  const currency = useCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseForm>({ name: '', category: 'miscellaneous', amount: '', expense_date: new Date().toISOString().split('T')[0], notes: '' });
  const [saving, setSaving] = useState(false);

  const filtered = expenses.filter(e => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
  });

  const resetForm = () => setForm({ name: '', category: 'miscellaneous', amount: '', expense_date: new Date().toISOString().split('T')[0], notes: '' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('expenses').insert({
        user_id: user.id, name: form.name, category: form.category,
        amount: Number(form.amount) || 0, expense_date: form.expense_date,
        notes: form.notes || null,
      });
      if (error) throw error;
      toast.success('Expense added!');
      setAddOpen(false); resetForm(); refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const openEdit = (exp: any) => {
    setEditingId(exp.id);
    setForm({ name: exp.name, category: exp.category, amount: exp.amount.toString(), expense_date: exp.expense_date, notes: exp.notes || '' });
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !form.name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('expenses').update({
        name: form.name, category: form.category,
        amount: Number(form.amount) || 0, expense_date: form.expense_date,
        notes: form.notes || null,
      }).eq('id', editingId);
      if (error) throw error;
      toast.success('Expense updated!');
      setEditOpen(false); resetForm(); setEditingId(null); refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      toast.success('Expense deleted'); refetch();
    } catch (err: any) { toast.error(err.message); }
  };

  if (loading) return <AppLayout><DashboardSkeleton /></AppLayout>;

  const formContent = (onSubmit: (e: React.FormEvent) => void, submitLabel: string) => (
    <form onSubmit={onSubmit} className="space-y-4 mt-4">
      <div><Label>Expense Name *</Label><Input placeholder="Rent" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="mt-1.5" /></div>
      <div><Label>Category</Label>
        <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
          <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="mt-1.5" /></div>
        <div><Label>Date</Label><Input type="date" value={form.expense_date} onChange={e => setForm({...form, expense_date: e.target.value})} className="mt-1.5" /></div>
      </div>
      <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="mt-1.5 min-h-[60px]" placeholder="Any notes..." /></div>
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
            <Wallet className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Expense Tracker</h1>
              <p className="text-muted-foreground">Track daily salon expenses</p>
            </div>
          </div>
          <Button variant="trust" onClick={() => { resetForm(); setAddOpen(true); }}><Plus className="w-5 h-5" />Add Expense</Button>
        </div>

        <div className="glass-card p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search expenses..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 bg-background border-border" />
          </div>
        </div>

        {expenses.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Wallet className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Expenses Yet</h3>
            <p className="text-muted-foreground mb-6">Start tracking your salon expenses.</p>
            <Button variant="trust" onClick={() => setAddOpen(true)}>Add Expense</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((exp, index) => (
              <div key={exp.id} className="glass-card p-4 sm:p-5 hover-lift animate-fade-up" style={{ animationDelay: `${index * 30}ms` }}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-risk-medium/10 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-6 h-6 text-risk-medium" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{exp.name}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="capitalize px-2 py-0.5 rounded-full bg-primary/10 text-primary">{exp.category}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{exp.expense_date}</span>
                    </div>
                    {exp.notes && <p className="text-xs text-muted-foreground mt-1">{exp.notes}</p>}
                  </div>
                  <div className="text-right mr-2">
                    <p className="text-sm font-bold text-risk-high">{formatCurrency(exp.amount, currency)}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(exp)}><Edit3 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-risk-high" onClick={() => handleDelete(exp.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Wallet className="w-5 h-5 text-primary" />Add Expense</DialogTitle></DialogHeader>
          {formContent(handleAdd, "Add")}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit3 className="w-5 h-5 text-primary" />Edit Expense</DialogTitle></DialogHeader>
          {formContent(handleEdit, "Save")}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Expenses;
