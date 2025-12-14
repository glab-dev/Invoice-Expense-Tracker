
import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { Invoice, InvoiceItem, Company, Expense, UserProfile } from '../types';
import { extractInvoiceData, InvoiceOcrResult } from '../services/geminiService';
import { convertToCAD } from '../services/currencyService';

type NewInvoiceData = Omit<Invoice, 'id' | 'invoiceNumber'>;
type NewInvoiceItemData = Omit<InvoiceItem, 'id' | 'amount'>;

const InvoiceForm: React.FC<{
    invoice?: Invoice | null;
    onSave: (data: Omit<Invoice, 'id' | 'invoiceNumber'> | Invoice) => void;
    onCancel: () => void;
}> = ({ invoice, onSave, onCancel }) => {
    const { companies, expenses, expenseCategories } = useAppContext();
    const [companyId, setCompanyId] = useState<string>(invoice?.companyId || companies[0]?.id || '');
    const [date, setDate] = useState(invoice?.date || new Date().toISOString().split('T')[0]);
    
    const initialItems = invoice?.items.map(item => ({...item})) || 
        [{ startDate: new Date().toISOString().split('T')[0], endDate: null, description: '', quantity: 1, unit: 'Day' as const, rate: companies.find(c => c.id === (invoice?.companyId || companies[0]?.id))?.defaultRate || 0, approver: '', perDiemQuantity: 0 }];

    const [items, setItems] = useState<NewInvoiceItemData[]>(initialItems);
    const [notes, setNotes] = useState(invoice?.notes || '');
    const [attachedExpenseIds, setAttachedExpenseIds] = useState<string[]>(invoice?.attachedExpenseIds || []);
    
    const availableExpenses = expenses.filter(exp => exp.isBillable && (!exp.billedToInvoiceId || exp.billedToInvoiceId === invoice?.id));

    useEffect(() => {
        const company = companies.find(c => c.id === companyId);
        if (!company) return;

        const newItems = items.map(item => {
            const newItem = { ...item };
            if (item.unit === 'Day') {
                newItem.rate = company.defaultRate;
            } else if (item.unit === 'Half-Day') {
                newItem.rate = company.defaultRate / 2;
            } else if (item.unit === 'Hourly') {
                newItem.rate = company.defaultRate / 10;
            }
            return newItem;
        });
        setItems(newItems);
    }, [companyId, companies]);

    const handleItemChange = (index: number, field: keyof NewInvoiceItemData, value: string | number | null) => {
        const newItems = [...items];
        const currentItem = { ...newItems[index] };
        const company = companies.find(c => c.id === companyId);

        (currentItem as any)[field] = value;
        
        if ((field === 'startDate' || field === 'endDate') && (currentItem.unit === 'Day' || currentItem.unit === 'Half-Day')) {
            const { startDate, endDate } = currentItem;
            if (startDate && endDate && new Date(endDate) >= new Date(startDate)) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                const diffTime = Math.abs(end.getTime() - start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                currentItem.quantity = diffDays > 0 ? diffDays : 1;
            } else {
                currentItem.quantity = 1;
            }
        }
        
        if (field === 'unit' && company) {
            switch(value) {
                case 'Day': currentItem.rate = company.defaultRate; break;
                case 'Half-Day': currentItem.rate = company.defaultRate / 2; break;
                case 'Hourly': currentItem.rate = company.defaultRate / 10; break;
            }
        }
        newItems[index] = currentItem;
        setItems(newItems);
    };

    const addItem = () => setItems([...items, { startDate: new Date().toISOString().split('T')[0], endDate: null, description: '', quantity: 1, unit: 'Day', rate: companies.find(c => c.id === companyId)?.defaultRate || 0, approver: '', perDiemQuantity: 0 }]);
    const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

    const handleExpenseToggle = (expId: string) => {
        setAttachedExpenseIds(prev => prev.includes(expId) ? prev.filter(id => id !== expId) : [...prev, expId]);
    }

    const handleSubmit = () => {
        const invoiceData = {
            companyId,
            date,
            items: items.map(item => ({
                ...item,
                id: (item as InvoiceItem).id || `item-${Date.now()}-${Math.random()}`,
                amount: (item.quantity || 0) * (item.rate || 0),
                perDiemQuantity: Number(item.perDiemQuantity) || 0,
            })),
            attachedExpenseIds: attachedExpenseIds,
            notes,
            status: invoice?.status || 'Draft',
            hstRate: invoice?.hstRate || 0.13,
        };
        
        if (invoice) {
            onSave({ ...invoiceData, id: invoice.id, invoiceNumber: invoice.invoiceNumber });
        } else {
            onSave(invoiceData);
        }
    }

    return (
        <div className="space-y-6 text-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-green-500 font-bold mb-1">Company</label>
                    <select value={companyId} onChange={e => setCompanyId(e.target.value)} className="w-full bg-black text-white border-2 border-green-500 p-2 focus:outline-none focus:border-yellow-400">
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-green-500 font-bold mb-1">Invoice Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-black text-white border-2 border-green-500 p-2 focus:outline-none focus:border-yellow-400" />
                </div>
            </div>
            
            <div>
                <h3 className="text-fuchsia-500 font-bold mb-2 border-b-2 border-fuchsia-700 pb-1">Line Items</h3>
                 {items.map((item, index) => {
                     const amount = (item.quantity || 0) * (item.rate || 0);
                     const isQtyAutoCalculated = !!(item.startDate && item.endDate && (item.unit === 'Day' || item.unit === 'Half-Day'));
                     return (
                        <div key={index} className="border-2 border-green-500 p-3 mb-3 pixel-corners space-y-3 relative">
                            <button onClick={() => removeItem(index)} className="absolute top-1 right-2 text-red-500 font-bold text-2xl hover:text-red-400">×</button>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                <div className="sm:col-span-1">
                                    <label className="block text-green-500 text-sm font-bold mb-1">Start Date</label>
                                    <input type="date" value={item.startDate} onChange={e => handleItemChange(index, 'startDate', e.target.value)} className="bg-black text-white border-2 border-green-500 p-1 text-sm w-full focus:outline-none focus:border-yellow-400" />
                                </div>
                                <div className="sm:col-span-1">
                                    <label className="block text-green-500 text-sm font-bold mb-1">End Date</label>
                                    <input type="date" value={item.endDate || ''} onChange={e => handleItemChange(index, 'endDate', e.target.value || null)} className="bg-black text-white border-2 border-green-500 p-1 text-sm w-full focus:outline-none focus:border-yellow-400" />
                                </div>
                                <div className="col-span-1 sm:col-span-2 md:col-span-4 lg:col-span-3">
                                    <label className="block text-green-500 text-sm font-bold mb-1">Description</label>
                                    <input type="text" placeholder="Description" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} className="bg-black text-white border-2 border-green-500 p-1 text-sm w-full focus:outline-none focus:border-yellow-400" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                <div>
                                    <label className="block text-green-500 text-sm font-bold mb-1">Qty</label>
                                    <input type="number" placeholder="Qty" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value))} disabled={isQtyAutoCalculated} className={`w-full border-2 border-green-500 p-1 text-sm ${isQtyAutoCalculated ? 'bg-gray-900 text-gray-500' : 'bg-black text-white focus:outline-none focus:border-yellow-400'}`} />
                                </div>
                                <div>
                                    <label className="block text-green-500 text-sm font-bold mb-1">Unit</label>
                                    <select value={item.unit} onChange={e => handleItemChange(index, 'unit', e.target.value as 'Day'|'Half-Day'|'Hourly')} className="w-full bg-black text-white border-2 border-green-500 p-1 text-sm h-[34px] focus:outline-none focus:border-yellow-400">
                                        <option value="Day">Day</option><option value="Half-Day">Half-Day</option><option value="Hourly">Hourly</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-green-500 text-sm font-bold mb-1">Rate</label>
                                    <input type="number" placeholder="Rate" value={item.rate} onChange={e => handleItemChange(index, 'rate', parseFloat(e.target.value))} className="w-full bg-black text-white border-2 border-green-500 p-1 text-sm focus:outline-none focus:border-yellow-400" />
                                </div>
                                <div>
                                    <label className="block text-gray-500 text-sm font-bold mb-1">Amount</label>
                                    <input type="number" placeholder="Total" value={amount.toFixed(2)} disabled className="w-full bg-gray-900 border-2 border-green-900 p-1 text-sm text-gray-500" />
                                </div>
                                <div>
                                    <label className="block text-green-500 text-sm font-bold mb-1">PD (days)</label>
                                    <input type="number" placeholder="PD (days)" value={item.perDiemQuantity} onChange={e => handleItemChange(index, 'perDiemQuantity', parseInt(e.target.value, 10))} className="w-full bg-black text-white border-2 border-green-500 p-1 text-sm focus:outline-none focus:border-yellow-400" />
                                </div>
                                <div className="col-span-2 lg:col-span-1">
                                    <label className="block text-green-500 text-sm font-bold mb-1">Approver</label>
                                    <input type="text" placeholder="Name" value={item.approver} onChange={e => handleItemChange(index, 'approver', e.target.value)} className="w-full bg-black text-white border-2 border-green-500 p-1 text-sm focus:outline-none focus:border-yellow-400" />
                                </div>
                            </div>
                        </div>
                )})}
                <Button variant="secondary" onClick={addItem} className="text-xs !py-1 mt-2">+ Add Item</Button>
            </div>

            <div>
                <h3 className="text-fuchsia-500 font-bold mb-2 border-b-2 border-fuchsia-700 pb-1">Attach Expenses</h3>
                <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                    {availableExpenses.length > 0 ? availableExpenses.map(exp => (
                        <label key={exp.id} className="flex items-center gap-2 p-2 bg-black text-white border-2 border-green-500 text-sm cursor-pointer hover:bg-gray-900">
                            <input type="checkbox" checked={attachedExpenseIds.includes(exp.id)} onChange={() => handleExpenseToggle(exp.id)} className="w-4 h-4" />
                            <span>{exp.date} - {exp.description} (${exp.cadAmount.toFixed(2)})</span>
                        </label>
                    )) : <p className="text-sm text-gray-400">No billable expenses available.</p>}
                </div>
            </div>

            <div>
                <label className="block text-green-500 font-bold mb-1">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-black text-white border-2 border-green-500 p-2 focus:outline-none focus:border-yellow-400 text-base" />
            </div>
            <div className="mt-6 flex justify-end gap-4">
                <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button onClick={handleSubmit}>{invoice ? 'Update Invoice' : 'Save Invoice'}</Button>
            </div>
        </div>
    )
}

