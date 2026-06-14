import { useState, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useSalonInvoices } from '@/hooks/useSalonInvoices';
import { useCurrency } from '@/hooks/useCurrency';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/data/mockData';
import { downloadSalonReceipt } from '@/lib/salonReceiptPdf';
import { supabase } from '@/integrations/supabase/client';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { FileText, Search, Download, Eye, Trash2, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { SalonInvoice } from '@/types/salon';

const PAGE_SIZE = 10;

const GSTSales = () => {
  const { invoices, loading, refetch } = useSalonInvoices();
  const { profile } = useAuth();
  const currency = useCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [viewInvoice, setViewInvoice] = useState<SalonInvoice | null>(null);

  const gstInvoices = invoices.filter(i => i.gst_type === 'with_gst');

  const filtered = useMemo(() => {
    return gstInvoices.filter(i => {
      if (fromDate && i.invoice_date < fromDate) return false;
      if (toDate && i.invoice_date > toDate) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return i.invoice_number.toLowerCase().includes(q) ||
        i.customer_name?.toLowerCase().includes(q) ||
        i.customer_phone?.toLowerCase().includes(q);
    });
  }, [gstInvoices, fromDate, toDate, searchQuery]);

  const totalSale = filtered.reduce((s, i) => s + i.total_amount, 0);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCSV = () => {
    const headers = ['Invoice Number', 'Date', 'Customer', 'Mobile', 'Services', 'Employee', 'Amount'];
    const rows = filtered.map(inv => [
      inv.invoice_number, inv.invoice_date, inv.customer_name || '', inv.customer_phone || '',
      (inv.items || []).map(i => i.service_name).join('; '),
      (inv.items || []).map(i => i.employee_name || '').filter(Boolean).join('; '),
      inv.total_amount.toString(),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'gst-sales.csv'; a.click();
  };

  const getLogoUrl = () => {
    if (!profile?.user_id) return undefined;
    const { data } = supabase.storage.from('salon-assets').getPublicUrl(`logos/${profile.user_id}/logo.png`);
    return data?.publicUrl;
  };

  const handleDownload = async (inv: SalonInvoice) => {
    await downloadSalonReceipt({
      invoice_number: inv.invoice_number, invoice_date: inv.invoice_date,
      customer_name: inv.customer_name || 'Walk-in', customer_phone: inv.customer_phone,
      gst_type: inv.gst_type, payment_mode: inv.payment_mode,
      discount: inv.discount, total_amount: inv.total_amount,
      items: (inv.items || []).map(i => ({ service_name: i.service_name, price: i.price, quantity: i.quantity, employee_name: i.employee_name })),
      notes: inv.notes || undefined,
    }, currency, profile?.store_name || 'Chatarly Salon', getLogoUrl());
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this invoice?')) return;
    try {
      await supabase.from('salon_invoice_items').delete().eq('invoice_id', id);
      const { error } = await supabase.from('salon_invoices').delete().eq('id', id);
      if (error) throw error;
      toast.success('Invoice deleted'); refetch();
    } catch (err: any) { toast.error(err.message); }
  };

  const sendWhatsApp = (inv: SalonInvoice) => {
    const phone = inv.customer_phone?.replace(/[^0-9]/g, '') || '';
    const msg = `Hi ${inv.customer_name},\n\nThank you for visiting ${profile?.store_name || 'our salon'}! ✨\n\nInvoice: ${inv.invoice_number}\nAmount: ${formatCurrency(inv.total_amount, currency)}\nDate: ${inv.invoice_date}\n\nSee you again soon!`;
    if (phone) window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    else toast.error('No phone number');
  };

  if (loading) return <AppLayout><DashboardSkeleton /></AppLayout>;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">GST Sales</h1>
              <p className="text-muted-foreground">{gstInvoices.length} invoices with GST</p>
            </div>
          </div>
          <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4" />Export CSV</Button>
        </div>

        {/* Date Filters */}
        <div className="glass-card p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 min-w-0">
              <label className="text-xs font-medium text-muted-foreground uppercase">From Date</label>
              <Input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} className="mt-1" />
            </div>
            <div className="flex-1 min-w-0">
              <label className="text-xs font-medium text-muted-foreground uppercase">To Date</label>
              <Input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} className="mt-1" />
            </div>
            <div className="flex-1 min-w-0 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground mt-3" />
              <label className="text-xs font-medium text-muted-foreground uppercase">Search</label>
              <Input placeholder="Search invoices..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }} className="pl-10 mt-1" />
            </div>
            {(fromDate || toDate) && (
              <Button variant="outline" size="sm" onClick={() => { setFromDate(''); setToDate(''); setPage(1); }}>Reset</Button>
            )}
          </div>
        </div>

        {/* Total Sale Badge */}
        <div className="flex justify-center">
          <div className="px-6 py-2 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
            Total Sale: {formatCurrency(totalSale, currency)}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No GST Sales</h3>
            <p className="text-muted-foreground">No invoices with GST found.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {paged.map((inv, index) => (
                <div key={inv.id} className="glass-card p-4 hover-lift animate-fade-up" style={{ animationDelay: `${index * 30}ms` }}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold text-foreground">{inv.invoice_number}</span>
                          <span className="text-xs text-muted-foreground">{inv.invoice_date}</span>
                        </div>
                        <p className="text-sm text-foreground truncate">{inv.customer_name || 'Walk-in'} {inv.customer_phone ? `· ${inv.customer_phone}` : ''}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {(inv.items || []).map(i => i.service_name).join(', ') || '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(inv.items || []).map(i => i.employee_name).filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2">
                      <span className="text-base font-bold text-primary">{formatCurrency(inv.total_amount, currency)}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewInvoice(inv)}><Eye className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(inv)}><Download className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-risk-safe" onClick={() => sendWhatsApp(inv)}><MessageCircle className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-risk-high" onClick={() => handleDelete(inv.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} entries</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = page <= 3 ? i + 1 : page + i - 2;
                  if (p < 1 || p > totalPages) return null;
                  return (
                    <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" onClick={() => setPage(p)}
                      className="min-w-[32px]">{p}</Button>
                  );
                })}
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={!!viewInvoice} onOpenChange={() => setViewInvoice(null)}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-primary" />Invoice Details</DialogTitle></DialogHeader>
          {viewInvoice && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Invoice #</p><p className="font-mono font-medium text-foreground">{viewInvoice.invoice_number}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Date</p><p className="font-medium text-foreground">{viewInvoice.invoice_date}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Customer</p><p className="font-medium text-foreground">{viewInvoice.customer_name || 'Walk-in'}</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Payment</p><p className="font-medium text-foreground uppercase">{viewInvoice.payment_mode}</p></div>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-2 font-semibold">Services</p>
                {(viewInvoice.items || []).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                    <div>
                      <span className="text-foreground">{item.service_name}</span>
                      {item.employee_name && <span className="text-xs text-muted-foreground ml-2">by {item.employee_name}</span>}
                    </div>
                    <span className="font-medium text-foreground">{formatCurrency(item.price * item.quantity, currency)}</span>
                  </div>
                ))}
              </div>
              {viewInvoice.discount > 0 && (
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Discount</span><span className="text-risk-high">-{formatCurrency(viewInvoice.discount, currency)}</span></div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-border pt-3">
                <span className="text-foreground">Total</span>
                <span className="text-primary">{formatCurrency(viewInvoice.total_amount, currency)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => { handleDownload(viewInvoice); }}><Download className="w-4 h-4" />Download</Button>
                <Button variant="trust" onClick={() => { sendWhatsApp(viewInvoice); }}><MessageCircle className="w-4 h-4" />WhatsApp</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default GSTSales;
