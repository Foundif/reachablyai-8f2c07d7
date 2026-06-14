export interface Service {
  id: string;
  user_id: string;
  name: string;
  category: string;
  price: number;
  duration: number | null;
  gst_applicable: boolean;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  role: string;
  commission_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  user_id: string;
  customer_id: string | null;
  service_id: string | null;
  employee_id: string | null;
  appointment_date: string;
  appointment_time: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  customer_name?: string;
  service_name?: string;
  employee_name?: string;
}

export interface SalonInvoice {
  id: string;
  user_id: string;
  invoice_number: string;
  customer_id: string | null;
  invoice_date: string;
  gst_type: string;
  payment_mode: string;
  discount: number;
  total_amount: number;
  notes: string | null;
  created_at: string;
  items?: SalonInvoiceItem[];
  customer_name?: string;
  customer_phone?: string;
}

export interface SalonInvoiceItem {
  id: string;
  invoice_id: string;
  service_id: string | null;
  employee_id: string | null;
  service_name: string;
  price: number;
  quantity: number;
  created_at: string;
  // joined
  employee_name?: string;
}

export interface Expense {
  id: string;
  user_id: string;
  name: string;
  category: string;
  amount: number;
  expense_date: string;
  notes: string | null;
  created_at: string;
}

export interface SalonCustomer {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  total_purchases: number;
  total_visits: number;
  last_purchase_date: string | null;
  created_at: string;
  updated_at: string;
}

export type ServiceCategory = 'hair' | 'facial' | 'threading' | 'spa' | 'makeup' | 'pedicure' | 'manicure' | 'other';
export type AppointmentStatus = 'booked' | 'completed' | 'cancelled';
export type GSTType = 'with_gst' | 'without_gst';
export type PaymentMode = 'cash' | 'upi' | 'card';
export type ExpenseCategory = 'rent' | 'salary' | 'utilities' | 'products' | 'miscellaneous';
