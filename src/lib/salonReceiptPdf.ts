import jsPDF from 'jspdf';

interface ReceiptItem {
  service_name: string;
  price: number;
  quantity: number;
  employee_name?: string;
}

interface ReceiptData {
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  customer_phone?: string;
  gst_type: string;
  payment_mode: string;
  discount: number;
  total_amount: number;
  items: ReceiptItem[];
  notes?: string;
}

interface ReceiptOptions {
  logoUrl?: string;
}

const loadImageAsDataUrl = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export const generateSalonReceipt = async (
  data: ReceiptData,
  currency: string,
  storeName: string = 'Chatarly Salon',
  options?: ReceiptOptions
) => {
  const doc = new jsPDF({ unit: 'mm', format: [80, 280] });
  const w = 80;
  let y = 8;

  const formatAmt = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  // Logo
  if (options?.logoUrl) {
    const logoData = await loadImageAsDataUrl(options.logoUrl);
    if (logoData) {
      try {
        doc.addImage(logoData, 'PNG', (w - 16) / 2, y, 16, 16);
        y += 18;
      } catch { /* skip logo on error */ }
    }
  }

  // Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(storeName, w / 2, y, { align: 'center' });
  y += 5;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Salon & Spa', w / 2, y, { align: 'center' });
  y += 6;

  doc.setLineWidth(0.3);
  doc.line(5, y, w - 5, y);
  y += 4;

  // Invoice details
  doc.setFontSize(8);
  doc.text(`Invoice: ${data.invoice_number}`, 5, y); y += 4;
  doc.text(`Date: ${new Date(data.invoice_date).toLocaleDateString('en-IN')}`, 5, y); y += 4;
  doc.text(`Customer: ${data.customer_name}`, 5, y); y += 4;
  if (data.customer_phone) { doc.text(`Phone: ${data.customer_phone}`, 5, y); y += 4; }
  doc.text(`Payment: ${data.payment_mode.toUpperCase()}`, 5, y); y += 4;
  doc.text(`Type: ${data.gst_type === 'with_gst' ? 'With GST' : 'Without GST'}`, 5, y); y += 4;

  y += 1;
  doc.line(5, y, w - 5, y);
  y += 4;

  // Items header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Service', 5, y);
  doc.text('Qty', 48, y, { align: 'center' });
  doc.text('Amount', w - 5, y, { align: 'right' });
  y += 1;
  doc.line(5, y, w - 5, y);
  y += 3;
  doc.setFont('helvetica', 'normal');

  // Items
  data.items.forEach(item => {
    const name = item.service_name;
    const lines = doc.splitTextToSize(name, 38);
    lines.forEach((line: string, i: number) => {
      doc.text(line, 5, y);
      if (i === 0) {
        doc.text(item.quantity.toString(), 48, y, { align: 'center' });
        doc.text(formatAmt(item.price * item.quantity), w - 5, y, { align: 'right' });
      }
      y += 4;
    });
    if (item.employee_name) {
      doc.setFontSize(6);
      doc.text(`  by ${item.employee_name}`, 5, y);
      doc.setFontSize(7);
      y += 3;
    }
  });

  y += 1;
  doc.line(5, y, w - 5, y);
  y += 4;

  // Subtotal & discount
  const subtotal = data.items.reduce((s, i) => s + i.price * i.quantity, 0);
  doc.setFontSize(8);
  if (data.discount > 0) {
    doc.text('Subtotal', 5, y);
    doc.text(formatAmt(subtotal), w - 5, y, { align: 'right' });
    y += 4;
    doc.text('Discount', 5, y);
    doc.text(`-${formatAmt(data.discount)}`, w - 5, y, { align: 'right' });
    y += 5;
  }

  // Total
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', 5, y);
  doc.text(formatAmt(data.total_amount), w - 5, y, { align: 'right' });
  y += 7;

  // Notes
  if (data.notes) {
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(`Note: ${data.notes}`, 5, y);
    y += 5;
  }

  // Footer
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Thank you for visiting!', w / 2, y, { align: 'center' });
  y += 4;
  doc.setFontSize(6);
  doc.text('Powered by Chatarly', w / 2, y, { align: 'center' });

  return doc;
};

export const downloadSalonReceipt = async (
  data: ReceiptData,
  currency: string,
  storeName?: string,
  logoUrl?: string
) => {
  const doc = await generateSalonReceipt(data, currency, storeName, { logoUrl });
  doc.save(`Receipt-${data.invoice_number}.pdf`);
};

export const printSalonReceipt = async (
  data: ReceiptData,
  currency: string,
  storeName?: string,
  logoUrl?: string
) => {
  const doc = await generateSalonReceipt(data, currency, storeName, { logoUrl });
  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  const printWindow = window.open(url);
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
};
