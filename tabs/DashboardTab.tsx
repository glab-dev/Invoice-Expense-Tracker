import React from 'react';
import { useAppContext } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Company } from '../types';
import { CURRENCY_RATES } from '../constants';

const DashboardTab: React.FC = () => {
  const { invoices, expenses, companies } = useAppContext();
  const companyMap = new Map<string, Company>(companies.map(c => [c.id, c]));

  const paidInvoices = invoices.filter(inv => inv.status === 'Paid');

  const totalIncomeSubtotal = paidInvoices.reduce((acc, inv) => {
    const subtotal = inv.items.reduce((sum, item) => sum + item.amount, 0);
    return acc + subtotal;
  }, 0);

  const totalPDsInvoiced = paidInvoices.reduce((acc, inv) => {
    const company = companyMap.get(inv.companyId);
    const defaultPerDiem = company?.defaultPerDiem || 0;
    const invoicePDTotal = inv.items.reduce((sum, item) => {
        const rate = item.perDiemCurrency === 'USD' ? CURRENCY_RATES['USD'] : 1;
        return sum + (item.perDiemQuantity * defaultPerDiem * rate);
    }, 0);
    return acc + invoicePDTotal;
  }, 0);

  const totalHSTInvoiced = paidInvoices.reduce((acc, inv) => {
    const company = companyMap.get(inv.companyId);
    const defaultPerDiem = company?.defaultPerDiem || 0;
    const subtotal = inv.items.reduce((sum, item) => sum + item.amount, 0);
    
    const invoicePDTotal = inv.items.reduce((sum, item) => {
        const rate = item.perDiemCurrency === 'USD' ? CURRENCY_RATES['USD'] : 1;
        return sum + (item.perDiemQuantity * defaultPerDiem * rate);
    }, 0);

    const invoiceHST = (subtotal + invoicePDTotal) * (inv.hstRate || 0);
    return acc + invoiceHST;
  }, 0);

  // Filter out ANY expense that has been attached to an invoice ("billed"), regardless of invoice status.
  // This leaves only "Pending" (unbilled) and "Non-Billable" expenses.
  const expensesToDisplay = expenses.filter(exp => !exp.billedToInvoiceId);

  const totalExpenses = expensesToDisplay.reduce((acc, exp) => acc + exp.cadAmount, 0);

  const monthlyData = paidInvoices.reduce((acc, invoice) => {
    const month = new Date(invoice.date).toLocaleString('default', { month: 'short' });
    if (!acc[month]) {
      acc[month] = { name: month, income: 0, expenses: 0 };
    }
    const invTotal = invoice.items.reduce((s, i) => s + i.amount, 0);
    acc[month].income += invTotal;
    return acc;
  }, {} as { [key: string]: { name: string, income: number, expenses: number } });

  expensesToDisplay.forEach(expense => {
      const month = new Date(expense.date).toLocaleString('default', { month: 'short' });
      if (!monthlyData[month]) {
          monthlyData[month] = { name: month, income: 0, expenses: 0 };
      }
      monthlyData[month].expenses += expense.cadAmount;
  });

  const chartData = Object.values(monthlyData);

  const StatCard = ({ title, value, sub, color, textColor }: { title: string, value: string, sub?: string, color: string, textColor: string }) => (
    <div className={`bg-gray-700 p-4 border-[3px] border-black comic-shadow-sm relative overflow-hidden group`}>
        <div className={`absolute top-0 right-0 w-16 h-16 ${color} transform translate-x-8 -translate-y-8 rotate-45 border-l-2 border-b-2 border-black`}></div>
        <p className={`font-comic-title text-xl uppercase ${textColor}`}>{title}</p>
        {sub && <p className="text-gray-400 text-xs font-bold mb-2">{sub}</p>}
        <p className="text-3xl font-bold mt-1 text-white font-comic-title tracking-wider">{value}</p>
    </div>
  );

  return (
    <div>
      <h2 className="text-4xl text-white mb-8 transform -rotate-1 relative inline-block">
        <span className="bg-yellow-400 text-black px-2 shadow-[4px_4px_0_black] border-2 border-black">MISSION REPORT</span>
      </h2>
      
      <div className="space-y-8">
        <div className="bg-cyan-900 p-6 sm:p-8 border-[3px] border-black comic-shadow text-center relative">
          <div className="bg-gray-800 border-[3px] border-black p-6 inline-block transform rotate-1 shadow-[4px_4px_0_rgba(0,0,0,0.5)]">
            <p className="font-comic-title text-2xl text-white">Total Income</p>
            <p className="text-gray-400 font-bold text-sm mb-2">(From Paid Invoices)</p>
            <p className="text-5xl sm:text-6xl mt-2 font-bold text-green-400 font-comic-title drop-shadow-sm">${totalIncomeSubtotal.toFixed(2)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <StatCard title="PDs Invoiced" value={`$${totalPDsInvoiced.toFixed(2)}`} color="bg-yellow-400" textColor="text-yellow-400" />
          <StatCard title="HST Invoiced" value={`$${totalHSTInvoiced.toFixed(2)}`} color="bg-purple-400" textColor="text-purple-400" />
          <StatCard title="Expenses" value={`$${totalExpenses.toFixed(2)}`} color="bg-red-400" textColor="text-red-400" />
        </div>

        <div className="bg-gray-700 p-4 sm:p-6 border-[3px] border-black comic-shadow h-80 sm:h-96">
          <h3 className="font-comic-title text-2xl text-white mb-4">INCOME VS EXPENSES</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
              <XAxis dataKey="name" stroke="#e5e7eb" style={{ fontFamily: 'Comic Neue', fontSize: '14px', fontWeight: 'bold' }} />
              <YAxis stroke="#e5e7eb" style={{ fontFamily: 'Comic Neue', fontSize: '14px', fontWeight: 'bold' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '2px solid #000',
                  boxShadow: '4px 4px 0px 0px #000',
                  fontFamily: 'Comic Neue',
                  fontWeight: 'bold',
                  color: '#fff'
                }}
                itemStyle={{ color: '#fff' }}
                cursor={{ fill: 'rgba(253, 224, 71, 0.1)' }}
              />
              <Legend wrapperStyle={{ fontFamily: 'Bangers', fontSize: '18px', paddingTop: '20px', color: '#fff' }} />
              <Bar dataKey="income" fill="#3b82f6" name="Income" stroke="#000" strokeWidth={2} />
              <Bar dataKey="expenses" fill="#ef4444" name="Expenses" stroke="#000" strokeWidth={2} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;