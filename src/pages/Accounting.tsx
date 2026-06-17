import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Wallet, TrendingUp, TrendingDown, Plus, Edit3, Trash2,
  Loader2, Check, Download, FileText,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { jsPDF } from 'jspdf';

const EXPENSE_CATEGORIES = ['fuel', 'salary', 'maintenance', 'marketing', 'rent', 'utilities', 'food', 'commission', 'other'];

const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const blankExp = { id: '', expense_date: new Date().toISOString().slice(0, 10), category: 'fuel', vendor: '', amount: '', payment_method: 'cash', notes: '' };

const Accounting = () => {
  const { user } = useAuth();
  const [income, setIncome] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [period, setPeriod] = useState('30');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankExp);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const since = new Date(Date.now() - Number(period) * 86400_000).toISOString();
    const [pay, exp] = await Promise.all([
      supabase.from('tn_payments').select('*, tn_bookings(service_name, name, wa_id)').eq('user_id', user.id).in('status', ['completed','verified','paid']).gte('created_at', since).order('created_at', { ascending: false }),
      supabase.from('tn_expenses').select('*').eq('user_id', user.id).gte('expense_date', since.slice(0, 10)).order('expense_date', { ascending: false }),
    ]);
    setIncome(pay.data || []);
    setExpenses(exp.data || []);
  };

  useEffect(() => { load(); }, [user, period]);

  const totals = useMemo(() => {
    const totalIncome = income.reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalExpense = expenses.reduce((s, r) => s + Number(r.amount || 0), 0);
    return { totalIncome, totalExpense, profit: totalIncome - totalExpense };
  }, [income, expenses]);

  // Monthly P&L bars
  const monthly = useMemo(() => {
    const buckets: Record<string, { month: string; income: number; expense: number }> = {};
    const key = (d: string) => d.slice(0, 7);
    income.forEach(r => { const k = key(r.created_at); buckets[k] = buckets[k] || { month: k, income: 0, expense: 0 }; buckets[k].income += Number(r.amount || 0); });
    expenses.forEach(r => { const k = key(r.expense_date); buckets[k] = buckets[k] || { month: k, income: 0, expense: 0 }; buckets[k].expense += Number(r.amount || 0); });
    return Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month));
  }, [income, expenses]);

  const openAdd = () => { setForm(blankExp); setOpen(true); };
  const openEdit = (e: any) => { setForm({ ...blankExp, ...e, amount: String(e.amount) }); setOpen(true); };

  const saveExp = async () => {
    if (!user) return;
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        expense_date: form.expense_date,
        category: form.category,
        vendor: form.vendor || null,
        amount: Number(form.amount),
        payment_method: form.payment_method,
        notes: form.notes || null,
      };
      const { error } = form.id
        ? await supabase.from('tn_expenses').update(payload).eq('id', form.id)
        : await supabase.from('tn_expenses').insert(payload);
      if (error) throw error;
      toast.success(form.id ? 'Expense updated' : 'Expense added');
      setOpen(false); load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const removeExp = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    const { error } = await supabase.from('tn_expenses').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Deleted'); load(); }
  };

  const exportCSV = () => {
    const rows: string[] = ['Type,Date,Category,Vendor/Service,Amount,Method,Notes'];
    income.forEach(r => rows.push(['INCOME', r.created_at.slice(0, 10), 'booking', r.tn_bookings?.service_name || '-', r.amount, r.method || '-', `Booking ${r.booking_id?.slice(0, 8) || ''}`].join(',')));
    expenses.forEach(r => rows.push(['EXPENSE', r.expense_date, r.category, r.vendor || '-', r.amount, r.payment_method || '-', (r.notes || '').replace(/[,\n]/g, ' ')].join(',')));
    rows.push('', `,,,TOTAL INCOME,${totals.totalIncome},,`);
    rows.push(`,,,TOTAL EXPENSE,${totals.totalExpense},,`);
    rows.push(`,,,NET PROFIT,${totals.profit},,`);
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `accounting-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Chatarly — P&L Statement', 14, 18);
    doc.setFontSize(10); doc.text(`Period: last ${period} days · Generated ${new Date().toLocaleDateString()}`, 14, 26);
    doc.setFontSize(12);
    doc.text(`Total income:  ${inr(totals.totalIncome)}`, 14, 40);
    doc.text(`Total expense: ${inr(totals.totalExpense)}`, 14, 48);
    doc.text(`Net profit:    ${inr(totals.profit)}`, 14, 56);
    doc.setFontSize(11); doc.text('Expenses', 14, 70);
    let y = 78;
    expenses.slice(0, 25).forEach(r => {
      doc.text(`${r.expense_date}  ${r.category.padEnd(12)}  ${(r.vendor || '-').slice(0, 20).padEnd(20)}  ${inr(Number(r.amount))}`, 14, y);
      y += 6;
    });
    doc.save(`pnl-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Wallet className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Accounting</h1>
              <p className="text-sm text-muted-foreground">Income, expenses & P&L</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4" />CSV</Button>
            <Button variant="outline" onClick={exportPDF}><FileText className="w-4 h-4" />PDF</Button>
            <Button onClick={openAdd}><Plus className="w-4 h-4" />Expense</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card className="p-4"><div className="flex items-center gap-2 text-emerald-600"><TrendingUp className="w-4 h-4" /><span className="text-xs uppercase">Income</span></div><p className="text-2xl font-bold mt-1">{inr(totals.totalIncome)}</p></Card>
          <Card className="p-4"><div className="flex items-center gap-2 text-red-500"><TrendingDown className="w-4 h-4" /><span className="text-xs uppercase">Expense</span></div><p className="text-2xl font-bold mt-1">{inr(totals.totalExpense)}</p></Card>
          <Card className="p-4 col-span-2 md:col-span-1"><div className="flex items-center gap-2 text-primary"><Wallet className="w-4 h-4" /><span className="text-xs uppercase">Net profit</span></div><p className={`text-2xl font-bold mt-1 ${totals.profit < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{inr(totals.profit)}</p></Card>
        </div>

        {monthly.length > 0 && (
          <Card className="p-4">
            <p className="text-sm font-semibold mb-3">Monthly P&L</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => inr(Number(v))} />
                <Bar dataKey="income" fill="#10b981" name="Income" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#ef4444" name="Expense" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        <Tabs defaultValue="expenses">
          <TabsList>
            <TabsTrigger value="expenses">Expenses ({expenses.length})</TabsTrigger>
            <TabsTrigger value="income">Income ({income.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="space-y-2 mt-3">
            {expenses.length === 0 ? <Card className="p-8 text-center text-muted-foreground text-sm">No expenses logged yet.</Card> :
              expenses.map(e => (
                <Card key={e.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{inr(Number(e.amount))}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted capitalize">{e.category}</span>
                      <span className="text-xs text-muted-foreground">{e.expense_date}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{e.vendor || '—'} · {e.payment_method}{e.notes ? ` · ${e.notes}` : ''}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)}><Edit3 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeExp(e.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </Card>
              ))}
          </TabsContent>

          <TabsContent value="income" className="space-y-2 mt-3">
            {income.length === 0 ? <Card className="p-8 text-center text-muted-foreground text-sm">No confirmed payments in this period.</Card> :
              income.map(r => (
                <Card key={r.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-emerald-600">+{inr(Number(r.amount))}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{r.method || 'upi'}</span>
                      <span className="text-xs text-muted-foreground">{r.created_at.slice(0, 10)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{r.tn_bookings?.service_name || 'Booking'} · {r.tn_bookings?.name || r.tn_bookings?.wa_id || '—'}</p>
                  </div>
                </Card>
              ))}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{form.id ? 'Edit' : 'Add'} expense</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" className="mt-1.5" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} /></div>
              <div><Label>Amount (₹)</Label><Input type="number" className="mt-1.5" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Method</Label>
                <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank">Bank transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Vendor / paid to</Label><Input className="mt-1.5" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea className="mt-1.5" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={saveExp} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />Save</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Accounting;
