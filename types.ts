
export interface Company {
  id: string;
  name: string;
  address: string;
  defaultRate: number;
  defaultPerDiem: number;
}

export interface InvoiceItem {
  id: string;
  startDate: string;
  endDate: string | null; // Nullable for single-day items
  description: string;
  quantity: number;
  unit: 'Day' | 'Half-Day' | 'Hourly';
  rate: number;
  amount: number; // This will be quantity * rate
  perDiemQuantity: number;
  perDiemCurrency: 'CAD' | 'USD'; // Added for currency selection
  approver: string;
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  cadAmount: number;
  category: string; // Changed from ExpenseCategory enum to string
  receiptUrl?: string; // local data URL or drive link
  isBillable: boolean;
  billedToInvoiceId?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: number;
  companyId: string;
  date: string;
  items: InvoiceItem[];
  attachedExpenseIds: string[];
  notes: string;
  status: 'Draft' | 'Sent' | 'Paid';
  hstRate: number; // e.g., 0.13 for 13%
}

export interface UserProfile {
  name: string;
  address: string;
}