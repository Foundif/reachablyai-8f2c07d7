import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useClients } from '@/hooks/useClients';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/data/mockData';
import { useCurrency } from '@/hooks/useCurrency';
import TrustScoreDial from '@/components/TrustScoreDial';
import RiskBadge from '@/components/RiskBadge';
import SendReminderModal from '@/components/invoices/SendReminderModal';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { 
  FileText, 
  ArrowLeft, 
  AlertTriangle, 
  Shield, 
  DollarSign,
  Calendar,
  User,
  Save,
  Download,
  Image,
  Stamp,
  Building2,
  Phone,
  Mail,
  Globe,
  X,
  Send,
  CheckCircle,
  Loader2,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PAYMENT_TERMS = [
  { id: 'net7', label: 'Net 7', days: 7 },
  { id: 'net15', label: 'Net 15', days: 15 },
  { id: 'net30', label: 'Net 30', days: 30 },
  { id: 'net45', label: 'Net 45', days: 45 },
  { id: 'net60', label: 'Net 60', days: 60 },
  { id: 'due_on_receipt', label: 'Due on Receipt', days: 0 },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'bg-muted text-muted-foreground' },
  { value: 'sent', label: 'Sent', color: 'bg-primary/20 text-primary' },
  { value: 'paid', label: 'Paid', color: 'bg-trust/20 text-trust' },
  { value: 'overdue', label: 'Overdue', color: 'bg-risk-high/20 text-risk-high' },
];

const InvoiceDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const { user, profile } = useAuth();
  const { clients } = useClients();
  const currency = useCurrency();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState<any>(null);

  // Form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('net30');
  const [advancePercent, setAdvancePercent] = useState(0);
  const [status, setStatus] = useState('draft');
  const [dueDate, setDueDate] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);

  // Custom Branding
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [stamp, setStamp] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Line Items
  const [lineItems, setLineItems] = useState([
    { description: '', quantity: 1, rate: 0 }
  ]);

  // Fetch invoice
  useEffect(() => {
    const fetchInvoice = async () => {
      if (!id) return;

      try {
        const { data, error } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        setInvoice(data);
        setDescription(data.description || '');
        setAmount(data.amount?.toString() || '');
        setStatus(data.status || 'draft');
        setDueDate(data.due_date || '');
        setAdvancePercent(data.suggested_advance_percent || 0);
        setNotes(data.risk_warning || '');

        // Parse payment terms from label
        const term = PAYMENT_TERMS.find(t => t.label === data.payment_terms);
        if (term) setPaymentTerms(term.id);

        // Parse line items from description if possible
        if (data.description) {
          const items = data.description.split(', ').map((desc: string) => ({
            description: desc,
            quantity: 1,
            rate: data.amount / data.description.split(', ').length,
          }));
          setLineItems(items.length > 0 ? items : [{ description: '', quantity: 1, rate: 0 }]);
        }
      } catch (err: any) {
        toast.error('Failed to load invoice');
        navigate('/invoices');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [id, navigate]);

  // Initialize with profile data
  useEffect(() => {
    if (profile) {
      setCompanyEmail(profile.email || '');
      setCompanyName(profile.full_name || '');
    }
  }, [profile]);

  const selectedClient = clients.find(c => c.id === invoice?.client_id);

  const calculatedTotal = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  }, [lineItems]);

  const totalAmount = parseFloat(amount) || calculatedTotal;
  const advanceAmount = totalAmount * (advancePercent / 100);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setLogo(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setStamp(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, rate: 0 }]);
  };

  const updateLineItem = (index: number, field: string, value: string | number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const downloadPDF = async () => {
    if (!invoiceRef.current) return;

    try {
      toast.loading('Generating PDF...');
      
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${invoice?.invoice_number || 'invoice'}.pdf`);

      toast.dismiss();
      toast.success('PDF downloaded successfully');
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to generate PDF');
    }
  };

  const handleSave = async () => {
    if (!invoice) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          amount: totalAmount,
          description: description || lineItems.map(i => i.description).filter(Boolean).join(', '),
          payment_terms: PAYMENT_TERMS.find(t => t.id === paymentTerms)?.label,
          suggested_advance_percent: advancePercent,
          advance_amount: advanceAmount,
          status,
          due_date: dueDate,
          risk_warning: notes || null,
        })
        .eq('id', invoice.id);

      if (error) throw error;

      toast.success('Invoice updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!invoice) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'paid' })
        .eq('id', invoice.id);

      if (error) throw error;

      setStatus('paid');
      toast.success('Invoice marked as paid');

      // Update client total_paid
      if (selectedClient) {
        await supabase
          .from('clients')
          .update({
            total_paid: selectedClient.total_paid + totalAmount,
            total_outstanding: Math.max(0, selectedClient.total_outstanding - totalAmount),
          })
          .eq('id', selectedClient.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id);

      if (error) throw error;

      toast.success('Invoice deleted successfully');
      navigate('/invoices');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete invoice');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSendReminder = async () => {
    if (!selectedClient?.email) {
      toast.error('Client has no email address');
      return;
    }
    setReminderModalOpen(true);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!invoice) {
    return (
      <AppLayout>
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Invoice not found</p>
        </div>
      </AppLayout>
    );
  }

  const dueDateObj = dueDate ? new Date(dueDate) : new Date();

  return (
    <AppLayout>
      <div className="p-3 sm:p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/invoices')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                {invoice.invoice_number}
              </h1>
              <span className={cn(
                'px-3 py-1 rounded-full text-xs font-medium',
                STATUS_OPTIONS.find(s => s.value === status)?.color
              )}>
                {STATUS_OPTIONS.find(s => s.value === status)?.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Edit and manage invoice</p>
          </div>
          <div className="flex gap-2">
            {status !== 'paid' && (
              <Button variant="outline" onClick={handleSendReminder}>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Remind</span>
              </Button>
            )}
            {status !== 'paid' && (
              <Button variant="success" onClick={handleMarkAsPaid} disabled={saving}>
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Mark Paid</span>
              </Button>
            )}
            <Button variant="outline" onClick={downloadPDF}>
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Form */}
          <div className="space-y-6 order-2 lg:order-1">
            {/* Client Info */}
            {selectedClient && (
              <div className="glass-card p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold text-foreground">Client</h2>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-accent/50">
                  <div className="flex items-center gap-4">
                    <TrustScoreDial score={selectedClient.trust_score} size="sm" />
                    <div>
                      <div className="font-medium text-foreground">{selectedClient.name}</div>
                      <div className="text-sm text-muted-foreground">{selectedClient.company}</div>
                    </div>
                  </div>
                  <RiskBadge level={selectedClient.risk_level} />
                </div>
              </div>
            )}

            {/* Status */}
            <div className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">Invoice Status</h2>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStatus(opt.value)}
                    className={cn(
                      'p-3 rounded-lg border-2 text-center transition-all text-sm',
                      status === opt.value
                        ? 'border-foreground bg-foreground/10'
                        : 'border-border hover:border-foreground/50 bg-card'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Company Details */}
            <div className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">Your Company</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Your Company"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="companyEmail">Email</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    placeholder="email@company.com"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="companyPhone">Phone</Label>
                  <Input
                    id="companyPhone"
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    placeholder="+1 234 567 890"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="companyWebsite">Website</Label>
                  <Input
                    id="companyWebsite"
                    value={companyWebsite}
                    onChange={(e) => setCompanyWebsite(e.target.value)}
                    placeholder="www.company.com"
                    className="mt-1.5"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="companyAddress">Address</Label>
                  <Input
                    id="companyAddress"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    placeholder="123 Business St, City, Country"
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Logo & Stamp Upload */}
              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label>Company Logo</Label>
                  <div className="mt-1.5">
                    {logo ? (
                      <div className="relative inline-block">
                        <img src={logo} alt="Logo" className="h-16 object-contain rounded border" />
                        <button
                          onClick={() => setLogo(null)}
                          className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 p-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50">
                        <Image className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Upload logo</span>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Signature/Stamp</Label>
                  <div className="mt-1.5">
                    {stamp ? (
                      <div className="relative inline-block">
                        <img src={stamp} alt="Stamp" className="h-16 object-contain rounded border" />
                        <button
                          onClick={() => setStamp(null)}
                          className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 p-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50">
                        <Stamp className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Upload stamp</span>
                        <input type="file" accept="image/*" onChange={handleStampUpload} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="glass-card p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold text-foreground">Line Items</h2>
                </div>
                <Button variant="outline" size="sm" onClick={addLineItem}>
                  + Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {lineItems.map((item, index) => (
                  <div key={index} className="flex gap-2 sm:gap-3 items-start">
                    <div className="flex-1">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      />
                    </div>
                    <div className="w-16 sm:w-20">
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity || ''}
                        onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="w-20 sm:w-28">
                      <Input
                        type="number"
                        placeholder="Rate"
                        value={item.rate || ''}
                        onChange={(e) => updateLineItem(index, 'rate', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    {lineItems.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeLineItem(index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <Label>Or enter total amount manually</Label>
                <div className="relative mt-1.5">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {/* Due Date */}
            <div className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">Due Date</h2>
              </div>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Advance Payment */}
            <div className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">Advance Payment</h2>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[0, 25, 50, 75, 100].map((percent) => (
                  <button
                    key={percent}
                    onClick={() => setAdvancePercent(percent)}
                    className={cn(
                      'p-2 sm:p-3 rounded-lg border-2 text-center transition-all',
                      advancePercent === percent
                        ? 'border-foreground bg-foreground/10'
                        : 'border-border hover:border-foreground/50 bg-card'
                    )}
                  >
                    <div className="font-bold text-foreground text-sm sm:text-base">{percent}%</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="glass-card p-4 sm:p-6">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Payment instructions, terms, or additional notes..."
                className="mt-1.5 min-h-[80px]"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => navigate('/invoices')}
              >
                Cancel
              </Button>
              <Button
                size="lg"
                className="flex-1"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-8 lg:self-start">
            <div className="glass-card p-2 sm:p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Live Preview</h3>
                <Button variant="outline" size="sm" onClick={downloadPDF}>
                  <Download className="w-4 h-4" />
                  PDF
                </Button>
              </div>

              {/* Invoice Preview */}
              <div 
                ref={invoiceRef}
                className="bg-white text-gray-900 p-6 sm:p-8 rounded-lg shadow-lg overflow-hidden"
                style={{ minHeight: '500px' }}
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-8">
                  <div>
                    {logo ? (
                      <img src={logo} alt="Logo" className="h-12 sm:h-16 object-contain mb-2" />
                    ) : (
                      <div className="text-xl sm:text-2xl font-bold text-gray-900">
                        {companyName || 'Your Company'}
                      </div>
                    )}
                    {companyAddress && <p className="text-sm text-gray-600">{companyAddress}</p>}
                    <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600">
                      {companyPhone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {companyPhone}
                        </span>
                      )}
                      {companyEmail && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {companyEmail}
                        </span>
                      )}
                      {companyWebsite && (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" /> {companyWebsite}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900">INVOICE</div>
                    <div className="text-sm text-gray-600 mt-1">{invoice.invoice_number}</div>
                    <div className="text-sm text-gray-600">
                      Created: {new Date(invoice.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-gray-600">
                      Due: {dueDateObj.toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Bill To */}
                <div className="mb-8">
                  <div className="text-sm font-medium text-gray-500 mb-2">BILL TO</div>
                  <div className="font-semibold text-gray-900">
                    {selectedClient?.name || 'Client Name'}
                  </div>
                  {selectedClient?.company && (
                    <div className="text-sm text-gray-600">{selectedClient.company}</div>
                  )}
                  {selectedClient?.email && (
                    <div className="text-sm text-gray-600">{selectedClient.email}</div>
                  )}
                  {selectedClient?.country && (
                    <div className="text-sm text-gray-600">{selectedClient.country}</div>
                  )}
                </div>

                {/* Line Items */}
                <div className="mb-8">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-2 text-gray-600 font-medium">Description</th>
                        <th className="text-right py-2 text-gray-600 font-medium w-16">Qty</th>
                        <th className="text-right py-2 text-gray-600 font-medium w-24">Rate</th>
                        <th className="text-right py-2 text-gray-600 font-medium w-24">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.filter(i => i.description || i.rate).map((item, index) => (
                        <tr key={index} className="border-b border-gray-100">
                          <td className="py-3 text-gray-900">{item.description || 'Item'}</td>
                          <td className="py-3 text-right text-gray-900">{item.quantity}</td>
                          <td className="py-3 text-right text-gray-900">{formatCurrency(item.rate, currency)}</td>
                          <td className="py-3 text-right text-gray-900">
                            {formatCurrency(item.quantity * item.rate, currency)}
                          </td>
                        </tr>
                      ))}
                      {lineItems.filter(i => i.description || i.rate).length === 0 && (
                        <tr className="border-b border-gray-100">
                          <td className="py-3 text-gray-400" colSpan={4}>No items added</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="flex justify-end mb-8">
                  <div className="w-48 sm:w-64">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium text-gray-900">{formatCurrency(totalAmount, currency)}</span>
                    </div>
                    {advancePercent > 0 && (
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-600">Advance ({advancePercent}%)</span>
                        <span className="font-medium text-green-600">{formatCurrency(advanceAmount, currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-3">
                      <span className="font-bold text-gray-900">Total Due</span>
                      <span className="font-bold text-xl text-gray-900">
                        {formatCurrency(totalAmount - advanceAmount, currency)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {notes && (
                  <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-500 mb-1">Notes</div>
                    <div className="text-sm text-gray-700">{notes}</div>
                  </div>
                )}

                {/* Signature/Stamp */}
                {stamp && (
                  <div className="flex justify-end">
                    <img src={stamp} alt="Signature" className="h-16 sm:h-20 object-contain opacity-80" />
                  </div>
                )}

                {/* Footer */}
                <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-500">
                  Thank you for your business!
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete invoice {invoice?.invoice_number}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Send Reminder Modal */}
        {selectedClient && (
          <SendReminderModal
            open={reminderModalOpen}
            onOpenChange={setReminderModalOpen}
            clientName={selectedClient.name}
            clientEmail={selectedClient.email}
            invoiceNumber={invoice?.invoice_number}
            amount={totalAmount}
            dueDate={dueDate}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default InvoiceDetail;
