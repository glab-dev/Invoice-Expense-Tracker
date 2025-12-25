
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { Company, Invoice, Expense, InvoiceItem, UserProfile } from '../types';
import { MOCK_COMPANIES, MOCK_EXPENSES, MOCK_INVOICES, DEFAULT_EXPENSE_CATEGORIES } from '../constants';
import { extractReceiptData } from '../services/geminiService';
import { convertToCAD } from '../services/currencyService';

// Define File System Access API types locally for safety
interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
  isSameEntry: (other: FileSystemHandle) => Promise<boolean>;
  queryPermission: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
}
interface FileSystemFileHandle extends FileSystemHandle {
  getFile(): Promise<File>;
}
interface FileSystemDirectoryHandle extends FileSystemHandle {
  values(): AsyncIterableIterator<FileSystemHandle>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

interface AppContextType {
  companies: Company[];
  setCompanies: React.Dispatch<React.SetStateAction<Company[]>>;
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  expenseCategories: string[];
  addExpenseCategory: (category: string) => void;
  updateExpenseCategory: (oldCategory: string, newCategory: string) => void;
  deleteExpenseCategory: (category: string) => void;
  addExpense: (expense: Omit<Expense, 'id'>) => Expense;
  addExpenses: (expensesData: Omit<Expense, 'id'>[]) => void;
  updateExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;
  deleteAllExpenses: () => void;
  getCompany: (id: string) => Company | undefined;
  addCompany: (company: Omit<Company, 'id'>) => Company;
  updateCompany: (company: Company) => void;
  addInvoice: (invoice: Omit<Invoice, 'id' | 'invoiceNumber'>) => Invoice;
  updateInvoice: (invoice: Invoice) => void;
  deleteInvoice: (id: string) => void;
  importInvoiceWithExpenses: (
    invoiceData: Omit<Invoice, 'id' | 'invoiceNumber' | 'attachedExpenseIds' | 'items'> & { items: Omit<InvoiceItem, 'id'>[], invoiceNumber?: number },
    expensesData: Omit<Expense, 'id'>[]
  ) => void;
  userProfile: UserProfile;
  updateUserProfile: (profile: UserProfile) => void;
  
  // Folder Linking
  linkFolder: (type: 'expenses' | 'billable') => Promise<void>;
  unlinkFolder: (type: 'expenses' | 'billable') => void;
  expensesFolderLinked: boolean;
  billableFolderLinked: boolean;
  expensesFolderName: string;
  billableFolderName: string;
  isScanning: boolean;
  isFileSystemSupported: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [companies, setCompanies] = useLocalStorage<Company[]>('retro_companies', MOCK_COMPANIES);
  const [invoices, setInvoices] = useLocalStorage<Invoice[]>('retro_invoices', MOCK_INVOICES);
  const [expenses, setExpenses] = useLocalStorage<Expense[]>('retro_expenses', MOCK_EXPENSES);
  const [expenseCategories, setExpenseCategories] = useLocalStorage<string[]>('retro_expense_categories', DEFAULT_EXPENSE_CATEGORIES);
  const [userProfile, setUserProfile] = useLocalStorage<UserProfile>('retro_user_profile', {
    name: 'Your Name Here',
    address: 'Your Address\nCity, Province, Postal Code',
  });
  const [processedFiles, setProcessedFiles] = useLocalStorage<string[]>('retro_processed_files', []);

  // Volatile state for directory handles (cannot be persisted easily in localStorage)
  const [expensesFolderHandle, setExpensesFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [billableFolderHandle, setBillableFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  
  // Safe check for browser support
  const isFileSystemSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  const updateUserProfile = (profile: UserProfile) => {
    setUserProfile(profile);
  };

  const addExpenseCategory = (category: string) => {
    if (category && !expenseCategories.find(c => c.toLowerCase() === category.toLowerCase())) {
        setExpenseCategories(prev => [...prev, category]);
    }
  };

  const updateExpenseCategory = (oldCategory: string, newCategory: string) => {
    if (!newCategory || expenseCategories.find(c => c.toLowerCase() === newCategory.toLowerCase())) {
        alert("Category already exists or is invalid.");
        return;
    }
    setExpenseCategories(prev => prev.map(c => c === oldCategory ? newCategory : c));
    setExpenses(prev => prev.map(exp => exp.category === oldCategory ? { ...exp, category: newCategory } : exp));
  };
  
  const deleteExpenseCategory = (categoryToDelete: string) => {
    if (expenses.some(exp => exp.category === categoryToDelete)) {
        alert("Cannot delete category as it is currently in use by one or more expenses.");
        return;
    }
    setExpenseCategories(prev => prev.filter(c => c !== categoryToDelete));
  };

  const addExpense = (expenseData: Omit<Expense, 'id'>): Expense => {
    const newExpense: Expense = {
      ...expenseData,
      id: `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    };
    setExpenses(prev => [...prev, newExpense]);
    return newExpense;
  };

  const addExpenses = (expensesData: Omit<Expense, 'id'>[]) => {
      const newExpenses = expensesData.map(data => ({
          ...data,
          id: `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      }));
      setExpenses(prev => [...prev, ...newExpenses]);
  };

