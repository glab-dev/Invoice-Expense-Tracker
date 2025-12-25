
import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
import DashboardTab from './tabs/DashboardTab';
import InvoicesTab from './tabs/InvoicesTab';
import ExpensesTab from './tabs/ExpensesTab';
import SettingsTab from './tabs/SettingsTab';
import TabButton from './components/TabButton';
import VersionChecker from './components/VersionChecker';

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
      <div className="min-h-screen p-2 sm:p-4 md:p-8">
        <VersionChecker />
        <div className="max-w-7xl mx-auto border-[4px] border-black bg-gray-800 comic-shadow relative">
          
          {/* Header Section */}
          <header className="p-4 sm:p-6 border-b-[4px] border-black bg-red-600 flex flex-wrap justify-between items-center gap-y-2 relative overflow-hidden">
             {/* Decorative Speed Lines */}
            <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_12px)] pointer-events-none"></div>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl text-white drop-shadow-[3px_3px_0_rgba(0,0,0,1)] transform -rotate-1 relative z-10">
              INVOICE/EXPENSE TRACKER
            </h1>
            <div className="bg-yellow-400 border-2 border-black px-3 py-1 font-comic-title text-black transform rotate-2 shadow-[2px_2px_0_black]">
              POW! BAM! PAID!
            </div>
          </header>

          <nav className="p-4 bg-gray-900 border-b-[4px] border-black flex flex-wrap justify-center gap-2 sm:gap-4 overflow-x-auto">
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

          <main className="p-4 sm:p-6 md:p-8 min-h-[calc(100vh-300px)] bg-gray-800 text-white">
            {renderTab()}
          </main>
          
          <footer className="bg-black text-gray-400 p-2 text-center font-bold text-xs uppercase tracking-widest border-t-[4px] border-black">
            Fearless Wanderer Productions
          </footer>
        </div>
      </div>
    </AppProvider>
  );
};

export default App;
