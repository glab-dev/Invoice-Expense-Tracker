
import React, { useState, useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { Expense } from '../types';
import { extractReceiptData } from '../services/geminiService';
import { convertToCAD } from '../services/currencyService';

const printDocument = (content: string, title: string) => {
    const printWindow = window.open('', '_blank');
    printWindow?.document.write(`
        <html>
            <head>
                <title>${title}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    body { font-family: sans-serif; -webkit-print-color-adjust: exact; }
                    .printable-box { max-width: 800px; margin: auto; padding: 30px; font-size: 14px; line-height: 20px; color: #333; }
                    @media print {
                      .printable-box { box-shadow: none; border: 0; padding: 0; margin: 0; max-width: 100%; font-size: 12px; }
                      .receipt-image { max-height: 100px !important; display: block !important; border: 1px solid #eee; margin-top: 5px; }
                    }
                </style>
            </head>
            <body>
                <div class="printable-box">
                    ${content}
                </div>
            </body>
        </html>
    `);
    printWindow?.document.close();
    printWindow?.focus();
    setTimeout(() => {
        printWindow?.print();
        printWindow?.close();
    }, 250);
};


const ExpenseForm: React.FC<{ expense?: Expense | null, onSave: (expense: Omit<Expense, 'id'> | Expense) => void, onCancel: () => void }> = ({ expense, onSave, onCancel }) => {
  const { expenseCategories } = useAppContext();
  const [formData, setFormData] = useState<Omit<Expense, 'id' | 'cadAmount'>>({
    date: expense?.date || new Date().toISOString().split('T')[0],
    description: expense?.description || '',
    amount: expense?.amount || 0,
    currency: expense?.currency || 'CAD',
    category: expense?.category || expenseCategories[0] || 'Misc',
    receiptUrl: expense?.receiptUrl || '',
    isBillable: expense?.isBillable || false,
    billedToInvoiceId: expense?.billedToInvoiceId,
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      setFormData(prev => ({ ...prev, receiptUrl: reader.result as string}));
      const ocrResult = await extractReceiptData(base64String, file.type, expenseCategories);
      if (ocrResult) {
        setFormData(prev => ({
          ...prev,
          date: ocrResult.date,
          description: ocrResult.description,
          amount: ocrResult.amount,
          currency: ocrResult.currency,
          category: ocrResult.category,
        }));
      } else {
        alert('OCR failed. Please enter details manually.');
      }
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    const cadAmount = await convertToCAD(Number(formData.amount), formData.currency, formData.date);
    
    if (expense) {
      onSave({ ...formData, id: expense.id, amount: Number(formData.amount), cadAmount });
    } else {
      onSave({ ...formData, amount: Number(formData.amount), cadAmount });
    }
    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-lg">
      <div>
          <label className="block text-green-500 font-bold mb-1">Receipt Image</label>
          <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm text-white" />
          {isProcessing && <p className="text-yellow-300 animate-pulse mt-2">Processing...</p>}
      </div>
       {formData.receiptUrl && <img src={formData.receiptUrl} alt="Receipt preview" className="max-h-40 object-contain my-2 border-2 border-green-500" />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <label className="block text-green-500 font-bold mb-1">Date</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full bg-black text-white border-2 border-green-500 p-2 focus:outline-none focus:border-yellow-400" />
        </div>
         <div>
            <label className="block text-green-500 font-bold mb-1">Description</label>
            <input type="text" name="description" value={formData.description} onChange={handleChange} className="w-full bg-black text-white border-2 border-green-500 p-2 focus:outline-none focus:border-yellow-400" />
        </div>
      </div>
      
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
            <label className="block text-green-500 font-bold mb-1">Amount</label>
            <input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} className="w-full bg-black text-white border-2 border-green-500 p-2 focus:outline-none focus:border-yellow-400" />
        </div>
        <div>
            <label className="block text-green-500 font-bold mb-1">Currency</label>
            <input type="text" name="currency" value={formData.currency} onChange={handleChange} className="w-full bg-black text-white border-2 border-green-500 p-2 focus:outline-none focus:border-yellow-400" />
        </div>
        <div>
            <label className="block text-green-500 font-bold mb-1">Category</label>
            <select name="category" value={formData.category} onChange={handleChange} className="w-full bg-black text-white border-2 border-green-500 p-2 focus:outline-none focus:border-yellow-400">
                {expenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
        </div>
       </div>

        <div>
            <label className="flex items-center space-x-2 text-green-500 font-bold">
                <input type="checkbox" name="isBillable" checked={formData.isBillable} onChange={handleChange} className="w-5 h-5" />
                <span>Billable to Client</span>
            </label>
        </div>

      <div className="mt-6 flex justify-end gap-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isProcessing}>{isProcessing ? 'Saving...' : expense ? 'Update Expense' : 'Save Expense'}</Button>
      </div>
    </form>
  );
};

const ExpenseViewModal: React.FC<{ expense: Expense | null, onClose: () => void }> = ({ expense, onClose }) => {
    if (!expense) return null;

    return (
        <Modal isOpen={!!expense} onClose={onClose} title="View Expense">
            <div className="space-y-4">
                {expense.receiptUrl && <img src={expense.receiptUrl} alt="Receipt" className="w-full max-w-md mx-auto object-contain border-2 border-green-500" />}
                <div className="text-lg">
                    <p><span className="font-bold text-fuchsia-500">Description:</span> {expense.description}</p>
                    <p><span className="font-bold text-fuchsia-500">Date:</span> {expense.date}</p>
                    <p><span className="font-bold text-fuchsia-500">Amount:</span> {expense.amount.toFixed(2)} {expense.currency} (${expense.cadAmount.toFixed(2)} CAD)</p>
                    <p><span className="font-bold text-fuchsia-500">Category:</span> {expense.category}</p>
                    <p><span className="font-bold text-fuchsia-500">Billable:</span> {expense.isBillable ? 'Yes' : 'No'}</p>
                    {expense.billedToInvoiceId && <p><span className="font-bold text-fuchsia-500">Billed to Invoice:</span> Yes</p>}
                </div>
                <div className="flex justify-end pt-4">
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                </div>
            </div>
        </Modal>
    );
};

const ExportOptionsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onExport: (type: 'all' | 'billable' | 'non-billable') => void;
}> = ({ isOpen, onClose, onExport }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Export Expenses">
            <div className="space-y-4 text-center">
                <p>Which expenses would you like to export to PDF?</p>
                <div className="flex justify-center gap-4 pt-4">
                    <Button onClick={() => onExport('billable')}>Billable Only</Button>
                    <Button onClick={() => onExport('non-billable')}>Non-Billable</Button>
                    <Button variant="secondary" onClick={() => onExport('all')}>All Expenses</Button>
                </div>
            </div>
        </Modal>
    );
};


const ExpensesTab: React.FC = () => {
  const { expenses, addExpense, updateExpense } = useAppContext();
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [billableFilter, setBillableFilter] = useState<'all' | 'yes' | 'no'>('all');
  
  const openNewModal = () => {
    setEditingExpense(null);
    setIsFormModalOpen(true);
  };
  
  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setIsFormModalOpen(true);
  };
  
  const handleSave = (expenseData: Omit<Expense, 'id'> | Expense) => {
    if ('id' in expenseData) {
        updateExpense(expenseData);
    } else {
        addExpense(expenseData);
    }
    setIsFormModalOpen(false);
    setEditingExpense(null);
  };

  const handleExport = (type: 'all' | 'billable' | 'non-billable') => {
      let filteredExpenses = expenses;
      if (type === 'billable') {
          filteredExpenses = expenses.filter(e => e.isBillable);
      } else if (type === 'non-billable') {
          filteredExpenses = expenses.filter(e => !e.isBillable);
      }
      
      // FIX: Correctly type the initial value for `reduce` to ensure `grouped` is properly typed as Record<string, Expense[]>. This prevents a downstream error where `.map` is called on a value of type `unknown`.
      const grouped = filteredExpenses.reduce((acc, exp) => {
          const category = exp.category;
          if (!acc[category]) {
              acc[category] = [];
          }
          acc[category].push(exp);
          return acc;
      }, {} as Record<string, Expense[]>);

      const total = filteredExpenses.reduce((sum, exp) => sum + exp.cadAmount, 0);

      const content = `
          <h1 class="text-3xl font-bold mb-6">Expense Report (${type})</h1>
          ${Object.entries(grouped).map(([category, exps]) => `
              <div class="mb-6">
                  <h2 class="text-xl font-bold border-b-2 border-black pb-2 mb-2">${category}</h2>
                  ${exps.map(exp => `
                      <div class="flex justify-between items-start py-2 border-b">
                          <div>
                              <p><strong>${exp.description}</strong></p>
                              <p class="text-sm text-gray-600">${exp.date}</p>
                              <p class="text-sm">${exp.amount.toFixed(2)} ${exp.currency}</p>
                          </div>
                          <div class="text-right">
                              <p class="font-bold text-lg">$${exp.cadAmount.toFixed(2)} CAD</p>
                              ${exp.receiptUrl ? `<img src="${exp.receiptUrl}" alt="receipt" class="receipt-image max-h-24 w-auto ml-auto hidden" />` : ''}
                          </div>
                      </div>
                  `).join('')}
              </div>
          `).join('')}
          <div class="flex justify-end mt-8">
              <div class="w-60 text-right">
                  <div class="flex justify-between font-bold text-2xl border-t-2 border-black pt-2 mt-2">
                      <span>TOTAL:</span>
                      <span>$${total.toFixed(2)}</span>
                  </div>
              </div>
          </div>
      `;

      printDocument(content, `Expense Report - ${new Date().toLocaleDateString()}`);
      setIsExportModalOpen(false);
  };

  const filteredExpenses = expenses
    .filter(expense => {
        if (billableFilter === 'all') return true;
        if (billableFilter === 'yes') return expense.isBillable;
        if (billableFilter === 'no') return !expense.isBillable;
        return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // FIX: Correctly type the initial value for `reduce` to ensure `groupedExpenses` is properly typed as Record<string, Expense[]>.
  const groupedExpenses = filteredExpenses.reduce((acc, expense) => {
      const category = expense.category;
      if (!acc[category]) {
          acc[category] = [];
      }
      acc[category].push(expense);
      return acc;
  }, {} as Record<string, Expense[]>);

  const sortedCategories = Object.keys(groupedExpenses).sort();

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-y-4 mb-6">
        <h2 className="font-press-start text-xl sm:text-2xl text-yellow-700">EXPENSES</h2>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
            <div className="flex items-center">
                <label htmlFor="billable-filter" className="font-bold uppercase tracking-wider text-xs text-green-500 mr-2">BILLABLE:</label>
                <select
                    id="billable-filter"
                    value={billableFilter}
                    onChange={(e) => setBillableFilter(e.target.value as 'all' | 'yes' | 'no')}
                    className="bg-black text-white border-2 border-green-500 font-bold uppercase text-xs p-1 sm:p-2 pixel-corners focus:outline-none focus:border-yellow-400"
                >
                    <option value="all">All</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                </select>
            </div>
            <Button variant="secondary" onClick={() => setIsExportModalOpen(true)} className="text-xs !px-3 !py-2">Export</Button>
            <Button onClick={openNewModal} className="text-xs !px-3 !py-2">+ Add Expense</Button>
        </div>
      </div>

      <div className="bg-black border-2 border-green-500 pixel-corners">
        {/* Mobile View */}
        <div className="md:hidden">
          {sortedCategories.length > 0 ? (
            sortedCategories.map(category => (
              <div key={category}>
                <div className="p-2 text-fuchsia-500 font-press-start text-base border-y-2 border-green-500 font-bold bg-black/50">
                  {category}
                </div>
                {groupedExpenses[category].map(expense => (
                  <div key={expense.id} className="p-3 border-b border-green-800 last:border-b-0 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-bold">{expense.description}</p>
                        <p className="text-xs text-gray-400">{expense.date}</p>
                      </div>
                      <p className="font-bold text-lg text-yellow-400 whitespace-nowrap">$ {expense.cadAmount.toFixed(2)}</p>
                    </div>
                    <div className="flex justify-end">
                      <div className="flex gap-2">
                        <Button variant="secondary" className="text-xs !px-2 !py-1" onClick={() => setViewingExpense(expense)}>View</Button>
                        <Button variant="secondary" className="text-xs !px-2 !py-1" onClick={() => openEditModal(expense)}>Edit</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <p className="p-4 text-center text-gray-400">No expenses found for this filter.</p>
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b-2 border-green-500 text-fuchsia-500 font-bold uppercase tracking-wider text-sm">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Description</th>
                <th className="p-3">Amount (CAD)</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedCategories.length > 0 ? (
                  sortedCategories.map(category => (
                      <React.Fragment key={category}>
                      <tr className="bg-black/50">
                          <td colSpan={4} className="p-2 text-fuchsia-500 font-press-start text-base border-y-2 border-green-500 font-bold">
                          {category}
                          </td>
                      </tr>
                      {groupedExpenses[category].map(expense => (
                          <tr key={expense.id} className="border-b border-green-800 hover:bg-gray-900">
                          <td className="p-3">{expense.date}</td>
                          <td className="p-3">{expense.description}</td>
                          <td className="p-3">${expense.cadAmount.toFixed(2)}</td>
                          <td className="p-3 flex gap-2">
                              <Button variant="secondary" className="text-xs !px-2 !py-1" onClick={() => setViewingExpense(expense)}>View</Button>
                              <Button variant="secondary" className="text-xs !px-2 !py-1" onClick={() => openEditModal(expense)}>Edit</Button>
                          </td>
                          </tr>
                      ))}
                      </React.Fragment>
                  ))
              ) : (
                  <tr>
                      <td colSpan={4} className="p-4 text-center text-gray-400">No expenses found for this filter.</td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <Modal isOpen={isFormModalOpen} onClose={() => {setIsFormModalOpen(false); setEditingExpense(null);}} title={editingExpense ? 'Edit Expense' : 'Add New Expense'}>
        <ExpenseForm expense={editingExpense} onSave={handleSave} onCancel={() => {setIsFormModalOpen(false); setEditingExpense(null);}} />
      </Modal>

      <ExpenseViewModal expense={viewingExpense} onClose={() => setViewingExpense(null)} />
      
      <ExportOptionsModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} onExport={handleExport} />
    </div>
  );
};

export default ExpensesTab;
