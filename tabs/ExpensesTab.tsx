
import React, { useState, useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { Expense } from '../types';
import { extractReceiptData } from '../services/geminiService';
import { convertToCAD } from '../services/currencyService';

const inputClass = "w-full bg-gray-700 text-white border-2 border-black p-2 font-bold focus:outline-none focus:shadow-[4px_4px_0_rgba(255,255,255,0.2)] transition-shadow placeholder-gray-400";
const labelClass = "block text-white font-bold mb-1 uppercase tracking-wide text-sm";

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
                      .avoid-break { break-inside: avoid; }
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
      <div className="bg-gray-700 p-4 border-2 border-black border-dashed">
          <label className={labelClass}>Receipt (Image or PDF)</label>
          <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="text-sm text-gray-300" />
          {isProcessing && <p className="text-cyan-400 font-bold animate-pulse mt-2">Processing...</p>}
      </div>
       {formData.receiptUrl && (
           formData.receiptUrl.startsWith('data:application/pdf') ? (
               <div className="border-2 border-black bg-gray-200 p-4 text-black font-bold text-center my-2">PDF Document Selected</div>
           ) : (
               <img src={formData.receiptUrl} alt="Receipt preview" className="max-h-40 object-contain my-2 border-2 border-black shadow-md bg-gray-200 p-1" />
           )
       )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <label className={labelClass}>Date</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} className={inputClass} />
        </div>
         <div>
            <label className={labelClass}>Description</label>
            <input type="text" name="description" value={formData.description} onChange={handleChange} className={inputClass} />
        </div>
      </div>
      
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
            <label className={labelClass}>Amount</label>
            <input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} className={inputClass} />
        </div>
        <div>
            <label className={labelClass}>Currency</label>
            <input type="text" name="currency" value={formData.currency} onChange={handleChange} className={inputClass} />
        </div>
        <div>
            <label className={labelClass}>Category</label>
            <select name="category" value={formData.category} onChange={handleChange} className={inputClass}>
                {expenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
        </div>
       </div>

        <div className="p-2 border-2 border-transparent hover:bg-yellow-900 transition-colors rounded">
            <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" name="isBillable" checked={formData.isBillable} onChange={handleChange} className="w-5 h-5 accent-yellow-400" />
                <span className="font-bold text-white uppercase">Billable to Client</span>
            </label>
        </div>

      <div className="mt-6 flex justify-end gap-4 border-t-2 border-black pt-4">
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
                {expense.receiptUrl && (
                    expense.receiptUrl.startsWith('data:application/pdf') ? (
                        <div className="w-full max-w-md mx-auto border-2 border-black shadow-[4px_4px_0_black] bg-white h-64 flex items-center justify-center">
                            <iframe src={expense.receiptUrl} className="w-full h-full" title="Receipt PDF"></iframe>
                        </div>
                    ) : (
                        <img src={expense.receiptUrl} alt="Receipt" className="w-full max-w-md mx-auto object-contain border-2 border-black shadow-[4px_4px_0_black]" />
                    )
                )}
                <div className="text-lg bg-gray-700 p-4 border-2 border-black">
                    <p className="border-b border-gray-600 pb-1 mb-1"><span className="font-bold text-cyan-400 uppercase">Description:</span> {expense.description}</p>
                    <p className="border-b border-gray-600 pb-1 mb-1"><span className="font-bold text-cyan-400 uppercase">Date:</span> {expense.date}</p>
                    <p className="border-b border-gray-600 pb-1 mb-1"><span className="font-bold text-cyan-400 uppercase">Amount:</span> {expense.amount.toFixed(2)} {expense.currency} (${expense.cadAmount.toFixed(2)} CAD)</p>
                    <p className="border-b border-gray-600 pb-1 mb-1"><span className="font-bold text-cyan-400 uppercase">Category:</span> {expense.category}</p>
                    <p><span className="font-bold text-cyan-400 uppercase">Billable:</span> {expense.isBillable ? 'Yes' : 'No'}</p>
                    {expense.billedToInvoiceId && <p className="mt-2 text-green-400 font-bold"><span className="uppercase">Billed to Invoice:</span> Yes</p>}
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
                    <Button onClick={() => onExport('billable')}>Billable</Button>
                    <Button onClick={() => onExport('non-billable')}>Non-Billable</Button>
                    <Button variant="secondary" onClick={() => onExport('all')}>All</Button>
                </div>
            </div>
        </Modal>
    );
};


