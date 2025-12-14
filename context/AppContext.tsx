
import React, { createContext, useContext, useState } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { Company, Invoice, Expense, InvoiceItem, UserProfile } from '../types';
import { MOCK_COMPANIES, MOCK_EXPENSES, MOCK_INVOICES, DEFAULT_EXPENSE_CATEGORIES } from '../constants';

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
  updateExpense: (expense: Expense) => void;
  getCompany: (id: string) => Company | undefined;
  addCompany: (company: Omit<Company, 'id'>) => Company;
  updateCompany: (company: Company) => void;
  addInvoice: (invoice: Omit<Invoice, 'id' | 'invoiceNumber'>) => Invoice;
  updateInvoice: (invoice: Invoice) => void;
  importInvoiceWithExpenses: (
    invoiceData: Omit<Invoice, 'id' | 'invoiceNumber' | 'attachedExpenseIds'>,
    expensesData: Omit<Expense, 'id'>[]
  ) => void;
  userProfile: UserProfile;
  updateUserProfile: (profile: UserProfile) => void;
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
    // Also update all expenses using the old category
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

  const updateExpense = (updatedExpense: Expense) => {
    setExpenses(prev => prev.map(exp => exp.id === updatedExpense.id ? updatedExpense : exp));
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

  const importInvoiceWithExpenses = (
    invoiceData: Omit<Invoice, 'id' | 'invoiceNumber' | 'attachedExpenseIds' | 'items'> & { items: Omit<InvoiceItem, 'id'>[] },
    expensesData: Omit<Expense, 'id'>[]
  ) => {
      const newInvoiceId = `inv-${Date.now()}`;
      const newExpenses: Expense[] = expensesData.map(expData => ({
          ...expData,
          id: `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          billedToInvoiceId: newInvoiceId,
      }));
      const newExpenseIds = newExpenses.map(exp => exp.id);
      const newInvoiceNumber = Math.max(0, ...invoices.map(inv => inv.invoiceNumber)) + 1;
      const newInvoice: Invoice = {
          ...(invoiceData as Omit<Invoice, 'id' | 'invoiceNumber'>),
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
      updateExpense,
      getCompany,
      addCompany,
      updateCompany,
      addInvoice,
      updateInvoice,
      importInvoiceWithExpenses,
      userProfile,
      updateUserProfile,
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
