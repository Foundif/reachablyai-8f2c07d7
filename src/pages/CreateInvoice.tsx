import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { useClients, Client } from '@/hooks/useClients';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/data/mockData';
import { useCurrency } from '@/hooks/useCurrency';
import TrustScoreDial from '@/components/TrustScoreDial';
import RiskBadge from '@/components/RiskBadge';
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
  Sparkles,
  Send,
  Save,
  TrendingUp,
  Clock,
  Download,
  Image,
  Stamp,
  Building2,
  Phone,
  Mail,
  Globe,
  X,
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

const CreateInvoice = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedClientId = searchParams.get('client');
  const invoiceRef = useRef<HTMLDivElement>(null);
  const { user, profile } = useAuth();
  const { clients, loading: clientsLoading } = useClients();
  const currency = useCurrency();

  // Invoice Data
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('net30');
  const [advancePercent, setAdvancePercent] = useState(0);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [loading, setLoading] = useState(false);

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

  const selectedClient = clients.find(c => c.id === selectedClientId);

  // Generate invoice number on mount
  useEffect(() => {
    const prefix = 'INV';
    const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setInvoiceNumber(`${prefix}-${date}-${random}`);
  }, []);

  // Set preselected client
  useEffect(() => {
    if (preselectedClientId && clients.length > 0) {
      setSelectedClientId(preselectedClientId);
    }
  }, [preselectedClientId, clients]);

  // Initialize with profile data
  useEffect(() => {
    if (profile) {
      setCompanyEmail(profile.email || '');
      setCompanyName(profile.full_name || '');
    }
  }, [profile]);

  // Calculate total from line items
  const calculatedTotal = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  }, [lineItems]);

  // Use calculated total or manual amount
  const totalAmount = parseFloat(amount) || calculatedTotal;

  // AI-powered suggestions based on client risk
  const suggestions = useMemo(() => {
    if (!selectedClient) return null;

    const risk = selectedClient.risk_level;
    let suggestedAdvance = 0;
    let suggestedTerms = 'net30';
    let warning = '';
    let riskExplanation = '';

    if (risk === 'high') {
      suggestedAdvance = 50;
      suggestedTerms = 'due_on_receipt';
      warning = 'High risk client - consider requiring advance payment';
      riskExplanation = 'This client has a high risk profile. Protective measures recommended.';
    } else if (risk === 'medium') {
      suggestedAdvance = 25;
      suggestedTerms = 'net15';
      warning = 'Medium risk - shorter payment terms recommended';
      riskExplanation = 'Moderate risk profile. Consider protective terms.';
    } else {
      suggestedAdvance = 0;
      suggestedTerms = 'net30';
      riskExplanation = 'Excellent payment history. Standard terms are appropriate.';
    }

    return { suggestedAdvance, suggestedTerms, warning, riskExplanation };
  }, [selectedClient]);

  const advanceAmount = useMemo(() => {
    return totalAmount * (advancePercent / 100);
  }, [totalAmount, advancePercent]);

  const dueDate = useMemo(() => {
    const term = PAYMENT_TERMS.find(t => t.id === paymentTerms);
    const date = new Date();
    date.setDate(date.getDate() + (term?.days || 30));
    return date;
  }, [paymentTerms]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogo(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setStamp(event.target?.result as string);
      };
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
      pdf.save(`${invoiceNumber}.pdf`);

      toast.dismiss();
      toast.success('PDF downloaded successfully');
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to generate PDF');
    }
  };

  const handleSubmit = async (status: 'draft' | 'sent') => {
    if (!selectedClient || totalAmount <= 0) {
      toast.error('Please select a client and add amount');
      return;
    }

    if (!user) {
      toast.error('Please log in to create invoices');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('invoices').insert({
        user_id: user.id,
        client_id: selectedClient.id,
        invoice_number: invoiceNumber,
        amount: totalAmount,
        advance_amount: advanceAmount,
        due_date: dueDate.toISOString().split('T')[0],
        description: description || lineItems.map(i => i.description).filter(Boolean).join(', '),
        payment_terms: PAYMENT_TERMS.find(t => t.id === paymentTerms)?.label,
        suggested_advance_percent: suggestions?.suggestedAdvance || 0,
        risk_warning: suggestions?.warning || null,
        status,
      });

      if (error) throw error;

      toast.success(status === 'draft' ? 'Invoice saved as draft' : 'Invoice created successfully');
      navigate('/invoices');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-3 sm:p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Create Invoice</h1>
            <p className="text-sm text-muted-foreground">Smart invoice builder with real-time preview</p>
          </div>
          <Button variant="outline" onClick={downloadPDF}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download PDF</span>
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Form */}
          <div className="space-y-6 order-2 lg:order-1">
            {/* Client Selection */}
            <div className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">Client</h2>
              </div>

              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name} {client.company && `- ${client.company}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedClient && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 flex items-center justify-between p-4 rounded-lg bg-accent/50"
                >
                  <div className="flex items-center gap-4">
                    <TrustScoreDial score={selectedClient.trust_score} size="sm" />
                    <div>
                      <div className="font-medium text-foreground">{selectedClient.name}</div>
                      <div className="text-sm text-muted-foreground">{selectedClient.company}</div>
                    </div>
                  </div>
                  <RiskBadge level={selectedClient.risk_level} />
                </motion.div>
              )}
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

              {/* Or manual amount */}
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

            {/* Payment Terms */}
            <div className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">Payment Terms</h2>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {PAYMENT_TERMS.map((term) => (
                  <button
                    key={term.id}
                    onClick={() => setPaymentTerms(term.id)}
                    className={cn(
                      'p-2 sm:p-3 rounded-lg border-2 text-center transition-all relative',
                      paymentTerms === term.id
                        ? 'border-foreground bg-foreground/10'
                        : 'border-border hover:border-foreground/50 bg-card',
                      suggestions?.suggestedTerms === term.id && paymentTerms !== term.id && 'ring-2 ring-primary/30'
                    )}
                  >
                    {suggestions?.suggestedTerms === term.id && (
                      <span className="absolute -top-2 -right-2 w-4 h-4 bg-foreground rounded-full flex items-center justify-center">
                        <Sparkles className="w-3 h-3 text-background" />
                      </span>
                    )}
                    <div className="font-medium text-foreground text-xs sm:text-sm">{term.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Advance Payment */}
            <div className="glass-card p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold text-foreground">Advance Payment</h2>
                </div>
                {suggestions && suggestions.suggestedAdvance > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAdvancePercent(suggestions.suggestedAdvance)}
                  >
                    <Sparkles className="w-3 h-3" />
                    Apply {suggestions.suggestedAdvance}%
                  </Button>
                )}
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

            {/* Risk Alert & Actions */}
            {selectedClient && suggestions?.warning && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'p-4 rounded-xl border-2',
                  selectedClient.risk_level === 'high' 
                    ? 'border-risk-high bg-risk-high/10' 
                    : 'border-risk-medium bg-risk-medium/10'
                )}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className={cn(
                    'w-5 h-5 mt-0.5',
                    selectedClient.risk_level === 'high' ? 'text-risk-high' : 'text-risk-medium'
                  )} />
                  <div>
                    <div className="font-semibold text-foreground mb-1">Risk Alert</div>
                    <div className="text-sm text-muted-foreground">{suggestions.warning}</div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => handleSubmit('draft')}
                disabled={!selectedClient || totalAmount <= 0 || loading}
              >
                <Save className="w-4 h-4" />
                Save Draft
              </Button>
              <Button
                size="lg"
                className="flex-1"
                onClick={() => handleSubmit('sent')}
                disabled={!selectedClient || totalAmount <= 0 || loading}
              >
                <Send className="w-4 h-4" />
                {loading ? 'Creating...' : 'Create Invoice'}
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
                    <div className="text-sm text-gray-600 mt-1">{invoiceNumber}</div>
                    <div className="text-sm text-gray-600">
                      Date: {new Date().toLocaleDateString()}
                    </div>
                    <div className="text-sm text-gray-600">
                      Due: {dueDate.toLocaleDateString()}
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

                {/* Payment Terms */}
                <div className="text-sm text-gray-600 mb-8">
                  <strong>Payment Terms:</strong> {PAYMENT_TERMS.find(t => t.id === paymentTerms)?.label}
                </div>

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
      </div>
    </AppLayout>
  );
};

export default CreateInvoice;