const ExpensesTab: React.FC = () => {
  const { expenses, addExpense, updateExpense, deleteExpense, deleteAllExpenses } = useAppContext();
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

  const handleDeleteExpense = (id: string) => {
      if (window.confirm("Are you sure you want to delete this expense? This action cannot be undone.")) {
          deleteExpense(id);
      }
  };

  const handleDeleteAll = () => {
      if (window.confirm("WARNING: You are about to DELETE ALL EXPENSES. This cannot be undone. Are you absolutely sure?")) {
          deleteAllExpenses();
      }
  };

  const handleExport = (type: 'all' | 'billable' | 'non-billable') => {
      let filteredExpenses = expenses;
      if (type === 'billable') {
          filteredExpenses = expenses.filter(e => e.isBillable);
      } else if (type === 'non-billable') {
          filteredExpenses = expenses.filter(e => !e.isBillable);
      }
      
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
          ${Object.entries(grouped).map(([category, exps]: [string, Expense[]]) => {
              const categoryTotal = exps.reduce((sum, e) => sum + e.cadAmount, 0);
              return `
              <div class="mb-6 avoid-break">
                  <div class="flex justify-between items-end border-b-2 border-black pb-1 mb-2">
                      <h2 class="text-xl font-bold uppercase">${category}</h2>
                      <span class="font-bold text-lg">$${categoryTotal.toFixed(2)} CAD</span>
                  </div>
                  ${exps.map(exp => `
                      <div class="flex items-center justify-between py-2 border-b border-gray-200 text-sm">
                          <div class="flex items-center gap-4 flex-1">
                              <span class="font-mono text-gray-600 whitespace-nowrap">${exp.date}</span>
                              <span class="font-bold truncate pr-4">${exp.description}</span>
                          </div>
                          <div class="flex items-center gap-4 whitespace-nowrap">
                              ${exp.currency !== 'CAD' ? `<span class="text-gray-500 text-xs">${exp.amount.toFixed(2)} ${exp.currency}</span>` : ''}
                              <span class="font-bold w-24 text-right">$${exp.cadAmount.toFixed(2)} CAD</span>
                              <div class="w-6 flex justify-center">
                                  ${exp.receiptUrl ? (
                                      exp.receiptUrl.startsWith('data:application/pdf') ? 
                                      '<span class="text-[10px] border border-gray-400 px-1 rounded text-gray-500">PDF</span>' :
                                      `<img src="${exp.receiptUrl}" class="h-6 w-auto object-contain border border-gray-200" />`
                                  ) : ''}
                              </div>
                          </div>
                      </div>
                  `).join('')}
              </div>
          `}).join('')}
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
         <h2 className="text-3xl sm:text-4xl transform -rotate-1 relative">
            <span className="bg-red-600 text-black px-2 border-2 border-black shadow-[4px_4px_0_black]">EXPENSES</span>
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
            <div className="flex items-center">
                <label htmlFor="billable-filter" className="font-bold uppercase tracking-wider text-xs mr-2 bg-red-600 text-black px-1 border border-black">Filter:</label>
                <select
                    id="billable-filter"
                    value={billableFilter}
                    onChange={(e) => setBillableFilter(e.target.value as 'all' | 'yes' | 'no')}
                    className="bg-gray-700 text-white border-2 border-black font-bold uppercase text-xs p-1 sm:p-2 focus:outline-none focus:shadow-[2px_2px_0_white]"
                >
                    <option value="all">All</option>
                    <option value="yes">Billable</option>
                    <option value="no">Non-Billable</option>
                </select>
            </div>
            {expenses.length > 0 && <Button variant="danger" onClick={handleDeleteAll} className="text-sm !px-4 !py-2">Delete All</Button>}
            <Button variant="secondary" onClick={() => setIsExportModalOpen(true)} className="text-sm !px-4 !py-2">Export</Button>
            <Button onClick={openNewModal} className="text-sm !px-4 !py-2">+ Add Expense</Button>
        </div>
      </div>

      <div className="bg-gray-700 border-[3px] border-black comic-shadow p-2">
        {/* Mobile View */}
        <div className="md:hidden space-y-4">
          {sortedCategories.length > 0 ? (
            sortedCategories.map(category => (
              <div key={category} className="border-2 border-black">
                <div className="p-2 text-black bg-red-600 border-b-2 border-black font-bold uppercase tracking-wider">
                  {category}
                </div>
                {groupedExpenses[category].map(expense => (
                  <div key={expense.id} className="p-3 border-b border-black last:border-b-0 space-y-2 bg-gray-800">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-bold text-lg leading-tight text-white">{expense.description}</p>
                        <p className="text-xs text-gray-400 font-bold">{expense.date}</p>
                      </div>
                      <p className="font-comic-title text-xl text-white whitespace-nowrap">$ {expense.cadAmount.toFixed(2)}</p>
                    </div>
                    <div className="flex justify-end">
                      <div className="flex gap-2">
                        <Button variant="secondary" className="text-xs !px-2 !py-1 !border" onClick={() => setViewingExpense(expense)}>View</Button>
                        <Button variant="secondary" className="text-xs !px-2 !py-1 !border" onClick={() => openEditModal(expense)}>Edit</Button>
                        <Button variant="danger" className="text-xs !px-2 !py-1 !border" onClick={() => handleDeleteExpense(expense.id)}>Del</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <p className="p-4 text-center text-gray-400 italic">No expenses found for this filter.</p>
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-white">
            <thead className="border-b-[3px] border-black bg-gray-800 text-white font-comic-title text-lg uppercase tracking-wider">
              <tr>
                <th className="p-3 border-r-2 border-black">Date</th>
                <th className="p-3 border-r-2 border-black">Description</th>
                <th className="p-3 border-r-2 border-black">Amount (CAD)</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedCategories.length > 0 ? (
                  sortedCategories.map(category => (
                      <React.Fragment key={category}>
                      <tr>
                          <td colSpan={4} className="p-2 text-black bg-red-600 border-y-2 border-black font-bold uppercase tracking-wider">
                          {category}
                          </td>
                      </tr>
                      {groupedExpenses[category].map(expense => (
                          <tr key={expense.id} className="border-b border-black hover:bg-gray-600 transition-colors">
                          <td className="p-3 border-r-2 border-black font-bold text-gray-300">{expense.date}</td>
                          <td className="p-3 border-r-2 border-black font-bold">{expense.description}</td>
                          <td className="p-3 border-r-2 border-black font-comic-title text-white text-lg">${expense.cadAmount.toFixed(2)}</td>
                          <td className="p-3 flex gap-2">
                              <Button variant="secondary" className="text-xs !px-2 !py-1 !border" onClick={() => setViewingExpense(expense)}>View</Button>
                              <Button variant="secondary" className="text-xs !px-2 !py-1 !border" onClick={() => openEditModal(expense)}>Edit</Button>
                              <Button variant="danger" className="text-xs !px-2 !py-1 !border" onClick={() => handleDeleteExpense(expense.id)}>Del</Button>
                          </td>
                          </tr>
                      ))}
                      </React.Fragment>
                  ))
              ) : (
                  <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-400 italic">No expenses found for this filter.</td>
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