const getInvoicePrintableContent = (invoice: Invoice, company: Company | undefined, attachedExpenses: Expense[], userProfile: UserProfile): string => {
    const toNum = (val: any): number => Number(val) || 0;
    
    const defaultPerDiem = toNum(company?.defaultPerDiem);
    const subtotal = invoice.items.reduce((sum, item) => sum + toNum(item.amount), 0);
    const hst = subtotal * toNum(invoice.hstRate);
    const perDiemsTotal = invoice.items.reduce((sum, item) => sum + (toNum(item.perDiemQuantity) * defaultPerDiem), 0);
    const expensesTotal = attachedExpenses.reduce((sum, exp) => sum + toNum(exp.cadAmount), 0);
    const grandTotal = subtotal + hst + perDiemsTotal + expensesTotal;

    const itemsHtml = invoice.items.map(item => {
        const itemAmount = toNum(item.amount);
        const perDiemAmount = toNum(item.perDiemQuantity) * defaultPerDiem;
        const lineTotal = itemAmount + perDiemAmount;
        const dateDisplay = item.endDate ? `${item.startDate} to ${item.endDate}` : item.startDate;
        
        return `
            <tr class="border-b">
                <td class="py-2 px-1">${dateDisplay}</td>
                <td class="py-2 px-1">${item.description}</td>
                <td class="py-2 px-1 text-center">${toNum(item.quantity)} ${item.unit}</td>
                <td class="py-2 px-1 text-right">$${toNum(item.rate).toFixed(2)}</td>
                <td class="py-2 px-1 text-center">${toNum(item.perDiemQuantity)}</td>
                <td class="py-2 px-1 text-right">$${toNum(perDiemAmount).toFixed(2)}</td>
                <td class="py-2 px-1 text-right font-bold">$${toNum(lineTotal).toFixed(2)}</td>
                <td class="py-2 px-1">${item.approver}</td>
            </tr>
        `;
    }).join('');

    const expensesHtml = attachedExpenses.length > 0 ? `
      <div class="mt-8">
            <h3 class="font-bold text-lg mb-2 border-b-2 border-black pb-1">Expenses</h3>
            <table class="w-full text-left" style="max-width: 400px;">
                <thead><tr>
                    <th class="pb-1">Description</th><th class="pb-1 text-right">Amount</th>
                </tr></thead>
                <tbody>
                    ${attachedExpenses.map(exp => `
                        <tr><td>${exp.description} (${exp.date})</td><td class="text-right">$${toNum(exp.cadAmount).toFixed(2)}</td></tr>
                    `).join('')}
                    <tr class="font-bold border-t"><td class="pt-1">Total Expenses</td><td class="text-right pt-1">$${toNum(expensesTotal).toFixed(2)}</td></tr>
                </tbody>
            </table>
        </div>
    ` : '';
    
    return `
        <div class="p-8 font-sans">
            <div class="flex justify-between items-start mb-8">
                <div>
                    <h1 class="text-4xl font-bold">INVOICE</h1>
                    <p class="text-gray-500">Invoice # ${String(invoice.invoiceNumber).padStart(3, '0')}</p>
                </div>
                <div class="text-right">
                    <h2 class="text-xl font-bold">${company?.name || 'N/A'}</h2>
                    <p class="whitespace-pre-line">${company?.address || ''}</p>
                </div>
            </div>
            <div class="flex justify-between items-start mb-12">
                <div>
                    <p><strong>Date:</strong> ${invoice.date}</p>
                </div>
                <div class="text-right">
                    <p class="font-bold">Pay to:</p>
                    <p class="whitespace-pre-line">${userProfile.name}<br/>${userProfile.address}</p>
                </div>
            </div>
            
            <table class="w-full text-left mb-8">
                <thead>
                    <tr class="border-b-2 border-black">
                        <th class="py-2 px-1">Dates</th>
                        <th class="py-2 px-1">Description</th>
                        <th class="py-2 px-1 text-center">Quantity</th>
                        <th class="py-2 px-1 text-right">Rate</th>
                        <th class="py-2 px-1 text-center">PD Qty</th>
                        <th class="py-2 px-1 text-right">PD Amount</th>
                        <th class="py-2 px-1 text-right">Line Total</th>
                        <th class="py-2 px-1">Approver</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
            </table>

            <div class="flex justify-between items-start">
                <div>
                    ${expensesHtml}
                    ${invoice.notes ? `<div class="mt-8"><h3 class="font-bold">Notes</h3><p class="italic text-gray-700">${invoice.notes}</p></div>` : ''}
                </div>
                <div class="w-80 space-y-2 text-right">
                    <div class="flex justify-between"><span class="font-bold">Subtotal:</span><span>$${toNum(subtotal).toFixed(2)}</span></div>
                    <div class="flex justify-between"><span class="font-bold">GST/HST (${(toNum(invoice.hstRate) * 100).toFixed(0)}%):</span><span>$${toNum(hst).toFixed(2)}</span></div>
                    <div class="flex justify-between"><span class="font-bold">Per Diems:</span><span>$${toNum(perDiemsTotal).toFixed(2)}</span></div>
                    <div class="flex justify-between border-b pb-2"><span class="font-bold">Expenses:</span><span>$${toNum(expensesTotal).toFixed(2)}</span></div>
                    <div class="flex justify-between font-bold text-2xl pt-2"><span class="font-bold">TOTAL:</span><span>$${toNum(grandTotal).toFixed(2)}</span></div>
                </div>
            </div>
        </div>
    `;
};


