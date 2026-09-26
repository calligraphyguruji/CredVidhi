import React from 'react';
import { ArrowRight, ShieldCheck, Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Navbar } from '../../components/landing/Navbar';
import { HeroSection } from '../../components/landing/HeroSection';
import { WorkflowSection } from '../../components/landing/WorkflowSection';
import { KeyCapabilities } from '../../components/landing/KeyCapabilities';
import { ProductPreview } from '../../components/landing/ProductPreview';
import { LoanProductsGrid } from '../../components/landing/LoanProductsGrid';
import { SecurityTrustSection } from '../../components/landing/SecurityTrustSection';
import { Footer } from '../../components/landing/Footer';
import { Button } from '../../components/ui/Button';

export const LandingPage: React.FC = () => {
  const { setActiveView, switchRole } = useApp();

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Institutional Top Navbar */}
      <Navbar />

      {/* Main Content Sections */}
      <main className="flex-1">
        {/* 1. Hero Section with Live EMI Calculator */}
        <HeroSection />

        {/* 2. 6-Stage Finite State Machine Workflow */}
        <WorkflowSection />

        {/* 3. Core Engine Capabilities Bento Grid */}
        <KeyCapabilities />

        {/* 4. Realistic Workspace Product Preview */}
        <ProductPreview />

        {/* 5. Configured Loan Products & Terms */}
        <LoanProductsGrid />

        {/* 6. Security, Privacy & Compliance Safeguards */}
        <SecurityTrustSection />

        {/* 7. Strategic Conversion CTA Section */}
        <section className="py-16 md:py-24 bg-slate-950 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.15),transparent_50%)] pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/60 border border-blue-700/60 text-blue-300 text-xs font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>EXPERIENCE THE PRODUCTION DEMO</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl mx-auto leading-tight">
              Ready to streamline your loan processing pipeline?
            </h2>

            <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Explore the loan officer document workbench, trigger automated risk evaluations,
              and test the multi-step borrower application workflow in real time.
            </p>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  switchRole('LOAN_OFFICER');
                  setActiveView('officer-queue');
                }}
                icon={<ArrowRight className="w-4 h-4" />}
                className="bg-blue-600 hover:bg-blue-500 shadow-md font-bold"
              >
                Enter Officer Queue Demo
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => setActiveView('login')}
                icon={<Lock className="w-4 h-4" />}
                className="border-slate-700 text-slate-200 hover:bg-slate-800"
              >
                Sign In to Staff Console
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Institutional Footer */}
      <Footer />
    </div>
  );
};
