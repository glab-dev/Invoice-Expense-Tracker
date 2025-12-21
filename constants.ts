
import { Company, Invoice, Expense } from './types';

export const MOCK_COMPANIES: Company[] = [
  { id: 'comp-1', name: 'Apex Lighting', address: '123 Pixel Ave, Tron City', defaultRate: 600, defaultPerDiem: 75 },
  { id: 'comp-2', name: 'Soundbox Audio', address: '456 Synth St, Neo Kyoto', defaultRate: 550, defaultPerDiem: 50 },
];

// Default categories for initialization
export const DEFAULT_EXPENSE_CATEGORIES = ['Travel', 'Meals', 'Lodging', 'Gear', 'Misc'];

export const MOCK_EXPENSES: Expense[] = [
    { id: 'exp-1', date: '2024-07-15', description: 'Flight to Neo Kyoto', amount: 450.00, currency: 'USD', cadAmount: 612.50, category: 'Travel', isBillable: true, billedToInvoiceId: 'inv-1' },
    { id: 'exp-2', date: '2024-07-16', description: 'Hotel in Neo Kyoto', amount: 180.00, currency: 'USD', cadAmount: 245.00, category: 'Lodging', isBillable: true, billedToInvoiceId: 'inv-1' },
    { id: 'exp-3', date: '2024-07-20', description: 'Team Dinner', amount: 85.50, currency: 'CAD', cadAmount: 85.50, category: 'Meals', isBillable: false },
    { id: 'exp-4', date: '2024-07-22', description: 'Gaffer Tape', amount: 25.00, currency: 'CAD', cadAmount: 25.00, category: 'Gear', isBillable: true, billedToInvoiceId: undefined }
];

export const MOCK_INVOICES: Invoice[] = [
    { 
        id: 'inv-1', 
        invoiceNumber: 1, 
        companyId: 'comp-2', 
        date: '2024-07-18', 
        items: [
            { id: 'item-1', startDate: '2024-07-16', endDate: '2024-07-17', description: 'Audio Engineer', quantity: 2, unit: 'Day', rate: 550, amount: 1100, perDiemQuantity: 2, perDiemCurrency: 'CAD', approver: 'Jane Doe' },
        ],
        attachedExpenseIds: ['exp-1', 'exp-2'],
        notes: 'Thanks for the great gig!',
        status: 'Paid',
        hstRate: 0.13,
    },
];

export const CURRENCY_RATES: { [key: string]: number } = {
  'USD': 1.379333333,
  'EUR': 1.48,
  'GBP': 1.74,
  'CAD': 1.00,
};
