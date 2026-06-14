import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useSales } from '@/hooks/useSales';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCurrency } from '@/data/mockData';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, ShoppingCart, Download, RotateCcw, Loader2, Check, Share2 } from 'lucide-react';
import { downloadReceipt } from '@/lib/receiptPdf';
import { toast } from 'sonner';

const SaleDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { sales, loading, refetch } = useSales();
  const currency = useCurrency();
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnItemId, setReturnItemId] = useState('');
  const [returnQty, setReturnQty] = useState('1');
  const [returnReason, setReturnReason] = useState('');
  const [returnType, setReturnType] = useState<'return' | 'exchange'>('return');
  const [processing, setProcessing] = useState(false);

  const sale = sales.find(s => s.id === id);

  const handleReturn = async () => {
    if (!sale || !user || !returnItemId) return;
    const item = sale.items?.find(i => i.id === returnItemId);
    if (!item) return;
    const qty = parseInt(returnQty) || 1;
    if (qty > item.quantity) { toast.error('Quantity exceeds sold quantity'); return; }

    setProcessing(true);
    try {
      // Record return
      const { error } = await supabase.from('returns').insert({
        user_id: user.id, sale_id: sale.id, sale_item_id: item.id,
        product_id: item.product_id, product_size_id: item.product_size_id,
        quantity: qty, reason: returnReason || null, type: returnType,
      });
      if (error) throw error;

      // Restore stock
      const { data: currentSize } = await supabase.from('product_sizes').select('quantity').eq('id', item.product_size_id).single();
      if (currentSize) {
        await supabase.from('product_sizes').update({ quantity: currentSize.quantity + qty }).eq('id', item.product_size_id);
      }

      toast.success(`${returnType === 'return' ? 'Return' : 'Exchange'} processed! Stock restored.`);
      setReturnModalOpen(false);
      setReturnItemId(''); setReturnQty('1'); setReturnReason('');
      refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setProcessing(false); }
  };

  const handleWhatsAppShare = () => {
    if (!sale) return;
    const storeName = (profile as any)?.store_name || 'Glamsup Salon';
    const items = (sale.items || []).map(i => `• ${i.product_name} (Size ${i.size}) × ${i.quantity} = ${formatCurrency(i.selling_price * i.quantity, currency)}`).join('\n');
    const msg = `🧾 *${storeName}*\nInvoice: ${sale.invoice_number}\nDate: ${new Date(sale.created_at).toLocaleString()}\n\n${items}\n\n*Total: ${formatCurrency(sale.total_amount, currency)}*\nPayment: ${sale.payment_method.toUpperCase()}\n\nThank you for your purchase!`;
    const url = `https://wa.me/${sale.customer_phone?.replace(/\D/g, '') || ''}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  if (loading) return <AppLayout><div className="p-8"><Skeleton className="h-64" /></div></AppLayout>;
  if (!sale) return <AppLayout><div className="p-8 text-center"><p className="text-muted-foreground">Sale not found</p><Link to="/sales" className="text-primary hover:underline mt-2 inline-block">Back to sales</Link></div></AppLayout>;

  const storeName = (profile as any)?.store_name || 'Glamsup Salon';

  return (
    <AppLayout>
      <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6">
        <Link to="/sales" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />Back to sales
        </Link>

        <div className="glass-card p-4 sm:p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-6 h-6 text-primary" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">{sale.invoice_number}</h1>
                <p className="text-sm text-muted-foreground">{new Date(sale.created_at).toLocaleString()}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleWhatsAppShare}>
                <Share2 className="w-4 h-4" />WhatsApp
              </Button>
              <Button variant="trust" size="sm" onClick={() => downloadReceipt(sale, currency, storeName)}>
                <Download className="w-4 h-4" />Download Receipt
              </Button>
              <Button variant="outline" size="sm" onClick={() => setReturnModalOpen(true)}>
                <RotateCcw className="w-4 h-4" />Return/Exchange
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 pb-6 border-b border-border">
            <div>
              <p className="text-xs text-muted-foreground">Total Amount</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(sale.total_amount, currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Payment Method</p>
              <p className="text-lg font-semibold text-foreground capitalize">{sale.payment_method}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Customer Phone</p>
              <p className="text-lg font-semibold text-foreground">{sale.customer_phone || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Items</p>
              <p className="text-lg font-semibold text-foreground">{sale.items?.length || 0}</p>
            </div>
          </div>

          <h2 className="font-semibold text-foreground mb-4">Sale Items</h2>
          <div className="space-y-3">
            {(sale.items || []).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 rounded-lg bg-accent/30">
                <div>
                  <p className="font-medium text-foreground">{item.product_name}</p>
                  <p className="text-sm text-muted-foreground">Size {item.size} × {item.quantity}</p>
                </div>
                <p className="font-bold text-foreground">{formatCurrency(item.selling_price * item.quantity, currency)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Return/Exchange Modal */}
      <Dialog open={returnModalOpen} onOpenChange={setReturnModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><RotateCcw className="w-5 h-5 text-primary" />Process Return/Exchange</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Type</Label>
              <Select value={returnType} onValueChange={(v: 'return' | 'exchange') => setReturnType(v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="return">Return (refund)</SelectItem>
                  <SelectItem value="exchange">Exchange</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Select Item</Label>
              <Select value={returnItemId} onValueChange={setReturnItemId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  {(sale?.items || []).map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.product_name} (Size {i.size}) × {i.quantity}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input type="number" min={1} value={returnQty} onChange={(e) => setReturnQty(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Textarea placeholder="Defective, wrong size, etc." value={returnReason} onChange={(e) => setReturnReason(e.target.value)} className="mt-1.5" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setReturnModalOpen(false)}>Cancel</Button>
              <Button variant="trust" className="flex-1" onClick={handleReturn} disabled={processing || !returnItemId}>
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />Process</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default SaleDetail;
