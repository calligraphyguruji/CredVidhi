import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { OfficerQueue } from './pages/staff/OfficerQueue';
import { DocumentWorkbench } from './pages/staff/DocumentWorkbench';
import { UnderwritingCockpit } from './pages/staff/UnderwritingCockpit';
import { BorrowerPortal } from './pages/applicant/BorrowerPortal';
import { ComplianceAudit } from './pages/admin/ComplianceAudit';
import { LoanProducts } from './pages/admin/LoanProducts';

const MainContent: React.FC = () => {
  const { activeView } = useApp();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Navigation Sidebar */}
      <Sidebar />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col pl-64 min-w-0">
        <Header />

        {/* Dynamic Viewport Container */}
        <main className="flex-1 pt-14 p-6 overflow-y-auto max-w-7xl w-full mx-auto">
          {activeView === 'officer-queue' && <OfficerQueue />}
          {activeView === 'document-workbench' && <DocumentWorkbench />}
          {activeView === 'underwriting-cockpit' && <UnderwritingCockpit />}
          {activeView === 'borrower-portal' && <BorrowerPortal />}
          {activeView === 'compliance-audit' && <ComplianceAudit />}
          {activeView === 'loan-products' && <LoanProducts />}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
};

export default App;
