
import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { Invoice, InvoiceItem, Company, Expense, UserProfile } from '../types';
import { extractInvoiceData, InvoiceOcrResult } from '../services/geminiService';
import { convertToCAD } from '../services/currencyService';
import { CURRENCY_RATES } from '../constants';

type NewInvoiceData = Omit<Invoice, 'id' | 'invoiceNumber'>;
type NewInvoiceItemData = Omit<InvoiceItem, 'id' | 'amount'>;

const inputClass = "w-full bg-gray-700 text-white border-2 border-black p-2 font-bold focus:outline-none focus:shadow-[4px_4px_0_rgba(255,255,255,0.2)] transition-shadow placeholder-gray-400";
const labelClass = "block text-white font-bold mb-1 uppercase tracking-wide text-sm";

const InvoiceForm: React.FC<{
    invoice?: Invoice | null;
    onSave: (data: Omit<Invoice, 'id' | 'invoiceNumber'> | Invoice) => void;
    onCancel: () => void;
}> = ({ invoice, onSave, onCancel }) => {
    const { companies, expenses, expenseCategories } = useAppContext();
    const [companyId, setCompanyId] = useState<string>(invoice?.companyId || companies[0]?.id || '');
    const [date, setDate] = useState(invoice?.date || new Date().toISOString().split('T')[0]);
    
    const initialItems = invoice?.items.map(item => ({...item})) || 
        [{ startDate: new Date().toISOString().split('T')[0], endDate: null, description: '', quantity: 1, unit: 'Day' as const, rate: companies.find(c => c.id === (invoice?.companyId || companies[0]?.id))?.defaultRate || 0, approver: '', perDiemQuantity: 0, perDiemCurrency: 'CAD' as const }];

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
        
        // Auto-calculate quantity only if both Start Date and End Date are present (and valid)
        if ((field === 'startDate' || field === 'endDate') && (currentItem.unit === 'Day' || currentItem.unit === 'Half-Day')) {
            const { startDate, endDate } = currentItem;
            if (startDate && endDate && new Date(endDate) >= new Date(startDate)) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                const diffTime = Math.abs(end.getTime() - start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                currentItem.quantity = diffDays > 0 ? diffDays : 1;
            }
        }
        
        // If user manually changes quantity back to 1, clear the end date
        if (field === 'quantity' && Number(value) === 1) {
            currentItem.endDate = null;
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

    const addItem = () => setItems([...items, { startDate: new Date().toISOString().split('T')[0], endDate: null, description: '', quantity: 1, unit: 'Day', rate: companies.find(c => c.id === companyId)?.defaultRate || 0, approver: '', perDiemQuantity: 0, perDiemCurrency: 'CAD' }]);
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
                perDiemCurrency: item.perDiemCurrency || 'CAD',
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
        <div className="space-y-6 text-lg font-comic-body">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>Company</label>
                    <select value={companyId} onChange={e => setCompanyId(e.target.value)} className={inputClass}>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelClass}>Invoice Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
                </div>
            </div>
            
            <div className="bg-cyan-900/30 p-4 border-2 border-black border-dashed">
                <h3 className="font-comic-title text-xl text-white mb-2 pb-1 border-b-2 border-black">Line Items</h3>
                 {items.map((item, index) => {
                     const amount = (item.quantity || 0) * (item.rate || 0);
                     const isHourly = item.unit === 'Hourly';
                     // Only show end date if not hourly AND (quantity > 1 OR endDate exists)
                     const showEndDate = !isHourly && ((item.quantity || 0) > 1 || !!item.endDate);

                     return (
                        <div key={index} className="bg-gray-700 border-2 border-black p-4 mb-4 relative shadow-[4px_4px_0_rgba(0,0,0,0.5)]">
                            <button onClick={() => removeItem(index)} className="absolute top-0 right-0 bg-red-600 text-white font-bold w-6 h-6 flex items-center justify-center border-l-2 border-b-2 border-black hover:bg-red-500">×</button>
                            
                            {showEndDate ? (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                                        <div>
                                            <label className={labelClass}>Start Date</label>
                                            <input type="date" value={item.startDate} onChange={e => handleItemChange(index, 'startDate', e.target.value)} className={inputClass} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>End Date</label>
                                            <input type="date" value={item.endDate || ''} onChange={e => handleItemChange(index, 'endDate', e.target.value || null)} className={inputClass} />
                                        </div>
                                    </div>
                                    <div className="mt-3">
                                        <label className={labelClass}>Description</label>
                                        <input type="text" placeholder="Description" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} className={inputClass} />
                                    </div>
                                </>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mt-2">
                                    <div className="sm:col-span-4">
                                        <label className={labelClass}>Date</label>
                                        <input type="date" value={item.startDate} onChange={e => handleItemChange(index, 'startDate', e.target.value)} className={inputClass} />
                                    </div>
                                    <div className="sm:col-span-8">
                                        <label className={labelClass}>Description</label>
                                        <input type="text" placeholder="Description" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} className={inputClass} />
                                    </div>
                                </div>
                            )}
                            
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                                <div>
                                    <label className={labelClass}>Qty</label>
                                    <input type="number" placeholder="Qty" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value))} className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Unit</label>
                                    <select value={item.unit} onChange={e => handleItemChange(index, 'unit', e.target.value as 'Day'|'Half-Day'|'Hourly')} className={inputClass}>
                                        <option value="Day">Day</option><option value="Half-Day">Half-Day</option><option value="Hourly">Hourly</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Rate</label>
                                    <input type="number" placeholder="Rate" value={item.rate} onChange={e => handleItemChange(index, 'rate', parseFloat(e.target.value))} className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-gray-400 font-bold mb-1 uppercase tracking-wide text-sm">Amount</label>
                                    <input type="number" placeholder="Total" value={amount.toFixed(2)} disabled className="w-full bg-gray-600 border-2 border-gray-500 p-2 text-gray-300 font-bold" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3">
                                <div className="sm:col-span-2">
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className={`${labelClass} whitespace-nowrap`}>PD (Days)</label>
                                            <input type="number" placeholder="PDs" value={item.perDiemQuantity} onChange={e => handleItemChange(index, 'perDiemQuantity', parseInt(e.target.value, 10))} className={inputClass} />
                                        </div>
                                        <div className="w-24">
                                            <label className={labelClass}>Cur.</label>
                                            <select value={item.perDiemCurrency || 'CAD'} onChange={e => handleItemChange(index, 'perDiemCurrency', e.target.value)} className={`${inputClass} !px-1`}>
                                                <option value="CAD">CAD</option>
                                                <option value="USD">USD</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className={labelClass}>Approver</label>
                                    <input type="text" placeholder="Name" value={item.approver} onChange={e => handleItemChange(index, 'approver', e.target.value)} className={inputClass} />
                                </div>
                            </div>
                        </div>
                )})}
                <Button variant="secondary" onClick={addItem} className="text-sm py-1 mt-2"> + Add Item </Button>
            </div>

            <div className="bg-yellow-900/30 p-4 border-2 border-black border-dashed">
                <h3 className="font-comic-title text-xl text-white mb-2 border-b-2 border-black pb-1">Attach Expenses</h3>
                <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                    {availableExpenses.length > 0 ? availableExpenses.map(exp => (
                        <label key={exp.id} className="flex items-center gap-2 p-2 bg-gray-700 text-white border-2 border-black cursor-pointer hover:bg-yellow-900 transition-colors">
                            <input type="checkbox" checked={attachedExpenseIds.includes(exp.id)} onChange={() => handleExpenseToggle(exp.id)} className="w-5 h-5 accent-yellow-400" />
                            <span className="font-bold">{exp.date}</span>
                            <span>- {exp.description} (${exp.cadAmount.toFixed(2)})</span>
                        </label>
                    )) : <p className="text-sm text-gray-400 italic">No billable expenses available.</p>}
                </div>
            </div>

            <div>
                <label className={labelClass}>Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputClass} />
            </div>
            <div className="mt-6 flex justify-end gap-4 border-t-2 border-black pt-4">
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
    
    // Calculate PD Total converting USD to CAD if needed
    const perDiemsTotal = invoice.items.reduce((sum, item) => {
        const rate = item.perDiemCurrency === 'USD' ? CURRENCY_RATES['USD'] : 1;
        return sum + (toNum(item.perDiemQuantity) * defaultPerDiem * rate);
    }, 0);

    const hst = (subtotal + perDiemsTotal) * toNum(invoice.hstRate);

    const expensesTotal = attachedExpenses.reduce((sum, exp) => sum + toNum(exp.cadAmount), 0);
    const grandTotal = subtotal + hst + perDiemsTotal + expensesTotal;

    const itemsHtml = invoice.items.map(item => {
        const itemAmount = toNum(item.amount);
        
        const currencyRate = item.perDiemCurrency === 'USD' ? CURRENCY_RATES['USD'] : 1;
        const perDiemCadAmount = toNum(item.perDiemQuantity) * defaultPerDiem * currencyRate;
        
        const lineTotal = itemAmount + perDiemCadAmount;
        const dateDisplay = item.endDate ? `${item.startDate} to ${item.endDate}` : item.startDate;
        
        const pdDisplay = item.perDiemQuantity > 0 
            ? `$${(toNum(item.perDiemQuantity) * defaultPerDiem).toFixed(2)} ${item.perDiemCurrency}` 
            : '-';

        return `
            <tr class="border-b">
                <td class="py-2 px-1">${dateDisplay}</td>
                <td class="py-2 px-1">${item.description}</td>
                <td class="py-2 px-1 text-center">${toNum(item.quantity)} ${item.unit}</td>
                <td class="py-2 px-1 text-right">$${toNum(item.rate).toFixed(2)}</td>
                <td class="py-2 px-1 text-center">${toNum(item.perDiemQuantity)}</td>
                <td class="py-2 px-1 text-right text-xs">${pdDisplay}</td>
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
        <div class="p-8 font-sans text-black bg-white">
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
                        <th class="py-2 px-1 text-right">PD Amt</th>
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
                    <div class="flex justify-between"><span class="font-bold">Per Diems (CAD):</span><span>$${toNum(perDiemsTotal).toFixed(2)}</span></div>
                    <div class="flex justify-between"><span class="font-bold">GST/HST (${(toNum(invoice.hstRate) * 100).toFixed(0)}%):</span><span>$${toNum(hst).toFixed(2)}</span></div>
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

    // Calculate PD Total converting USD to CAD if needed
    const perDiemsTotal = invoice.items.reduce((sum, item) => {
        const rate = item.perDiemCurrency === 'USD' ? CURRENCY_RATES['USD'] : 1;
        return sum + (item.perDiemQuantity * defaultPerDiem * rate);
    }, 0);

    const hst = (subtotal + perDiemsTotal) * (invoice.hstRate || 0);

    const expensesTotal = attachedExpenses.reduce((sum, exp) => sum + exp.cadAmount, 0);
    const grandTotal = subtotal + hst + perDiemsTotal + expensesTotal;

    return (
        <Modal isOpen={!!invoice} onClose={onClose} title={`INVOICE #${String(invoice.invoiceNumber).padStart(3, '0')}`} maxWidth="max-w-5xl">
            <div className="space-y-6">
                <div className="flex justify-between items-start">
                    <div className="bg-blue-500 p-4 border-2 border-black -rotate-1 shadow-sm text-black">
                        <p className="font-comic-title text-xl mb-2">BILLED TO:</p>
                        <p className="text-xl font-bold">{company?.name}</p>
                        <p className="whitespace-pre-line">{company?.address}</p>
                    </div>
                    <div className="text-right">
                        <p><span className="font-bold text-blue-400">Date:</span> {invoice.date}</p>
                        <p><span className="font-bold text-blue-400">Status:</span> <span className="uppercase font-bold">{invoice.status}</span></p>
                    </div>
                </div>

                <div>
                    <h3 className="font-comic-title text-2xl text-white mb-2 border-b-2 border-black pb-1">Line Items</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm min-w-[600px] text-white">
                          <thead>
                              <tr className="border-b-2 border-black bg-gray-700">
                                  <th className="p-2 font-bold uppercase">Dates</th><th className="p-2 font-bold uppercase">Description</th><th className="p-2 font-bold uppercase">Qty</th><th className="p-2 font-bold uppercase">Rate</th><th className="p-2 font-bold uppercase">PD Qty</th><th className="p-2 font-bold uppercase text-right">PD Amt</th><th className="p-2 font-bold uppercase text-right">Total</th><th className="p-2 font-bold uppercase">Approver</th>
                              </tr>
                          </thead>
                          <tbody>
                              {invoice.items.map(item => {
                                  const currencyRate = item.perDiemCurrency === 'USD' ? CURRENCY_RATES['USD'] : 1;
                                  const perDiemCadAmount = item.perDiemQuantity * defaultPerDiem * currencyRate;
                                  const lineTotal = item.amount + perDiemCadAmount;
                                  const dateDisplay = item.endDate ? `${item.startDate} to ${item.endDate}` : item.startDate;
                                  const pdDisplay = item.perDiemQuantity > 0 
                                    ? `$${(item.perDiemQuantity * defaultPerDiem).toFixed(2)} ${item.perDiemCurrency}` 
                                    : '-';

                                  return (
                                  <tr key={item.id} className="border-b border-gray-600">
                                      <td className="p-2">{dateDisplay}</td><td className="p-2">{item.description}</td><td className="p-2">{item.quantity} {item.unit}</td><td className="p-2">${item.rate.toFixed(2)}</td><td className="p-2">{item.perDiemQuantity}</td><td className="p-2 text-right">{pdDisplay}</td><td className="p-2 text-right font-bold text-blue-400">${lineTotal.toFixed(2)}</td><td className="p-2">{item.approver}</td>
                                  </tr>
                              )})}
                          </tbody>
                      </table>
                    </div>
                </div>

                {attachedExpenses.length > 0 && (
                    <div>
                        <h3 className="font-comic-title text-2xl text-white mb-2 border-b-2 border-black pb-1">Attached Expenses</h3>
                        <div className="space-y-1">
                            {attachedExpenses.map(exp => <p key={exp.id} className="text-sm flex justify-between border-b border-dashed border-gray-600 py-1"><span>{exp.date} - {exp.description}</span> <span>$${exp.cadAmount.toFixed(2)}</span></p>)}
                        </div>
                    </div>
                )}
                
                <div className="flex justify-end">
                    <div className="w-64 space-y-1 text-lg border-2 border-black p-4 bg-gray-700 shadow-[4px_4px_0_black]">
                        <div className="flex justify-between"><span className="font-bold text-gray-300">Subtotal:</span><span>${subtotal.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="font-bold text-gray-300">Per Diems (CAD):</span><span>${perDiemsTotal.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="font-bold text-gray-300">HST ({(invoice.hstRate * 100).toFixed(0)}%):</span><span>${hst.toFixed(2)}</span></div>
                        <div className="flex justify-between border-b-2 border-black pb-1"><span className="font-bold text-gray-300">Expenses:</span><span>${expensesTotal.toFixed(2)}</span></div>
                        <div className="flex justify-between font-bold text-xl pt-1 text-green-400"><span className="font-comic-title">Total:</span><span>${grandTotal.toFixed(2)}</span></div>
                    </div>
                </div>

                {invoice.notes && <div><p className="font-bold text-blue-400">Notes:</p><p className="text-sm italic text-gray-300">{invoice.notes}</p></div>}

                <div className="flex justify-end gap-4 pt-4 border-t-2 border-black">
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                    <Button onClick={onPrint} className="!bg-blue-500 !text-black hover:!bg-blue-400">Download PDF</Button>
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
    const [statusMessage, setStatusMessage] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
    const [isFolderMode, setIsFolderMode] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedFiles(e.target.files);
        setStatusMessage('');
    }

    const processFile = (file: File): Promise<void> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = async () => {
                try {
                    const base64String = (reader.result as string).split(',')[1];
                    const ocrResult = await extractInvoiceData(base64String, file.type);
                    if (!ocrResult) throw new Error(`Could not read data from ${file.name}`);

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
                        perDiemCurrency: 'CAD' as const,
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
                        invoiceNumber: ocrResult.invoiceNumber,
                    };
                    
                    importInvoiceWithExpenses(newInvoiceData, newExpenses);
                    resolve();
                } catch (err: any) {
                    reject(err);
                }
            };
            reader.readAsDataURL(file);
        });
    }

    const handleImport = async () => {
        if (!selectedFiles || selectedFiles.length === 0) {
            alert('Please select files to import.');
            return;
        }

        setIsProcessing(true);
        setStatusMessage('Starting import...');
        
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles.item(i);
            if (!file) continue;
            setStatusMessage(`Processing ${i + 1}/${selectedFiles.length}: ${file.name}`);
            try {
                await processFile(file);
                successCount++;
            } catch (err) {
                console.error(err);
                failCount++;
            }
        }

        setStatusMessage(`Import Complete. Processed ${successCount}, Failed ${failCount}.`);
        setIsProcessing(false);
        setTimeout(() => {
            if (successCount > 0) onClose();
            setStatusMessage('');
            setSelectedFiles(null);
        }, 2000);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Import Invoices">
            <div className="space-y-4">
                <p>Select PDF or image files to automatically import invoices. You can select multiple files or an entire folder.</p>
                
                <div className="flex gap-4 mb-2">
                    <Button 
                        variant={!isFolderMode ? 'primary' : 'secondary'} 
                        onClick={() => { setIsFolderMode(false); setSelectedFiles(null); }}
                        className="text-sm !py-1"
                    >
                        Select Files
                    </Button>
                    <Button 
                        variant={isFolderMode ? 'primary' : 'secondary'} 
                        onClick={() => { setIsFolderMode(true); setSelectedFiles(null); }}
                        className="text-sm !py-1"
                    >
                        Select Folder
                    </Button>
                </div>

                <div className="border-2 border-black border-dashed p-6 text-center bg-gray-700">
                    {!isFolderMode ? (
                        <input 
                            type="file" 
                            multiple
                            onChange={handleFileChange} 
                            accept="application/pdf,image/*" 
                            className="text-sm text-white w-full" 
                        />
                    ) : (
                        <input 
                            type="file" 
                            multiple
                            {...({ webkitdirectory: "", directory: "" } as any)}
                            onChange={handleFileChange} 
                            className="text-sm text-white w-full" 
                        />
                    )}
                    
                    {selectedFiles && selectedFiles.length > 0 && (
                        <div className="mt-2 text-left bg-gray-800 p-2 max-h-32 overflow-y-auto">
                            <p className="text-xs font-bold text-yellow-400 mb-1">{selectedFiles.length} files selected:</p>
                            {Array.from(selectedFiles).map((f: any, i) => (
                                <p key={i} className="text-xs text-gray-300 truncate">{f.name}</p>
                            ))}
                        </div>
                    )}
                </div>
                
                {statusMessage && (
                    <div className="bg-black p-2 border-2 border-white">
                        <p className="text-green-400 font-mono text-sm">{statusMessage}</p>
                    </div>
                )}
                
                <div className="flex justify-end gap-4 pt-4 border-t-2 border-black">
                    <Button variant="secondary" onClick={onClose} disabled={isProcessing}>Cancel</Button>
                    <Button onClick={handleImport} disabled={isProcessing || !selectedFiles}>{isProcessing ? 'Processing...' : 'Start Import'}</Button>
                </div>
            </div>
        </Modal>
    );
};


