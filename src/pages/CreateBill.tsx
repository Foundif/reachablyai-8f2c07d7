import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useServices } from '@/hooks/useServices';
import { useEmployees } from '@/hooks/useEmployees';
import { useCustomers } from '@/hooks/useCustomers';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCurrency } from '@/data/mockData';
import { supabase } from '@/integrations/supabase/client';
import { downloadSalonReceipt, printSalonReceipt } from '@/lib/salonReceiptPdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Receipt, Plus, Trash2, Loader2, Check, Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';

interface BillItem {
  service_id: string;
  service_name: string;
  employee_id: string;
  employee_name: string;
  price: number;
  quantity: number;
}

interface CreatedBillData {
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  customer_phone: string;
  gst_type: string;
  payment_mode: string;
  discount: number;
  total_amount: number;
  items: BillItem[];
  notes: string;
}

const CreateBill = () => {
  const { user, profile } = useAuth();
  const { services, loading: sLoading } = useServices();
  const { employees, loading: eLoading } = useEmployees();
  const { customers, refetch: refetchCustomers } = useCustomers();
  const currency = useCurrency();

  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [gstType, setGstType] = useState<string>('with_gst');
  const [paymentMode, setPaymentMode] = useState<string>('cash');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<BillItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastBill, setLastBill] = useState<CreatedBillData | null>(null);

  const loading = sLoading || eLoading;

  const handlePhoneChange = (phone: string) => {
    setCustomerPhone(phone);
    const existing = customers.find(c => c.phone === phone);
    if (existing) setCustomerName(existing.name);
  };

  const addItem = () => {
    setItems([...items, { service_id: '', service_name: '', employee_id: '', employee_name: '', price: 0, quantity: 1 }]);
  };

  const updateItem = (index: number, updates: Partial<BillItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    if (updates.service_id) {
      const svc = services.find(s => s.id === updates.service_id);
      if (svc) {
        newItems[index].service_name = svc.name;
        newItems[index].price = svc.price;
      }
    }
    if (updates.employee_id) {
      const emp = employees.find(e => e.id === updates.employee_id);
      if (emp) newItems[index].employee_name = emp.name;
    }
    setItems(newItems);
  };

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const subtotal = items.reduce((s, item) => s + item.price * item.quantity, 0);
  const total = subtotal - discount;

  const handleSubmit = async () => {
    if (!user || items.length === 0) { toast.error('Add at least one service'); return; }
    if (!customerName) { toast.error('Customer name is required'); return; }
    setSaving(true);
    try {
      let customerId: string | null = null;
      const existing = customers.find(c => c.phone === customerPhone && customerPhone);
      if (existing) {
        customerId = existing.id;
        await supabase.from('customers').update({
          last_purchase_date: new Date().toISOString(),
          total_purchases: existing.total_purchases + total,
          total_visits: (existing as any).total_visits ? (existing as any).total_visits + 1 : 1,
        }).eq('id', existing.id);
      } else {
        const { data: newCust } = await supabase.from('customers').insert({
          user_id: user.id, name: customerName, phone: customerPhone || null,
          total_purchases: total, last_purchase_date: new Date().toISOString(),
        }).select().single();
        if (newCust) customerId = newCust.id;
      }

      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

      const { data: invoice, error: invError } = await supabase.from('salon_invoices').insert({
        user_id: user.id, invoice_number: invoiceNumber, customer_id: customerId,
        invoice_date: invoiceDate, gst_type: gstType, payment_mode: paymentMode,
        discount, total_amount: total, notes: notes || null,
      }).select().single();
      if (invError) throw invError;

      const itemsToInsert = items.map(item => ({
        invoice_id: invoice.id, service_id: item.service_id || null,
        employee_id: item.employee_id || null, service_name: item.service_name,
        price: item.price, quantity: item.quantity,
      }));
      const { error: itemsError } = await supabase.from('salon_invoice_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      const billData: CreatedBillData = {
        invoice_number: invoiceNumber, invoice_date: invoiceDate,
        customer_name: customerName, customer_phone: customerPhone,
        gst_type: gstType, payment_mode: paymentMode, discount,
        total_amount: total, items: [...items], notes,
      };
      setLastBill(billData);
      setReceiptOpen(true);
      toast.success(`Bill ${invoiceNumber} created!`);

      setCustomerPhone(''); setCustomerName(''); setDiscount(0); setNotes('');
      setItems([]); refetchCustomers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getLogoUrl = () => {
    if (!user) return undefined;
    const { data } = supabase.storage.from('salon-assets').getPublicUrl(`logos/${user.id}/logo.png`);
    return data?.publicUrl;
  };

  const handleDownloadReceipt = async () => {
    if (!lastBill) return;
    await downloadSalonReceipt({
      ...lastBill,
      items: lastBill.items.map(i => ({ service_name: i.service_name, price: i.price, quantity: i.quantity, employee_name: i.employee_name })),
    }, currency, profile?.store_name || 'Chatarly Salon', getLogoUrl());
  };

  const handlePrintReceipt = async () => {
    if (!lastBill) return;
    await printSalonReceipt({
      ...lastBill,
      items: lastBill.items.map(i => ({ service_name: i.service_name, price: i.price, quantity: i.quantity, employee_name: i.employee_name })),
    }, currency, profile?.store_name || 'Chatarly Salon', getLogoUrl());
  };

  if (loading) return <AppLayout><DashboardSkeleton /></AppLayout>;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Receipt className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Create Bill</h1>
            <p className="text-muted-foreground">Service-based POS billing</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-card p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>Date</Label><Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="mt-1.5" /></div>
                <div><Label>Mobile Number</Label><Input placeholder="9876543210" value={customerPhone} onChange={e => handlePhoneChange(e.target.value)} className="mt-1.5" /></div>
                <div><Label>Customer Name *</Label><Input placeholder="Customer name" value={customerName} onChange={e => setCustomerName(e.target.value)} className="mt-1.5" /></div>
                <div><Label>GST Type</Label>
                  <Select value={gstType} onValueChange={setGstType}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="with_gst">With GST</SelectItem>
                      <SelectItem value="without_gst">Without GST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Payment Mode</Label>
                  <Select value={paymentMode} onValueChange={setPaymentMode}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Discount</Label><Input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} className="mt-1.5" /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} className="mt-1.5 min-h-[60px]" placeholder="Any notes..." /></div>
            </div>

            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Services</h3>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="w-4 h-4" />Add Service</Button>
              </div>

              {items.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">Click "Add Service" to begin</div>
              )}

              {items.map((item, index) => (
                <div key={index} className="p-4 rounded-lg border border-border space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Service</Label>
                      <Select value={item.service_id} onValueChange={v => updateItem(index, { service_id: v })}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select service" /></SelectTrigger>
                        <SelectContent>
                          {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name} - {formatCurrency(s.price, currency)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Employee</Label>
                      <Select value={item.employee_id} onValueChange={v => updateItem(index, { employee_id: v })}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select employee" /></SelectTrigger>
                        <SelectContent>
                          {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label className="text-xs">Price</Label>
                        <Input type="number" value={item.price} onChange={e => updateItem(index, { price: Number(e.target.value) })} className="mt-1" />
                      </div>
                      <div className="w-20">
                        <Label className="text-xs">Qty</Label>
                        <Input type="number" min={1} value={item.quantity} onChange={e => updateItem(index, { quantity: Number(e.target.value) })} className="mt-1" />
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-risk-high" onClick={() => removeItem(index)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="glass-card p-5 space-y-4 sticky top-4">
              <h3 className="font-semibold text-foreground">Bill Summary</h3>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.service_name || 'Service'} x{item.quantity}</span>
                    <span className="text-foreground font-medium">{formatCurrency(item.price * item.quantity, currency)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">{formatCurrency(subtotal, currency)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-risk-high">-{formatCurrency(discount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-foreground">Total</span>
                  <span className="text-primary">{formatCurrency(total, currency)}</span>
                </div>
              </div>
              <Button variant="trust" className="w-full" onClick={handleSubmit} disabled={saving || items.length === 0}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Create Bill
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />Bill Created Successfully
            </DialogTitle>
          </DialogHeader>
          {lastBill && (
            <div className="space-y-4 mt-2">
              <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Invoice</span>
                  <span className="font-mono text-foreground">{lastBill.invoice_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="text-foreground">{lastBill.customer_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment</span>
                  <span className="text-foreground uppercase">{lastBill.payment_mode}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t border-border pt-2">
                  <span className="text-foreground">Total</span>
                  <span className="text-primary">{formatCurrency(lastBill.total_amount, currency)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={handleDownloadReceipt} className="w-full">
                  <Download className="w-4 h-4" />Download
                </Button>
                <Button variant="trust" onClick={handlePrintReceipt} className="w-full">
                  <Printer className="w-4 h-4" />Print
                </Button>
              </div>
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setReceiptOpen(false)}>
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default CreateBill;
