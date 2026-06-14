import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useAuth } from '@/hooks/useAuth';
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
  Plus, Search, Truck, Phone, MapPin, Edit3, Trash2,
  Loader2, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Supplier } from '@/types/store';

const Suppliers = () => {
  const { user } = useAuth();
  const { suppliers, loading, refetch } = useSuppliers();
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '', brands: '' });
  const [saving, setSaving] = useState(false);

  const filteredSuppliers = suppliers.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.phone?.toLowerCase().includes(q);
  });

  const resetForm = () => setFormData({ name: '', phone: '', address: '', brands: '' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('suppliers').insert({
        user_id: user.id, name: formData.name, phone: formData.phone || null,
        address: formData.address || null,
        brands_supplied: formData.brands ? formData.brands.split(',').map(b => b.trim()) : null,
      });
      if (error) throw error;
      toast.success('Supplier added!');
      setAddModalOpen(false); resetForm(); refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const openEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name, phone: supplier.phone || '',
      address: supplier.address || '',
      brands: supplier.brands_supplied?.join(', ') || '',
    });
    setEditModalOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier || !formData.name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('suppliers').update({
        name: formData.name, phone: formData.phone || null,
        address: formData.address || null,
        brands_supplied: formData.brands ? formData.brands.split(',').map(b => b.trim()) : null,
      }).eq('id', editingSupplier.id);
      if (error) throw error;
      toast.success('Supplier updated!');
      setEditModalOpen(false); resetForm(); setEditingSupplier(null); refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this supplier?')) return;
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      toast.success('Supplier deleted');
      refetch();
    } catch (err: any) { toast.error(err.message); }
  };

  if (loading) return <AppLayout><DashboardSkeleton /></AppLayout>;

  const SupplierForm = ({ onSubmit, submitLabel }: { onSubmit: (e: React.FormEvent) => void; submitLabel: string }) => (
    <form onSubmit={onSubmit} className="space-y-4 mt-4">
      <div><Label>Supplier Name *</Label><Input placeholder="ABC Footwear" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="mt-1.5" /></div>
      <div><Label>Phone</Label><Input placeholder="+91 9876543210" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="mt-1.5" /></div>
      <div><Label>Address</Label><Textarea placeholder="Full address..." value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="mt-1.5 min-h-[80px]" /></div>
      <div><Label>Brands Supplied (comma separated)</Label><Input placeholder="Nike, Adidas, Puma" value={formData.brands} onChange={(e) => setFormData({...formData, brands: e.target.value})} className="mt-1.5" /></div>
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" className="flex-1" onClick={() => { setAddModalOpen(false); setEditModalOpen(false); resetForm(); }}>Cancel</Button>
        <Button type="submit" variant="trust" className="flex-1" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />{submitLabel}</>}
        </Button>
      </div>
    </form>
  );

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Truck className="w-8 h-8 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Suppliers</h1>
            </div>
            <p className="text-muted-foreground">Manage your product suppliers</p>
          </div>
          <Button variant="trust" onClick={() => { resetForm(); setAddModalOpen(true); }}>
            <Plus className="w-5 h-5" />Add Supplier
          </Button>
        </div>

        <div className="glass-card p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search suppliers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-background border-border" />
          </div>
        </div>

        {suppliers.length === 0 && (
          <div className="glass-card p-12 text-center">
            <Truck className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Suppliers Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">Add your suppliers to track purchases and link products.</p>
            <Button variant="trust" onClick={() => setAddModalOpen(true)}>Add Supplier</Button>
          </div>
        )}

        {filteredSuppliers.length > 0 && (
          <div className="space-y-3">
            {filteredSuppliers.map((supplier, index) => (
              <div key={supplier.id} className="glass-card p-4 sm:p-5 hover-lift animate-fade-up" style={{ animationDelay: `${index * 50}ms` }}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Truck className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base">{supplier.name}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                      {supplier.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{supplier.phone}</span>}
                      {supplier.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{supplier.address}</span>}
                    </div>
                    {supplier.brands_supplied && supplier.brands_supplied.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {supplier.brands_supplied.map(b => (
                          <span key={b} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{b}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(supplier)}><Edit3 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-risk-high" onClick={() => handleDelete(supplier.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Truck className="w-5 h-5 text-primary" />Add Supplier</DialogTitle></DialogHeader>
          <SupplierForm onSubmit={handleAdd} submitLabel="Add" />
        </DialogContent>
      </Dialog>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit3 className="w-5 h-5 text-primary" />Edit Supplier</DialogTitle></DialogHeader>
          <SupplierForm onSubmit={handleEdit} submitLabel="Save" />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Suppliers;
