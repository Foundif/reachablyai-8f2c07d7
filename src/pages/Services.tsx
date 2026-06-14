import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useServices } from '@/hooks/useServices';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCurrency } from '@/data/mockData';
import { supabase } from '@/integrations/supabase/client';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, Search, Scissors, Edit3, Trash2, Loader2, Check, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Service } from '@/types/salon';

const CATEGORIES = ['hair', 'facial', 'threading', 'spa', 'makeup', 'pedicure', 'manicure', 'other'];

const Services = () => {
  const { user } = useAuth();
  const { services, loading, refetch } = useServices();
  const currency = useCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('other');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('30');
  const [gstApplicable, setGstApplicable] = useState(true);
  const [saving, setSaving] = useState(false);

  const filtered = services.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
  });

  const resetForm = () => { setName(''); setCategory('other'); setPrice(''); setDuration('30'); setGstApplicable(true); };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('services').insert({
        user_id: user.id, name, category,
        price: Number(price) || 0, duration: Number(duration) || 30,
        gst_applicable: gstApplicable,
      });
      if (error) throw error;
      toast.success('Service added!');
      setAddOpen(false); resetForm(); refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const openEdit = (svc: Service) => {
    setEditingService(svc);
    setName(svc.name); setCategory(svc.category); setPrice(svc.price.toString());
    setDuration((svc.duration || 30).toString()); setGstApplicable(svc.gst_applicable);
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService || !name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('services').update({
        name, category, price: Number(price) || 0,
        duration: Number(duration) || 30, gst_applicable: gstApplicable,
      }).eq('id', editingService.id);
      if (error) throw error;
      toast.success('Service updated!');
      setEditOpen(false); resetForm(); setEditingService(null); refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this service?')) return;
    try {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
      toast.success('Service deleted'); refetch();
    } catch (err: any) { toast.error(err.message); }
  };

  if (loading) return <AppLayout><DashboardSkeleton /></AppLayout>;

  const formContent = (onSubmit: (e: React.FormEvent) => void, submitLabel: string) => (
    <form onSubmit={onSubmit} className="space-y-4 mt-4">
      <div><Label>Service Name *</Label><Input placeholder="Haircut" value={name} onChange={e => setName(e.target.value)} className="mt-1.5" /></div>
      <div><Label>Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
          <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Price</Label><Input type="number" value={price} onChange={e => setPrice(e.target.value)} className="mt-1.5" /></div>
        <div><Label>Duration (min)</Label><Input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="mt-1.5" /></div>
      </div>
      <div className="flex items-center justify-between">
        <Label>GST Applicable</Label>
        <Switch checked={gstApplicable} onCheckedChange={setGstApplicable} />
      </div>
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
            <Scissors className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Services</h1>
              <p className="text-muted-foreground">Manage your service catalog</p>
            </div>
          </div>
          <Button variant="trust" onClick={() => { resetForm(); setAddOpen(true); }}><Plus className="w-5 h-5" />Add Service</Button>
        </div>

        <div className="glass-card p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search services..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 bg-background border-border" />
          </div>
        </div>

        {services.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Scissors className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Services Yet</h3>
            <p className="text-muted-foreground mb-6">Add your salon services to start billing.</p>
            <Button variant="trust" onClick={() => setAddOpen(true)}>Add Service</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((svc, index) => (
              <div key={svc.id} className="glass-card p-4 sm:p-5 hover-lift animate-fade-up" style={{ animationDelay: `${index * 30}ms` }}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Scissors className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{svc.name}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="capitalize px-2 py-0.5 rounded-full bg-primary/10 text-primary">{svc.category}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{svc.duration} min</span>
                      {svc.gst_applicable && <span className="px-2 py-0.5 rounded-full bg-risk-safe/20 text-risk-safe">GST</span>}
                    </div>
                  </div>
                  <div className="text-right mr-2">
                    <p className="text-sm font-bold text-primary">{formatCurrency(svc.price, currency)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(svc)}><Edit3 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-risk-high" onClick={() => handleDelete(svc.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Scissors className="w-5 h-5 text-primary" />Add Service</DialogTitle></DialogHeader>
          {formContent(handleAdd, "Add")}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit3 className="w-5 h-5 text-primary" />Edit Service</DialogTitle></DialogHeader>
          {formContent(handleEdit, "Save")}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Services;