const InvoiceViewModal: React.FC<{ invoice: Invoice | null, onClose: () => void, onPrint: () => void }> = ({ invoice, onClose, onPrint }) => {
    const { getCompany, expenses } = useAppContext();
    if (!invoice) return null;

    const company = getCompany(invoice.companyId);
    const attachedExpenses = expenses.filter(exp => invoice.attachedExpenseIds.includes(exp.id));
    
    const defaultPerDiem = company?.defaultPerDiem || 0;
    const subtotal = invoice.items.reduce((sum, item) => sum + item.amount, 0);
    const hst = subtotal * (invoice.hstRate || 0);
    const perDiemsTotal = invoice.items.reduce((sum, item) => sum + (item.perDiemQuantity * defaultPerDiem), 0);
    const expensesTotal = attachedExpenses.reduce((sum, exp) => sum + exp.cadAmount, 0);
    const grandTotal = subtotal + hst + perDiemsTotal + expensesTotal;

    return (
        <Modal isOpen={!!invoice} onClose={onClose} title={`Invoice #${String(invoice.invoiceNumber).padStart(3, '0')}`} maxWidth="max-w-5xl">
            <div className="space-y-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-bold text-fuchsia-500">Billed To:</p>
                        <p className="text-xl font-bold">{company?.name}</p>
                        <p className="whitespace-pre-line">{company?.address}</p>
                    </div>
                    <div className="text-right">
                        <p><span className="font-bold text-fuchsia-500">Date:</span> {invoice.date}</p>
                        <p><span className="font-bold text-fuchsia-500">Status:</span> {invoice.status}</p>
                    </div>
                </div>

                <div>
                    <h3 className="text-fuchsia-500 font-bold mb-2 border-b-2 border-fuchsia-700 pb-1">Line Items</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm min-w-[600px]">
                          <thead>
                              <tr className="border-b border-fuchsia-700">
                                  <th className="p-1">Dates</th><th className="p-1">Description</th><th className="p-1">Qty</th><th className="p-1">Rate</th><th className="p-1">PD Qty</th><th className="p-1 text-right">PD Amt</th><th className="p-1 text-right">Total</th><th className="p-1">Approver</th>
                              </tr>
                          </thead>
                          <tbody>
                              {invoice.items.map(item => {
                                  const perDiemAmount = item.perDiemQuantity * defaultPerDiem;
                                  const lineTotal = item.amount + perDiemAmount;
                                  const dateDisplay = item.endDate ? `${item.startDate} to ${item.endDate}` : item.startDate;
                                  return (
                                  <tr key={item.id} className="border-b border-green-800">
                                      <td className="p-1">{dateDisplay}</td><td className="p-1">{item.description}</td><td className="p-1">{item.quantity} {item.unit}</td><td className="p-1">$${item.rate.toFixed(2)}</td><td className="p-1">{item.perDiemQuantity}</td><td className="p-1 text-right">$${perDiemAmount.toFixed(2)}</td><td className="p-1 text-right font-bold">${lineTotal.toFixed(2)}</td><td className="p-1">{item.approver}</td>
                                  </tr>
                              )})}
                          </tbody>
                      </table>
                    </div>
                </div>

                {attachedExpenses.length > 0 && (
                    <div>
                        <h3 className="text-fuchsia-500 font-bold mb-2 border-b-2 border-fuchsia-700 pb-1">Attached Expenses</h3>
                        <div className="space-y-1">
                            {attachedExpenses.map(exp => <p key={exp.id} className="text-sm flex justify-between"><span>{exp.date} - {exp.description}</span> <span>$${exp.cadAmount.toFixed(2)}</span></p>)}
                        </div>
                    </div>
                )}
                
                <div className="flex justify-end">
                    <div className="w-64 space-y-1 text-lg">
                        <div className="flex justify-between"><span className="font-bold text-fuchsia-500">Subtotal:</span><span>$${subtotal.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="font-bold text-fuchsia-500">HST (13%):</span><span>$${hst.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="font-bold text-fuchsia-500">Per Diems:</span><span>$${perDiemsTotal.toFixed(2)}</span></div>
                        <div className="flex justify-between border-b border-fuchsia-700 pb-1"><span className="font-bold text-fuchsia-500">Expenses:</span><span>$${expensesTotal.toFixed(2)}</span></div>
                        <div className="flex justify-between font-bold text-xl pt-1"><span className="font-bold text-yellow-300">Total:</span><span className="text-yellow-300">$${grandTotal.toFixed(2)}</span></div>
                    </div>
                </div>

                {invoice.notes && <div><p className="font-bold text-fuchsia-500">Notes:</p><p className="text-sm italic">{invoice.notes}</p></div>}

                <div className="flex justify-end gap-4 pt-4">
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                    <Button onClick={onPrint}>Download PDF</Button>
                </div>
            </div>
        </Modal>
    );
}

const ImportInvoiceModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
}> = ({ isOpen, onClose }) => {
    const { companies, addCompany, importInvoiceWithExpenses, expenseCategories } = useAppContext();
    const [isProcessing, setIsProcessing] = useState(false);
    const [fileName, setFileName] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setFileName(file.name);
    }

    const handleImport = async () => {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
            alert('Please select a file to import.');
            return;
        }

        setIsProcessing(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                const base64String = (reader.result as string).split(',')[1];
                const ocrResult = await extractInvoiceData(base64String, file.type);
                if (!ocrResult) throw new Error("AI could not read the invoice.");

                let company = companies.find(c => c.name.toLowerCase() === ocrResult.companyName.toLowerCase());
                if (!company) {
                    const newCompany = addCompany({
                        name: ocrResult.companyName,
                        address: ocrResult.companyAddress,
                        defaultRate: ocrResult.items[0]?.amount / ocrResult.items[0]?.quantity || 500,
                        defaultPerDiem: 50,
                    });
                    company = newCompany;
                }
                
                const newItems = ocrResult.items.map(item => ({
                    startDate: item.start_date,
                    endDate: item.end_date || null,
                    description: item.description,
                    quantity: item.quantity,
                    unit: item.rate_description.toLowerCase().includes('day') ? 'Day' as const : 'Hourly' as const,
                    rate: item.amount / item.quantity,
                    amount: item.amount,
                    approver: '',
                    perDiemQuantity: 0, 
                    id: '',
                }));

                if (ocrResult.perDiemQuantity > 0 && newItems.length > 0) {
                    const mainItem = newItems.sort((a, b) => b.quantity - a.quantity)[0];
                    mainItem.perDiemQuantity = ocrResult.perDiemQuantity;
                }

                const newExpenses = await Promise.all(
                    ocrResult.expenses.map(async exp => ({
                        date: exp.date,
                        description: exp.description,
                        amount: exp.amount,
                        currency: 'CAD',
                        cadAmount: await convertToCAD(exp.amount, 'CAD', exp.date),
                        category: expenseCategories.includes('Misc') ? 'Misc' : expenseCategories[0],
                        isBillable: true,
                    }))
                );

                const newInvoiceData = {
                    companyId: company.id,
                    date: ocrResult.date,
                    items: newItems,
                    notes: ocrResult.notes || '',
                    status: 'Draft' as const,
                    hstRate: 0.13,
                };
                
                importInvoiceWithExpenses(newInvoiceData, newExpenses);
                onClose();

            } catch (err: any) {
                alert(`Import failed: ${err.message}`);
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Import Invoice">
            <div className="space-y-4">
                <p>Select a PDF or image file of an invoice to automatically import its data.</p>
                <div>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf,image/*" className="text-sm text-white" />
                    {fileName && <p className="text-xs mt-1 text-gray-400">Selected: {fileName}</p>}
                </div>
                {isProcessing && <p className="text-yellow-300 animate-pulse">Processing with AI... This may take a moment.</p>}
                <div className="flex justify-end gap-4 pt-4">
                    <Button variant="secondary" onClick={onClose} disabled={isProcessing}>Cancel</Button>
                    <Button onClick={handleImport} disabled={isProcessing}>{isProcessing ? 'Importing...' : 'Import'}</Button>
                </div>
            </div>
        </Modal>
    );
};


const InvoicesTab: React.FC = () => {
    const { invoices, updateInvoice, getCompany, expenses, addInvoice, userProfile } = useAppContext();
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    
    const [invoiceToView, setInvoiceToView] = useState<Invoice | null>(null);
    const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);

    const toNum = (val: any): number => Number(val) || 0;

    const handleSave = (data: Omit<Invoice, 'id' | 'invoiceNumber'> | Invoice) => {
        if ('id' in data) {
            updateInvoice(data);
        } else {
            addInvoice(data);
        }
        setIsFormModalOpen(false);
        setInvoiceToEdit(null);
    }
    
    const openNewModal = () => {
        setInvoiceToEdit(null);
        setIsFormModalOpen(true);
    }
    
    const openEditModal = (invoice: Invoice) => {
        setInvoiceToEdit(invoice);
        setIsFormModalOpen(true);
    }
    
    const openViewModal = (invoice: Invoice) => {
        setInvoiceToView(invoice);
    }

    const handleStatusChange = (invoiceId: string, newStatus: Invoice['status']) => {
        const invoiceToUpdate = invoices.find(inv => inv.id === invoiceId);
        if (invoiceToUpdate) {
            updateInvoice({ ...invoiceToUpdate, status: newStatus });
        }
    };
    
    const printInvoice = (invoiceId: string) => {
        const invoice = invoices.find(inv => inv.id === invoiceId);
        if (!invoice) return;

        const company = getCompany(invoice.companyId);
        const attachedExpenses = expenses.filter(exp => invoice.attachedExpenseIds.includes(exp.id));
        const content = getInvoicePrintableContent(invoice, company, attachedExpenses, userProfile);
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("Could not open print window. Please disable pop-up blockers.");
            return;
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>Invoice #${String(invoice.invoiceNumber).padStart(3, '0')}</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        body { font-family: 'Helvetica', 'Arial', sans-serif; }
                    </style>
                </head>
                <body>
                    ${content}
                </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    };


    return (
        <div>
            <div className="flex flex-wrap justify-between items-center gap-y-4 mb-6">
                <h2 className="font-press-start text-xl sm:text-2xl text-yellow-700">INVOICES</h2>
                <div className="flex flex-wrap gap-2 justify-end">
                    <Button variant="secondary" onClick={() => setIsImportModalOpen(true)} className="text-xs !px-3 !py-2">Import</Button>
                    <Button onClick={openNewModal} className="text-xs !px-3 !py-2">+ New Invoice</Button>
                </div>
            </div>

            <div className="bg-black border-2 border-green-500 pixel-corners">
                {invoices.length === 0 ? (
                    <p className="p-4 text-center text-gray-400">No invoices yet. Create one to get started!</p>
                ) : (
                    <>
                        {/* Mobile View */}
                        <div className="md:hidden">
                            {invoices.map(invoice => {
                                const company = getCompany(invoice.companyId);
                                const attachedExpenses = expenses.filter(exp => invoice.attachedExpenseIds.includes(exp.id));
                                
                                const subtotal = invoice.items.reduce((sum, item) => sum + toNum(item.amount), 0);
                                const hst = subtotal * toNum(invoice.hstRate);
                                const perDiemsTotal = invoice.items.reduce((sum, item) => sum + (toNum(item.perDiemQuantity) * toNum(company?.defaultPerDiem)), 0);
                                const expensesTotal = attachedExpenses.reduce((sum, exp) => sum + toNum(exp.cadAmount), 0);
                                const grandTotal = subtotal + hst + perDiemsTotal + expensesTotal;
                                
                                const statusColor = { Draft: 'bg-gray-600', Sent: 'bg-fuchsia-700', Paid: 'bg-green-600' };
                                
                                return (
                                    <div key={invoice.id} className="p-3 border-b-2 border-green-800 last:border-b-0 space-y-2">
                                        <div className="flex justify-between items-start gap-2">
                                            <div>
                                                <p className="font-bold">#{String(invoice.invoiceNumber).padStart(3, '0')} - {company?.name || 'N/A'}</p>
                                                <p className="text-sm text-gray-400">{invoice.date}</p>
                                            </div>
                                            <p className="font-bold text-lg text-yellow-400 whitespace-nowrap">$ {grandTotal.toFixed(2)}</p>
                                        </div>
                                        <div className="flex justify-between items-center">
                                             <select 
                                                value={invoice.status} 
                                                onChange={(e) => handleStatusChange(invoice.id, e.target.value as Invoice['status'])}
                                                className={`border-2 border-transparent text-white text-xs p-1 rounded focus:outline-none ${statusColor[invoice.status]}`}
                                            >
                                                <option value="Draft" className="bg-gray-700">Draft</option>
                                                <option value="Sent" className="bg-fuchsia-800">Sent</option>
                                                <option value="Paid" className="bg-green-700">Paid</option>
                                            </select>
                                            <div className="flex gap-1 justify-end">
                                                <Button variant="secondary" className="text-xs !px-2 !py-1" onClick={() => openViewModal(invoice)}>View</Button>
                                                <Button variant="secondary" className="text-xs !px-2 !py-1" onClick={() => openEditModal(invoice)}>Edit</Button>
                                                <Button variant="secondary" className="text-xs !px-2 !py-1" onClick={() => printInvoice(invoice.id)}>DL</Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Desktop View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="border-b-2 border-green-500 text-fuchsia-500 font-bold uppercase tracking-wider text-sm">
                                    <tr>
                                        <th className="p-3">#</th>
                                        <th className="p-3">Company</th>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Total</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map(invoice => {
                                        const company = getCompany(invoice.companyId);
                                        const attachedExpenses = expenses.filter(exp => invoice.attachedExpenseIds.includes(exp.id));
                                        
                                        const subtotal = invoice.items.reduce((sum, item) => sum + toNum(item.amount), 0);
                                        const hst = subtotal * toNum(invoice.hstRate);
                                        const perDiemsTotal = invoice.items.reduce((sum, item) => sum + (toNum(item.perDiemQuantity) * toNum(company?.defaultPerDiem)), 0);
                                        const expensesTotal = attachedExpenses.reduce((sum, exp) => sum + toNum(exp.cadAmount), 0);
                                        const grandTotal = subtotal + hst + perDiemsTotal + expensesTotal;
                                        
                                        const statusColor = { Draft: 'bg-gray-600', Sent: 'bg-fuchsia-700', Paid: 'bg-green-600' };
                                        
                                        return (
                                            <tr key={invoice.id} className="border-b border-green-800 hover:bg-gray-900">
                                                <td className="p-3">{String(invoice.invoiceNumber).padStart(3, '0')}</td>
                                                <td className="p-3">{company?.name || 'N/A'}</td>
                                                <td className="p-3">{invoice.date}</td>
                                                <td className="p-3">$${grandTotal.toFixed(2)}</td>
                                                <td className="p-3">
                                                    <select 
                                                        value={invoice.status} 
                                                        onChange={(e) => handleStatusChange(invoice.id, e.target.value as Invoice['status'])}
                                                        className={`border-2 border-transparent text-white text-sm p-1 rounded focus:outline-none ${statusColor[invoice.status]}`}
                                                    >
                                                        <option value="Draft" className="bg-gray-700">Draft</option>
                                                        <option value="Sent" className="bg-fuchsia-800">Sent</option>
                                                        <option value="Paid" className="bg-green-700">Paid</option>
                                                    </select>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        <Button variant="secondary" className="text-xs !px-2 !py-1" onClick={() => openViewModal(invoice)}>View</Button>
                                                        <Button variant="secondary" className="text-xs !px-2 !py-1" onClick={() => openEditModal(invoice)}>Edit</Button>
                                                        <Button variant="secondary" className="text-xs !px-2 !py-1" onClick={() => printInvoice(invoice.id)}>Download</Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            <Modal isOpen={isFormModalOpen} onClose={() => {setIsFormModalOpen(false); setInvoiceToEdit(null);}} title={invoiceToEdit ? 'Edit Invoice' : 'Create New Invoice'}>
                <InvoiceForm invoice={invoiceToEdit} onSave={handleSave} onCancel={() => {setIsFormModalOpen(false); setInvoiceToEdit(null);}} />
            </Modal>
            
            <InvoiceViewModal 
                invoice={invoiceToView} 
                onClose={() => setInvoiceToView(null)} 
                onPrint={() => invoiceToView && printInvoice(invoiceToView.id)} 
            />
            
            <ImportInvoiceModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
        </div>
    );
};

export default InvoicesTab;