const InvoicesTab: React.FC = () => {
    const { invoices, updateInvoice, deleteInvoice, getCompany, expenses, addInvoice, userProfile } = useAppContext();
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

    const handleDeleteInvoice = (id: string) => {
        if (window.confirm("Are you sure you want to delete this invoice? Associated expenses will be detached but not deleted.")) {
            deleteInvoice(id);
        }
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
                <h2 className="text-3xl sm:text-4xl transform -rotate-1 relative">
                    <span className="bg-blue-500 text-black px-2 border-2 border-black shadow-[4px_4px_0_black]">INVOICES</span>
                </h2>
                <div className="flex flex-wrap gap-2 justify-end">
                    <Button variant="secondary" onClick={() => setIsImportModalOpen(true)} className="text-sm !px-4 !py-2">Import</Button>
                    <Button onClick={openNewModal} className="text-sm !px-4 !py-2 !bg-blue-500 !text-black hover:!bg-blue-400">+ New Invoice</Button>
                </div>
            </div>

            <div className="bg-gray-700 border-[3px] border-black comic-shadow p-2 sm:p-4">
                {invoices.length === 0 ? (
                    <p className="p-8 text-center text-gray-400 font-bold text-xl italic">No invoices yet. Time to get paid!</p>
                ) : (
                    <>
                        {/* Mobile View */}
                        <div className="md:hidden space-y-4">
                            {invoices.map(invoice => {
                                const company = getCompany(invoice.companyId);
                                const attachedExpenses = expenses.filter(exp => invoice.attachedExpenseIds.includes(exp.id));
                                
                                const subtotal = invoice.items.reduce((sum, item) => sum + toNum(item.amount), 0);
                                const perDiemsTotal = invoice.items.reduce((sum, item) => {
                                    const rate = item.perDiemCurrency === 'USD' ? CURRENCY_RATES['USD'] : 1;
                                    return sum + (toNum(item.perDiemQuantity) * toNum(company?.defaultPerDiem) * rate);
                                }, 0);
                                const hst = (subtotal + perDiemsTotal) * toNum(invoice.hstRate);
                                const expensesTotal = attachedExpenses.reduce((sum, exp) => sum + toNum(exp.cadAmount), 0);
                                const grandTotal = subtotal + hst + perDiemsTotal + expensesTotal;
                                
                                const statusColor = { Draft: 'bg-gray-600 text-gray-200', Sent: 'bg-blue-800 text-white', Paid: 'bg-green-800 text-white' };
                                
                                return (
                                    <div key={invoice.id} className="p-4 border-2 border-black bg-gray-800 relative">
                                        <div className="absolute top-2 right-2 text-xs font-bold bg-white text-black border border-black px-1">
                                            #{String(invoice.invoiceNumber).padStart(3, '0')}
                                        </div>
                                        <div className="mb-2">
                                            <p className="font-comic-title text-xl text-white">{company?.name || 'N/A'}</p>
                                            <p className="text-sm text-gray-400 font-bold">{invoice.date}</p>
                                        </div>
                                        <div className="flex justify-between items-end mb-3">
                                            <select 
                                                value={invoice.status} 
                                                onChange={(e) => handleStatusChange(invoice.id, e.target.value as Invoice['status'])}
                                                className={`border-2 border-black text-xs p-1 font-bold focus:outline-none uppercase ${statusColor[invoice.status]}`}
                                            >
                                                <option value="Draft">Draft</option>
                                                <option value="Sent">Sent</option>
                                                <option value="Paid">Paid</option>
                                            </select>
                                            <p className="font-comic-title text-2xl text-red-400">$ {grandTotal.toFixed(2)}</p>
                                        </div>
                                        <div className="flex gap-1 justify-end border-t-2 border-gray-600 pt-2">
                                            <Button variant="secondary" className="text-xs !px-2 !py-1 !border" onClick={() => openViewModal(invoice)}>View</Button>
                                            <Button variant="secondary" className="text-xs !px-2 !py-1 !border" onClick={() => openEditModal(invoice)}>Edit</Button>
                                            <Button className="text-xs !px-2 !py-1 !border !bg-blue-500 !text-black hover:!bg-blue-400" onClick={() => printInvoice(invoice.id)} title="Download PDF">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                                </svg>
                                            </Button>
                                            <Button variant="danger" className="text-xs !px-2 !py-1 !border" onClick={() => handleDeleteInvoice(invoice.id)} title="Delete Invoice">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                </svg>
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Desktop View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse text-white">
                                <thead className="bg-blue-500 text-black border-b-[3px] border-black font-comic-title text-lg tracking-wider">
                                    <tr>
                                        <th className="p-3 border-r-2 border-black">#</th>
                                        <th className="p-3 border-r-2 border-black">Company</th>
                                        <th className="p-3 border-r-2 border-black">Date</th>
                                        <th className="p-3 border-r-2 border-black">Total</th>
                                        <th className="p-3 border-r-2 border-black">Status</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map((invoice, idx) => {
                                        const company = getCompany(invoice.companyId);
                                        const attachedExpenses = expenses.filter(exp => invoice.attachedExpenseIds.includes(exp.id));
                                        
                                        const subtotal = invoice.items.reduce((sum, item) => sum + toNum(item.amount), 0);
                                        const perDiemsTotal = invoice.items.reduce((sum, item) => {
                                            const rate = item.perDiemCurrency === 'USD' ? CURRENCY_RATES['USD'] : 1;
                                            return sum + (toNum(item.perDiemQuantity) * toNum(company?.defaultPerDiem) * rate);
                                        }, 0);
                                        const hst = (subtotal + perDiemsTotal) * toNum(invoice.hstRate);
                                        const expensesTotal = attachedExpenses.reduce((sum, exp) => sum + toNum(exp.cadAmount), 0);
                                        const grandTotal = subtotal + hst + perDiemsTotal + expensesTotal;
                                        
                                        const statusColor = { Draft: 'bg-gray-600', Sent: 'bg-blue-600', Paid: 'bg-green-600' };
                                        
                                        return (
                                            <tr key={invoice.id} className="border-b-2 border-black hover:bg-gray-600 transition-colors">
                                                <td className="p-3 border-r-2 border-black font-bold">{String(invoice.invoiceNumber).padStart(3, '0')}</td>
                                                <td className="p-3 border-r-2 border-black font-bold">{company?.name || 'N/A'}</td>
                                                <td className="p-3 border-r-2 border-black">{invoice.date}</td>
                                                <td className="p-3 border-r-2 border-black font-comic-title text-lg text-white">
                                                    ${grandTotal.toFixed(2)}
                                                </td>
                                                <td className="p-3 border-r-2 border-black">
                                                    <select 
                                                        value={invoice.status} 
                                                        onChange={(e) => handleStatusChange(invoice.id, e.target.value as Invoice['status'])}
                                                        className={`border-2 border-black text-white font-bold text-sm p-1 focus:outline-none uppercase ${statusColor[invoice.status]}`}
                                                    >
                                                        <option value="Draft">Draft</option>
                                                        <option value="Sent">Sent</option>
                                                        <option value="Paid">Paid</option>
                                                    </select>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        <Button variant="secondary" className="text-xs !px-2 !py-1 !border" onClick={() => openViewModal(invoice)}>View</Button>
                                                        <Button variant="secondary" className="text-xs !px-2 !py-1 !border" onClick={() => openEditModal(invoice)}>Edit</Button>
                                                        <Button className="text-xs !px-2 !py-1 !border !bg-blue-500 !text-black hover:!bg-blue-400" onClick={() => printInvoice(invoice.id)} title="Download PDF">
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                                            </svg>
                                                        </Button>
                                                        <Button variant="danger" className="text-xs !px-2 !py-1 !border" onClick={() => handleDeleteInvoice(invoice.id)} title="Delete Invoice">
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                            </svg>
                                                        </Button>
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
