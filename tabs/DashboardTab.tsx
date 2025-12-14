
import React from 'react';
import { useAppContext } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Company } from '../types';

const DashboardTab: React.FC = () => {
  const { invoices, expenses, companies } = useAppContext();
  const companyMap = new Map<string, Company>(companies.map(c => [c.id, c]));

  // Filter for paid invoices to ensure dashboard reflects actual income
  const paidInvoices = invoices.filter(inv => inv.status === 'Paid');
  const paidInvoiceIds = new Set(paidInvoices.map(inv => inv.id));

  // Calculate totals based on PAID invoices only
  const totalIncomeSubtotal = paidInvoices.reduce((acc, inv) => {
    const subtotal = inv.items.reduce((sum, item) => sum + item.amount, 0);
    return acc + subtotal;
  }, 0);

  const totalPDsInvoiced = paidInvoices.reduce((acc, inv) => {
    const company = companyMap.get(inv.companyId);
    const defaultPerDiem = company?.defaultPerDiem || 0;
    const invoicePDTotal = inv.items.reduce((sum, item) => sum + (item.perDiemQuantity * defaultPerDiem), 0);
    return acc + invoicePDTotal;
  }, 0);

  const totalHSTInvoiced = paidInvoices.reduce((acc, inv) => {
    const subtotal = inv.items.reduce((sum, item) => sum + item.amount, 0);
    const invoiceHST = subtotal * (inv.hstRate || 0);
    return acc + invoiceHST;
  }, 0);

  const totalExpensesBilled = expenses
    .filter(exp => exp.billedToInvoiceId && paidInvoiceIds.has(exp.billedToInvoiceId))
    .reduce((acc, exp) => acc + exp.cadAmount, 0);

  // Unbilled expenses are independent of invoice status
  const totalExpensesNotBilled = expenses
    .filter(exp => exp.isBillable && !exp.billedToInvoiceId)
    .reduce((acc, exp) => acc + exp.cadAmount, 0);

  // Chart income should also be based on paid invoices
  const monthlyData = paidInvoices.reduce((acc, invoice) => {
    const month = new Date(invoice.date).toLocaleString('default', { month: 'short' });
    if (!acc[month]) {
      acc[month] = { name: month, income: 0, expenses: 0 };
    }
    const invTotal = invoice.items.reduce((s, i) => s + i.amount, 0);
    acc[month].income += invTotal;
    return acc;
  }, {} as { [key: string]: { name: string, income: number, expenses: number } });

  // Chart expenses can show all expenses incurred
  expenses.forEach(expense => {
      const month = new Date(expense.date).toLocaleString('default', { month: 'short' });
      if (!monthlyData[month]) {
          monthlyData[month] = { name: month, income: 0, expenses: 0 };
      }
      monthlyData[month].expenses += expense.cadAmount;
  });

  const chartData = Object.values(monthlyData);

  return (
    <div>
      <h2 className="font-press-start text-xl sm:text-2xl text-yellow-700 mb-6">DASHBOARD</h2>
      
      <div className="bg-black p-2 sm:p-4 border-4 border-green-500 pixel-corners">
        <div className="bg-blue-500 p-4 sm:p-6 mb-4 sm:mb-8 text-center">
          <div className="border-2 border-blue-200 pixel-corners p-4 inline-block">
            <p className="font-bold uppercase tracking-wider text-base sm:text-lg md:text-xl text-fuchsia-500 drop-shadow-[2px_2px_0_rgba(0,0,0,0.3)]">Total Income</p>
            <p className="text-fuchsia-500 text-sm mb-2">(From Paid Invoices)</p>
            <p className="text-3xl sm:text-4xl md:text-5xl mt-2 font-bold text-green-500 font-mono">${totalIncomeSubtotal.toFixed(2)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 md:gap-6 mb-4 sm:mb-8 text-center">
          <div className="bg-black p-2 sm:p-4 border-2 border-green-500 pixel-corners">
            <p className="font-bold uppercase tracking-wider text-xs sm:text-sm md:text-base text-fuchsia-500">PDs Invoiced</p>
            <p className="text-xl sm:text-2xl md:text-3xl text-green-500 mt-2 font-mono">${totalPDsInvoiced.toFixed(2)}</p>
          </div>
          <div className="bg-black p-2 sm:p-4 border-2 border-green-500 pixel-corners">
            <p className="font-bold uppercase tracking-wider text-xs sm:text-sm md:text-base text-fuchsia-500">HST Invoiced</p>
            <p className="text-xl sm:text-2xl md:text-3xl text-green-500 mt-2 font-mono">${totalHSTInvoiced.toFixed(2)}</p>
          </div>
          <div className="bg-black p-2 sm:p-4 border-2 border-green-500 pixel-corners">
            <p className="font-bold uppercase tracking-wider text-xs sm:text-sm md:text-base text-fuchsia-500">Expenses Billed</p>
            <p className="text-xl sm:text-2xl md:text-3xl text-green-500 mt-2 font-mono">${totalExpensesBilled.toFixed(2)}</p>
          </div>
          <div className="bg-black p-2 sm:p-4 border-2 border-green-500 pixel-corners">
            <p className="font-bold uppercase tracking-wider text-xs sm:text-sm md:text-base text-fuchsia-500">Unbilled Expenses</p>
            <p className="text-xl sm:text-2xl md:text-3xl text-green-500 mt-2 font-mono">${totalExpensesNotBilled.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-black p-2 sm:p-4 border-2 border-green-500 pixel-corners h-64 sm:h-80 md:h-96">
          <h3 className="font-bold uppercase tracking-wider text-lg sm:text-xl text-fuchsia-500 mb-4">INCOME vs EXPENSE</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#00FF0033" />
              <XAxis dataKey="name" stroke="#22c55e" style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', fontWeight: 'bold' }} />
              <YAxis stroke="#22c55e" style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', fontWeight: 'bold' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#000',
                  border: '2px solid #22c55e',
                  fontFamily: 'IBM Plex Mono',
                  fontSize: '14px',
                }}
                cursor={{ fill: 'rgba(59, 130, 246, 0.2)' }}
              />
              <Legend wrapperStyle={{ fontFamily: 'IBM Plex Mono', fontSize: '14px', paddingTop: '20px' }} />
              <Bar dataKey="income" fill="#3b82f6" name="Income" />
              <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;
