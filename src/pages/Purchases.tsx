import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useProducts } from '@/hooks/useProducts';
import { usePurchases } from '@/hooks/usePurchases';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/hooks/useCurrency';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/data/mockData';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Package, Truck, Loader2, Check, Trash2, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface PurchaseLineItem {
  product_id: string;
  size: string;
  quantity: string;
  purchase_price: string;
}

const Purchases = () => {
  const { user } = useAuth();
  const { suppliers, loading: suppLoading } = useSuppliers();
  const { products, loading: prodLoading, refetch: refetchProducts } = useProducts();
  const { purchases, loading: purchLoading, refetch: refetchPurchases } = usePurchases();
  const currency = useCurrency();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [lineItems, setLineItems] = useState<PurchaseLineItem[]>([
    { product_id: '', size: '', quantity: '', purchase_price: '' }
  ]);
  const [saving, setSaving] = useState(false);

  const loading = suppLoading || prodLoading || purchLoading;

  const addLineItem = () => setLineItems([...lineItems, { product_id: '', size: '', quantity: '', purchase_price: '' }]);
  const removeLineItem = (i: number) => setLineItems(lineItems.filter((_, idx) => idx !== i));
  const updateLineItem = (i: number, field: keyof PurchaseLineItem, value: string) => {
    const updated = [...lineItems];
    updated[i] = { ...updated[i], [field]: value };
    setLineItems(updated);
  };

  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = lineItems.filter(li => li.product_id && li.size && li.quantity);
    if (!user || validItems.length === 0) { toast.error('Add at least one item'); return; }
    setSaving(true);
    try {
      const totalAmount = validItems.reduce((sum, li) => sum + (parseFloat(li.purchase_price) || 0) * (parseInt(li.quantity) || 0), 0);
      const { data: purchase, error: pError } = await supabase.from('purchases').insert({
        user_id: user.id,
        supplier_id: selectedSupplier || null,
        total_amount: totalAmount,
      }).select().single();
      if (pError) throw pError;

      for (const li of validItems) {
        const product = products.find(p => p.id === li.product_id);
        let productSizeId: string | null = null;
        const existingSize = product?.sizes?.find(s => s.size === li.size.trim());

        if (existingSize) {
          await supabase.from('product_sizes').update({ quantity: existingSize.quantity + parseInt(li.quantity) }).eq('id', existingSize.id);
          productSizeId = existingSize.id;
        } else {
          const { data: newSize, error: sError } = await supabase.from('product_sizes').insert({
            product_id: li.product_id, size: li.size.trim(), quantity: parseInt(li.quantity),
          }).select().single();
          if (sError) throw sError;
          productSizeId = newSize.id;
        }

        await supabase.from('purchase_items').insert({
          purchase_id: purchase.id, product_id: li.product_id,
          product_size_id: productSizeId, size: li.size.trim(),
          quantity: parseInt(li.quantity), purchase_price: parseFloat(li.purchase_price) || 0,
        });
      }

      toast.success('Purchase recorded! Stock updated.');
      setAddModalOpen(false);
      setSelectedSupplier('');
      setLineItems([{ product_id: '', size: '', quantity: '', purchase_price: '' }]);
      refetchProducts();
      refetchPurchases();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <AppLayout><DashboardSkeleton /></AppLayout>;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Purchases</h1>
            <p className="text-muted-foreground">{purchases.length} purchase records</p>
          </div>
          <Button variant="trust" onClick={() => setAddModalOpen(true)}>
            <Plus className="w-5 h-5" />Record Purchase
          </Button>
        </div>

        {purchases.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Purchases Yet</h3>
            <p className="text-muted-foreground mb-6">Record purchases from suppliers to automatically update your inventory.</p>
            <Button variant="trust" onClick={() => setAddModalOpen(true)}><Plus className="w-4 h-4" />Record Purchase</Button>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Supplier</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Items</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => {
                    const supplierName = purchase.supplier_id ? suppliers.find(s => s.id === purchase.supplier_id)?.name : '—';
                    return (
                      <tr key={purchase.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="p-4 text-sm text-foreground flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {new Date(purchase.purchase_date).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-sm text-foreground">{supplierName}</td>
                        <td className="p-4 text-sm text-foreground">
                          {(purchase.items || []).map(item => {
                            const prod = products.find(p => p.id === item.product_id);
                            return `${prod?.brand || ''} ${prod?.model_name || ''} (${item.size} × ${item.quantity})`;
                          }).join(', ') || '—'}
                        </td>
                        <td className="p-4 font-bold text-foreground">{formatCurrency(purchase.total_amount, currency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Truck className="w-5 h-5 text-primary" />Record Purchase</DialogTitle></DialogHeader>
          <form onSubmit={handleAddPurchase} className="space-y-4 mt-4">
            {suppliers.length > 0 && (
              <div>
                <Label>Supplier</Label>
                <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>+ Add Item</Button>
              </div>
              <div className="space-y-3">
                {lineItems.map((li, i) => (
                  <div key={i} className="p-3 rounded-lg border border-border space-y-2">
                    <div className="flex items-center gap-2">
                      <Select value={li.product_id} onValueChange={(v) => updateLineItem(i, 'product_id', v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Product" /></SelectTrigger>
                        <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.brand} {p.model_name}</SelectItem>)}</SelectContent>
                      </Select>
                      {lineItems.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeLineItem(i)} className="text-risk-high h-8 w-8"><Trash2 className="w-4 h-4" /></Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Size" value={li.size} onChange={(e) => updateLineItem(i, 'size', e.target.value)} />
                      <Input type="number" placeholder="Qty" value={li.quantity} onChange={(e) => updateLineItem(i, 'quantity', e.target.value)} />
                      <Input type="number" placeholder="Price" value={li.purchase_price} onChange={(e) => updateLineItem(i, 'purchase_price', e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setAddModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="trust" className="flex-1" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />Record</>}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Purchases;
