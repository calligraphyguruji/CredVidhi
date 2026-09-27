import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { LandingPage } from './pages/public/LandingPage';
import { LoginPage } from './pages/public/LoginPage';
import { OfficerQueue } from './pages/staff/OfficerQueue';
import { DocumentWorkbench } from './pages/staff/DocumentWorkbench';
import { UnderwritingCockpit } from './pages/staff/UnderwritingCockpit';
import { BorrowerPortal } from './pages/applicant/BorrowerPortal';
import { ComplianceAudit } from './pages/admin/ComplianceAudit';
import { LoanProducts } from './pages/admin/LoanProducts';
import { pageTransitionVariants } from './utils/motion';
import { Analytics } from '@vercel/analytics/react';

const MainContent: React.FC = () => {
  const { activeView } = useApp();
  const shouldReduceMotion = useReducedMotion();

  const activePageVariants = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      }
    : pageTransitionVariants;

  return (
    <AnimatePresence mode="wait">
      {activeView === 'landing' ? (
        <motion.div
          key="landing"
          variants={activePageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="w-full"
        >
          <LandingPage />
        </motion.div>
      ) : activeView === 'login' ? (
        <motion.div
          key="login"
          variants={activePageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="w-full"
        >
          <LoginPage />
        </motion.div>
      ) : (
        <motion.div
          key="app-shell"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2 } }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          className="min-h-screen bg-slate-50 flex"
        >
          {/* Navigation Sidebar */}
          <Sidebar />

          {/* Main App Container */}
          <div className="flex-1 flex flex-col pl-64 min-w-0">
            <Header />

            {/* Dynamic Viewport Container with Page Transition */}
            <main className="flex-1 pt-14 p-6 overflow-y-auto max-w-7xl w-full mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeView}
                  variants={activePageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full"
                >
                  {activeView === 'officer-queue' && <OfficerQueue />}
                  {activeView === 'document-workbench' && <DocumentWorkbench />}
                  {activeView === 'underwriting-cockpit' && <UnderwritingCockpit />}
                  {activeView === 'borrower-portal' && <BorrowerPortal />}
                  {activeView === 'compliance-audit' && <ComplianceAudit />}
                  {activeView === 'loan-products' && <LoanProducts />}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <MainContent />
      <Analytics />
    </AppProvider>
  );
};

export default App;
