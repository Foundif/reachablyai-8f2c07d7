import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useInvoices, Invoice } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { useCurrency } from '@/hooks/useCurrency';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { formatCurrency, formatDate } from '@/data/mockData';
import { exportToCSV, exportToExcel, ExportColumn } from '@/lib/exportUtils';
import { 
  Plus, 
  Search, 
  FileText, 
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Eye,
  MoreVertical,
  Mail,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const statusConfig = {
  draft: { label: 'Draft', icon: FileText, color: 'text-muted-foreground bg-muted' },
  sent: { label: 'Sent', icon: Send, color: 'text-primary bg-primary/10' },
  paid: { label: 'Paid', icon: CheckCircle, color: 'text-risk-safe bg-risk-safe/10' },
  overdue: { label: 'Overdue', icon: AlertCircle, color: 'text-risk-high bg-risk-high/10' },
};

const Invoices = () => {
  const navigate = useNavigate();
  const { invoices, loading: invoicesLoading } = useInvoices();
  const { clients, loading: clientsLoading } = useClients();
  const currency = useCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loading = invoicesLoading || clientsLoading;

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Unknown Client';
  };

  const getClientEmail = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.email || null;
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      const clientName = getClientName(invoice.client_id);
      const matchesSearch = 
        invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        clientName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, clients, searchQuery, statusFilter]);

  const stats = {
    total: invoices.reduce((sum, inv) => sum + inv.amount, 0),
    paid: invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0),
    pending: invoices.filter(inv => inv.status === 'sent').reduce((sum, inv) => sum + inv.amount, 0),
    overdue: invoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.amount, 0),
  };

  // Export columns configuration
  const exportColumns: ExportColumn<Invoice>[] = [
    { header: 'Invoice #', accessor: 'invoice_number' },
    { header: 'Client', accessor: (inv) => getClientName(inv.client_id) },
    { header: 'Amount', accessor: 'amount' },
    { header: 'Advance Amount', accessor: 'advance_amount' },
    { header: 'Status', accessor: 'status' },
    { header: 'Due Date', accessor: (inv) => inv.due_date ? formatDate(inv.due_date) : '' },
    { header: 'Description', accessor: (inv) => inv.description || '' },
    { header: 'Payment Terms', accessor: (inv) => inv.payment_terms || '' },
    { header: 'Created At', accessor: (inv) => formatDate(inv.created_at) },
  ];

  const handleExportCSV = () => {
    exportToCSV(filteredInvoices, exportColumns, `invoices-export-${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportExcel = () => {
    exportToExcel(filteredInvoices, exportColumns, `invoices-export-${new Date().toISOString().split('T')[0]}`);
  };

  const updateInvoiceStatus = async (invoiceId: string, newStatus: 'draft' | 'sent' | 'paid' | 'overdue') => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', invoiceId);
      
      if (error) throw error;
      toast.success(`Invoice marked as ${newStatus}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update invoice');
    }
  };

  const sendInvoiceEmail = async (invoice: typeof invoices[0]) => {
    const clientEmail = getClientEmail(invoice.client_id);
    const clientName = getClientName(invoice.client_id);
    
    if (!clientEmail) {
      toast.error('Client email not found');
      return;
    }

    try {
      toast.loading('Sending invoice email...');
      
      const response = await supabase.functions.invoke('send-invoice-email', {
        body: {
          type: 'invoice_created',
          invoiceId: invoice.id,
          recipientEmail: clientEmail,
          recipientName: clientName,
          invoiceNumber: invoice.invoice_number,
          amount: invoice.amount,
          dueDate: invoice.due_date,
        },
      });

      toast.dismiss();
      
      if (response.error) throw response.error;
      
      toast.success('Invoice email sent successfully');
      
      // Update status to sent
      if (invoice.status === 'draft') {
        await updateInvoiceStatus(invoice.id, 'sent');
      }
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || 'Failed to send email');
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <DashboardSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Invoices</h1>
            <p className="text-muted-foreground">Manage and track your invoices</p>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="lg" disabled={filteredInvoices.length === 0}>
                  <Download className="w-5 h-5" />
                  <span className="hidden sm:inline ml-1">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border">
                <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer">
                  <FileText className="w-4 h-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export as Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="trust" size="lg" onClick={() => navigate('/invoices/new')}>
              <Plus className="w-5 h-5" />
              Create Invoice
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Invoiced', value: stats.total, color: 'text-foreground' },
            { label: 'Paid', value: stats.paid, color: 'text-risk-safe' },
            { label: 'Pending', value: stats.pending, color: 'text-primary' },
            { label: 'Overdue', value: stats.overdue, color: 'text-risk-high' },
          ].map((stat, i) => (
            <div key={i} className="glass-card p-4">
              <div className="text-sm text-muted-foreground mb-1">{stat.label}</div>
              <div className={cn('text-2xl font-bold', stat.color)}>
                {formatCurrency(stat.value, currency)}
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {['all', 'draft', 'sent', 'paid', 'overdue'].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className="whitespace-nowrap"
              >
                {status === 'all' ? 'All' : statusConfig[status as keyof typeof statusConfig].label}
              </Button>
            ))}
          </div>
        </div>

        {/* Invoice List */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Invoice</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Client</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Due Date</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => {
                  const status = statusConfig[invoice.status];
                  const StatusIcon = status.icon;
                  const clientName = getClientName(invoice.client_id);
                  
                    return (
                    <tr 
                      key={invoice.id} 
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/invoices/${invoice.id}`)}
                    >
                      <td className="p-4">
                        <div className="font-medium text-foreground">{invoice.invoice_number}</div>
                        <div className="text-sm text-muted-foreground">{formatDate(invoice.created_at)}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-foreground">{clientName}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-foreground">{formatCurrency(invoice.amount, currency)}</div>
                        {invoice.advance_amount > 0 && (
                          <div className="text-xs text-primary">
                            Advance: {formatCurrency(invoice.advance_amount, currency)}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium',
                          status.color
                        )}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {status.label}
                        </span>
                      </td>
                      <td className="p-4">
                        {invoice.due_date ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            {formatDate(invoice.due_date)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${invoice.id}`); }}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/clients/${invoice.client_id}`); }}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Client
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); sendInvoiceEmail(invoice); }}>
                              <Mail className="w-4 h-4 mr-2" />
                              Send Email
                            </DropdownMenuItem>
                            {invoice.status !== 'paid' && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateInvoiceStatus(invoice.id, 'paid'); }}>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Mark as Paid
                              </DropdownMenuItem>
                            )}
                            {invoice.status === 'draft' && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateInvoiceStatus(invoice.id, 'sent'); }}>
                                <Send className="w-4 h-4 mr-2" />
                                Mark as Sent
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredInvoices.length === 0 && (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No invoices found</h3>
              <p className="text-muted-foreground mb-4">
                {invoices.length === 0 ? 'Create your first invoice to get started' : 'Try adjusting your search or filters'}
              </p>
              <Button variant="trust" onClick={() => navigate('/invoices/new')}>
                <Plus className="w-4 h-4" />
                Create Invoice
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Invoices;
