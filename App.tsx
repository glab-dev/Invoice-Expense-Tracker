
import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
import DashboardTab from './tabs/DashboardTab';
import InvoicesTab from './tabs/InvoicesTab';
import ExpensesTab from './tabs/ExpensesTab';
import SettingsTab from './tabs/SettingsTab';
import TabButton from './components/TabButton';

type Tab = 'DASHBOARD' | 'INVOICES' | 'EXPENSES' | 'SETTINGS';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('DASHBOARD');

  const renderTab = () => {
    switch (activeTab) {
      case 'DASHBOARD':
        return <DashboardTab />;
      case 'INVOICES':
        return <InvoicesTab />;
      case 'EXPENSES':
        return <ExpensesTab />;
      case 'SETTINGS':
        return <SettingsTab />;
      default:
        return <DashboardTab />;
    }
  };

  return (
    <AppProvider>
      <div className="bg-black min-h-screen text-green-500 text-lg p-2 sm:p-4 md:p-6 crt">
        <div className="max-w-7xl mx-auto border-4 border-green-500 pixel-corners bg-black bg-opacity-20">
          <header className="p-4 border-b-4 border-green-500 flex flex-wrap justify-between items-center gap-y-2">
            <h1 className="font-press-start text-base sm:text-xl md:text-2xl text-yellow-400">
              Retro Invoice & Expense Tracker
            </h1>
            <div className="w-8 h-8 bg-red-500 border-2 border-green-500 animate-pulse"></div>
          </header>

          <main className="p-2 sm:p-4 md:p-6 min-h-[calc(100vh-200px)]">
            {renderTab()}
          </main>

          <nav className="p-2 border-t-4 border-green-500 grid grid-cols-2 sm:flex sm:justify-center gap-2">
            <TabButton onClick={() => setActiveTab('DASHBOARD')} active={activeTab === 'DASHBOARD'}>
              Dashboard
            </TabButton>
            <TabButton onClick={() => setActiveTab('INVOICES')} active={activeTab === 'INVOICES'}>
              Invoices
            </TabButton>
            <TabButton onClick={() => setActiveTab('EXPENSES')} active={activeTab === 'EXPENSES'}>
              Expenses
            </TabButton>
            <TabButton onClick={() => setActiveTab('SETTINGS')} active={activeTab === 'SETTINGS'}>
              Settings
            </TabButton>
          </nav>
        </div>
      </div>
    </AppProvider>
  );
};

export default App;