  const updateExpense = (updatedExpense: Expense) => {
    setExpenses(prev => prev.map(exp => exp.id === updatedExpense.id ? updatedExpense : exp));
  };
  
  const deleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(exp => exp.id !== id));
    setInvoices(prev => prev.map(inv => ({
      ...inv,
      attachedExpenseIds: (inv.attachedExpenseIds || []).filter(expId => expId !== id)
    })));
  };

  const deleteAllExpenses = () => {
    setExpenses([]);
    setInvoices(prev => prev.map(inv => ({
        ...inv,
        attachedExpenseIds: []
    })));
    setProcessedFiles([]); // Clear processed files history
  };

  const getCompany = (id: string) => companies.find(c => c.id === id);

  const addCompany = (companyData: Omit<Company, 'id'>) => {
    const newCompany: Company = {
      ...companyData,
      id: `comp-${Date.now()}`,
    };
    setCompanies(prev => [...prev, newCompany]);
    return newCompany;
  };

  const updateCompany = (updatedCompany: Company) => {
    setCompanies(prev => prev.map(c => c.id === updatedCompany.id ? updatedCompany : c));
  };

  const addInvoice = (invoiceData: Omit<Invoice, 'id' | 'invoiceNumber'>): Invoice => {
    const newInvoiceNumber = Math.max(0, ...invoices.map(inv => inv.invoiceNumber)) + 1;
    const newInvoice: Invoice = {
      ...invoiceData,
      id: `inv-${Date.now()}`,
      invoiceNumber: newInvoiceNumber,
    };
    setInvoices(prev => [newInvoice, ...prev]);
    return newInvoice;
  };

  const updateInvoice = (updatedInvoice: Invoice) => {
    setInvoices(prev => prev.map(inv => inv.id === updatedInvoice.id ? updatedInvoice : inv));
  };

  const deleteInvoice = (id: string) => {
    // 1. Remove the invoice
    setInvoices(prev => prev.filter(inv => inv.id !== id));
    
    // 2. Detach expenses that were linked to this invoice
    setExpenses(prev => prev.map(exp => {
        if (exp.billedToInvoiceId === id) {
            return { ...exp, billedToInvoiceId: undefined };
        }
        return exp;
    }));
  };

  const importInvoiceWithExpenses = (
    invoiceData: Omit<Invoice, 'id' | 'invoiceNumber' | 'attachedExpenseIds' | 'items'> & { items: Omit<InvoiceItem, 'id'>[], invoiceNumber?: number },
    expensesData: Omit<Expense, 'id'>[]
  ) => {
      const newInvoiceId = `inv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const newExpenses: Expense[] = expensesData.map(expData => ({
          ...expData,
          id: `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          billedToInvoiceId: newInvoiceId,
      }));
      const newExpenseIds = newExpenses.map(exp => exp.id);
      
      let newInvoiceNumber = invoiceData.invoiceNumber;
      if (newInvoiceNumber === undefined) {
         newInvoiceNumber = Math.max(0, ...invoices.map(inv => inv.invoiceNumber)) + 1;
      }

      const newInvoice: Invoice = {
          ...(invoiceData as any), // Cast to handle the omitted but optional invoiceNumber logic
          id: newInvoiceId,
          invoiceNumber: newInvoiceNumber,
          attachedExpenseIds: newExpenseIds,
          items: invoiceData.items.map(item => ({
            ...item,
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          }))
      };

      setInvoices(prev => [newInvoice, ...prev]);
      setExpenses(prev => [...prev, ...newExpenses]);
  };

  // --- Folder Linking Logic ---

  const linkFolder = async (type: 'expenses' | 'billable') => {
    if (!isFileSystemSupported) {
      alert("Folder Linking is not supported on this browser or device. Please use the 'Manual Import' button.");
      return;
    }
    try {
      const handle = await (window as any).showDirectoryPicker();
      if (type === 'expenses') {
        setExpensesFolderHandle(handle);
      } else {
        setBillableFolderHandle(handle);
      }
    } catch (err) {
      console.error("Folder linking cancelled or failed", err);
    }
  };

  const unlinkFolder = (type: 'expenses' | 'billable') => {
    if (type === 'expenses') {
      setExpensesFolderHandle(null);
    } else {
      setBillableFolderHandle(null);
    }
  };

  // Polling / Watching logic
  useEffect(() => {
    if (!isFileSystemSupported) return;
    if (!expensesFolderHandle && !billableFolderHandle) return;

    const processFile = async (file: File, isBillable: boolean) => {
      const reader = new FileReader();
      return new Promise<void>((resolve) => {
        reader.onloadend = async () => {
          try {
            const base64String = (reader.result as string).split(',')[1];
            
            // Use current expenseCategories from state in closure or pass it if needed, 
            // but for simplicity in effect, using default or context logic
            const ocrResult = await extractReceiptData(base64String, file.type, expenseCategories);
            
            const cadAmount = await convertToCAD(
                ocrResult ? ocrResult.amount : 0, 
                ocrResult ? ocrResult.currency : 'CAD', 
                ocrResult ? ocrResult.date : new Date().toISOString().split('T')[0]
            );

            const newExpense: Omit<Expense, 'id'> = {
                date: ocrResult ? ocrResult.date : new Date().toISOString().split('T')[0],
                description: ocrResult ? ocrResult.description : file.name,
                amount: ocrResult ? ocrResult.amount : 0,
                currency: ocrResult ? ocrResult.currency : 'CAD',
                cadAmount: cadAmount,
                category: ocrResult ? ocrResult.category : 'Misc',
                receiptUrl: reader.result as string,
                isBillable: isBillable,
            };
            
            setExpenses(prev => [...prev, {
              ...newExpense,
              id: `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            }]);
            
            setProcessedFiles(prev => [...prev, file.name]);
            resolve();
          } catch (e) {
            console.error("Error processing auto-scan file", e);
            resolve(); // Resolve anyway to continue
          }
        };
        reader.readAsDataURL(file);
      });
    };

    const verifyPermission = async (handle: FileSystemDirectoryHandle): Promise<boolean> => {
        try {
            const opts = { mode: 'read' as const };
            if ((await handle.queryPermission(opts)) === 'granted') {
                return true;
            }
            // We cannot request permission inside a loop/interval, so if it's not granted, we fail gracefully
            return false;
        } catch (e) {
            return false;
        }
    }

    const scan = async () => {
      if (isScanning) return;
      setIsScanning(true);

      const handles = [
        { handle: expensesFolderHandle, isBillable: false },
        { handle: billableFolderHandle, isBillable: true }
      ];

      for (const { handle, isBillable } of handles) {
        if (!handle) continue;
        
        // Critical Fix: Verify permission before iterating. 
        // Failing to do so causes "glitches" or crashes in some browsers.
        const hasPermission = await verifyPermission(handle);
        if (!hasPermission) {
            console.warn("Permission lost for folder handle.");
            continue;
        }

        try {
          for await (const [name, entry] of handle.entries()) {
            if (entry.kind === 'file') {
              if (processedFiles.includes(name)) continue;

              // Filter for images/pdfs
              if (!name.match(/\.(jpg|jpeg|png|webp|pdf)$/i)) continue;

              const fileHandle = entry as FileSystemFileHandle;
              const file = await fileHandle.getFile();
              
              await processFile(file, isBillable);
              
              // Process one at a time to avoid rate limits
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        } catch (err) {
            console.error("Error scanning folder:", err);
        }
      }
      setIsScanning(false);
    };

    const intervalId = setInterval(scan, 10000); // Increased interval to 10s to reduce load
    
    // Run immediate scan on mount/link
    scan();

    return () => clearInterval(intervalId);
  }, [expensesFolderHandle, billableFolderHandle, processedFiles, isScanning, isFileSystemSupported]);

  return (
    <AppContext.Provider value={{
      companies, setCompanies,
      invoices, setInvoices,
      expenses, setExpenses,
      expenseCategories,
      addExpenseCategory,
      updateExpenseCategory,
      deleteExpenseCategory,
      addExpense,
      addExpenses,
      updateExpense,
      deleteExpense,
      deleteAllExpenses,
      getCompany,
      addCompany,
      updateCompany,
      addInvoice,
      updateInvoice,
      deleteInvoice,
      importInvoiceWithExpenses,
      userProfile,
      updateUserProfile,
      // Folder Linking
      linkFolder,
      unlinkFolder,
      expensesFolderLinked: !!expensesFolderHandle,
      billableFolderLinked: !!billableFolderHandle,
      expensesFolderName: expensesFolderHandle?.name || '',
      billableFolderName: billableFolderHandle?.name || '',
      isScanning,
      isFileSystemSupported
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
