import jsPDF from 'jspdf';
import { Sale } from '@/types/store';

export const generateReceiptPdf = (sale: Sale, currency: string, storeName: string = 'Chatarly Store') => {
  const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
  const w = 80;
  let y = 10;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(storeName, w / 2, y, { align: 'center' });
  y += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Tax Invoice / Receipt', w / 2, y, { align: 'center' });
  y += 8;

  doc.setLineWidth(0.3);
  doc.line(5, y, w - 5, y);
  y += 5;

  doc.setFontSize(8);
  doc.text(`Invoice: ${sale.invoice_number}`, 5, y); y += 4;
  doc.text(`Date: ${new Date(sale.created_at).toLocaleString()}`, 5, y); y += 4;
  doc.text(`Payment: ${sale.payment_method.toUpperCase()}`, 5, y); y += 4;
  if (sale.customer_phone) { doc.text(`Customer: ${sale.customer_phone}`, 5, y); y += 4; }

  y += 2;
  doc.line(5, y, w - 5, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Item', 5, y);
  doc.text('Qty', 45, y, { align: 'center' });
  doc.text('Amount', w - 5, y, { align: 'right' });
  y += 4;
  doc.setFont('helvetica', 'normal');

  const formatAmt = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  (sale.items || []).forEach(item => {
    const name = `${item.product_name} (${item.size})`;
    const lines = doc.splitTextToSize(name, 35);
    lines.forEach((line: string, i: number) => {
      doc.text(line, 5, y);
      if (i === 0) {
        doc.text(item.quantity.toString(), 45, y, { align: 'center' });
        doc.text(formatAmt(item.selling_price * item.quantity), w - 5, y, { align: 'right' });
      }
      y += 4;
    });
  });

  y += 2;
  doc.line(5, y, w - 5, y);
  y += 5;

  const subtotal = (sale.items || []).reduce((sum, i) => sum + i.selling_price * i.quantity, 0);
  if (sale.discount_amount && sale.discount_amount > 0) {
    doc.setFontSize(8);
    doc.text('Subtotal', 5, y);
    doc.text(formatAmt(subtotal), w - 5, y, { align: 'right' });
    y += 4;
    doc.text('Discount', 5, y);
    doc.text(`-${formatAmt(sale.discount_amount)}`, w - 5, y, { align: 'right' });
    y += 5;
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', 5, y);
  doc.text(formatAmt(sale.total_amount), w - 5, y, { align: 'right' });
  y += 8;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Thank you for your purchase!', w / 2, y, { align: 'center' });
  y += 4;
  doc.text('Powered by Chatarly', w / 2, y, { align: 'center' });

  return doc;
};

export const downloadReceipt = (sale: Sale, currency: string, storeName?: string) => {
  const doc = generateReceiptPdf(sale, currency, storeName);
  doc.save(`Receipt-${sale.invoice_number}.pdf`);
};
