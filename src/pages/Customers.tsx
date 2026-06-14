import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useCustomers } from '@/hooks/useCustomers';
import { useSalonInvoices } from '@/hooks/useSalonInvoices';
import { useCurrency } from '@/hooks/useCurrency';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/data/mockData';
import { supabase } from '@/integrations/supabase/client';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Search, Users, Phone, Calendar, Bell, MessageCircle, Edit3, Trash2, Plus, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

const Customers = () => {
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const { customers, loading, refetch } = useCustomers();
  const { invoices } = useSalonInvoices();
  const currency = useCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState(searchParams.get('tab') || 'all');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 45);

  const reminders = customers.filter(c =>
    c.last_purchase_date && new Date(c.last_purchase_date) <= cutoffDate
  );

  const displayList = tab === 'reminders' ? reminders : customers;

  const filtered = displayList.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q);
  });

  const sendWhatsAppReminder = (customer: any) => {
    const salonName = profile?.store_name || 'Our Salon';
    const message = `Hi ${customer.name},\n\nWe miss you at ${salonName} ✨\n\nIt's been a while since your last visit.\n\nBook your next service and enjoy a special offer.\n\nWe look forward to seeing you again!`;
    const phone = customer.phone?.replace(/[^0-9]/g, '') || '';
    if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    else toast.error('No phone number');
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !custName) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('customers').insert({
        user_id: user.id, name: custName, phone: custPhone || null,
      });
      if (error) throw error;
      toast.success('Customer added!');
      setAddOpen(false); setCustName(''); setCustPhone(''); refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const openEditCustomer = (c: any) => {
    setEditingId(c.id);
    setCustName(c.name);
    setCustPhone(c.phone || '');
    setEditOpen(true);
  };

  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !custName) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('customers').update({
        name: custName, phone: custPhone || null,
      }).eq('id', editingId);
      if (error) throw error;
      toast.success('Customer updated!');
      setEditOpen(false); setCustName(''); setCustPhone(''); setEditingId(null); refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('Delete this customer?')) return;
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      toast.success('Customer deleted'); refetch();
    } catch (err: any) { toast.error(err.message); }
  };

  if (loading) return <AppLayout><DashboardSkeleton /></AppLayout>;

  const customerForm = (onSubmit: (e: React.FormEvent) => void, label: string) => (
    <form onSubmit={onSubmit} className="space-y-4 mt-4">
      <div><Label>Name *</Label><Input placeholder="John Doe" value={custName} onChange={e => setCustName(e.target.value)} className="mt-1.5" /></div>
      <div><Label>Phone</Label><Input placeholder="+91 9876543210" value={custPhone} onChange={e => setCustPhone(e.target.value)} className="mt-1.5" /></div>
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" className="flex-1" onClick={() => { setAddOpen(false); setEditOpen(false); setCustName(''); setCustPhone(''); }}>Cancel</Button>
        <Button type="submit" variant="trust" className="flex-1" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{label}
        </Button>
      </div>
    </form>
  );

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Client Book</h1>
            <p className="text-muted-foreground">{customers.length} clients</p>
          </div>
          <Button variant="trust" className="w-full sm:w-auto" onClick={() => { setCustName(''); setCustPhone(''); setAddOpen(true); }}><Plus className="w-5 h-5" />Add Client</Button>
        </div>

        <div className="flex gap-2">
          <Button variant={tab === 'all' ? 'trust' : 'outline'} size="sm" onClick={() => setTab('all')}>
            <Users className="w-4 h-4" />All ({customers.length})
          </Button>
          <Button variant={tab === 'reminders' ? 'trust' : 'outline'} size="sm" onClick={() => setTab('reminders')}>
            <Bell className="w-4 h-4" />Reminders ({reminders.length})
          </Button>
        </div>

        <div className="glass-card p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-background border-border" />
          </div>
        </div>

        {filtered.length === 0 && (
          <div className="glass-card p-12 text-center">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {tab === 'reminders' ? 'No Reminders' : 'No Clients Yet'}
            </h3>
            <p className="text-muted-foreground">
              {tab === 'reminders' ? 'All clients are active!' : 'Clients are added when you create a bill.'}
            </p>
          </div>
        )}

        {tab === 'reminders' && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((c, index) => {
              const daysSince = Math.floor((Date.now() - new Date(c.last_purchase_date!).getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={c.id} className="glass-card p-4 hover-lift animate-fade-up" style={{ animationDelay: `${index * 30}ms` }}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-risk-high/10 flex items-center justify-center flex-shrink-0">
                        <Bell className="w-5 h-5 text-risk-high" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground text-sm">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.phone || '—'}</p>
                        <p className="text-xs text-risk-high font-semibold">{daysSince} days since last visit</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2">
                      <span className="text-sm font-bold text-primary">{formatCurrency(c.total_purchases, currency)}</span>
                      <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => sendWhatsAppReminder(c)}>
                        <MessageCircle className="w-3 h-3" />WhatsApp
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'all' && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((customer, index) => (
              <div key={customer.id}
                className="glass-card p-4 animate-fade-up hover-lift"
                style={{ animationDelay: `${index * 30}ms` }}>
                <div className="flex flex-col gap-3">
                  {/* Top: avatar + info */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 cursor-pointer" onClick={() => setSelectedCustomer(customer)}>
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedCustomer(customer)}>
                      <h3 className="font-semibold text-foreground text-sm">{customer.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {customer.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{customer.phone}</span>}
                        {customer.last_purchase_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Last: {new Date(customer.last_purchase_date).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-primary">{formatCurrency(customer.total_purchases, currency)}</p>
                      <p className="text-[10px] text-muted-foreground">total spent</p>
                    </div>
                  </div>
                  {/* Bottom: actions */}
                  <div className="flex items-center gap-1 justify-end">
                    {customer.phone && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-risk-safe" onClick={() => sendWhatsAppReminder(customer)}>
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCustomer(customer)}><Edit3 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-risk-high" onClick={() => handleDeleteCustomer(customer.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" />{selectedCustomer?.name}</DialogTitle></DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium text-foreground">{selectedCustomer.phone || '—'}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Total Spent</p><p className="font-bold text-primary">{formatCurrency(selectedCustomer.total_purchases, currency)}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Last Visit</p><p className="font-medium text-foreground">{selectedCustomer.last_purchase_date ? new Date(selectedCustomer.last_purchase_date).toLocaleDateString() : '—'}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Total Visits</p><p className="font-medium text-foreground">{selectedCustomer.total_visits || 0}</p></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" />Add Client</DialogTitle></DialogHeader>
          {customerForm(handleAddCustomer, "Add")}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit3 className="w-5 h-5 text-primary" />Edit Client</DialogTitle></DialogHeader>
          {customerForm(handleEditCustomer, "Save")}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Customers;
