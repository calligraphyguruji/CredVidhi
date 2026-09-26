import React, { useState } from 'react';
import { ShieldCheck, Menu, X, ArrowRight, Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';

interface NavbarProps {
  onNavigateSection?: (sectionId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigateSection }) => {
  const { setActiveView, switchRole } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    if (onNavigateSection) {
      onNavigateSection(id);
    } else {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const navLinks = [
    { label: 'Products', id: 'products' },
    { label: 'Underwriting Engine', id: 'engine' },
    { label: 'Workflow', id: 'workflow' },
    { label: 'Security & Audit', id: 'security' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & System Marker */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => setActiveView('landing')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-md bg-blue-700 text-white flex items-center justify-center font-bold shadow-xs group-hover:bg-blue-800 transition-colors">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-slate-900 font-sans">
                  CredVidhi
                </span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/80">
                  ENTERPRISE
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-500 hidden sm:block">
                Deterministic Credit & Lending Infrastructure
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => scrollTo(link.id)}
              className="text-xs font-semibold text-slate-600 hover:text-blue-700 transition-colors cursor-pointer"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Action Buttons & Portal Switchers */}
        <div className="hidden sm:flex items-center gap-2.5">
          <button
            onClick={() => setActiveView('login')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700 rounded-md hover:bg-slate-100 transition-colors"
          >
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Staff SSO</span>
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              switchRole('APPLICANT');
              setActiveView('borrower-portal');
            }}
          >
            Track Application
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              switchRole('APPLICANT');
              setActiveView('borrower-portal');
            }}
            icon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Apply for Loan
          </Button>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex sm:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 hover:text-slate-900 rounded focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-b border-slate-200 bg-white px-4 pt-3 pb-5 space-y-3 shadow-lg animate-in slide-in-from-top-2 duration-150">
          <div className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className="text-left text-sm font-semibold text-slate-700 hover:text-blue-700 py-1.5 transition-colors"
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            <Button
              variant="primary"
              className="w-full justify-center"
              onClick={() => {
                switchRole('APPLICANT');
                setActiveView('borrower-portal');
              }}
            >
              Apply for Loan (Applicant Portal)
            </Button>
            <Button
              variant="outline"
              className="w-full justify-center"
              onClick={() => setActiveView('login')}
            >
              Sign In (Staff & Underwriters)
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};
