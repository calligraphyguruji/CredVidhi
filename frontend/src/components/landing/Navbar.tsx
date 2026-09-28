import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ShieldCheck, Menu, X, ArrowRight, Lock, Sun, Moon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';

interface NavbarProps {
  onNavigateSection?: (sectionId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigateSection }) => {
  const { setActiveView, theme, toggleTheme } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

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
    { label: 'FAQ', id: 'faq' },
  ];

  return (
    <motion.header
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 transition-all"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & System Marker */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => setActiveView('landing')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-md bg-orange-600 text-white flex items-center justify-center font-bold shadow-xs group-hover:bg-orange-700 transition-colors">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-slate-900 font-sans">
                  CredVidhi
                </span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200/80">
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
              className="text-xs font-semibold text-slate-600 hover:text-orange-600 transition-colors cursor-pointer"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Action Buttons & Portal Switchers */}
        <div className="hidden sm:flex items-center gap-2.5">
          {/* Light / Dark Mode Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:text-orange-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          <motion.button
            whileHover={!shouldReduceMotion ? { scale: 1.02 } : undefined}
            whileTap={!shouldReduceMotion ? { scale: 0.98 } : undefined}
            onClick={() => setActiveView('login-staff')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-orange-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Staff SSO</span>
          </motion.button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveView('login');
            }}
          >
            Track Application
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setActiveView('register');
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
            className="p-2 text-slate-600 hover:text-slate-900 rounded focus:outline-none cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer with AnimatePresence */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="sm:hidden border-b border-slate-200 bg-white px-4 pt-3 pb-5 space-y-3 shadow-lg overflow-hidden"
          >
            <div className="flex flex-col space-y-2">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollTo(link.id)}
                  className="text-left text-sm font-semibold text-slate-700 hover:text-orange-600 py-1.5 transition-colors cursor-pointer"
                >
                  {link.label}
                </button>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center justify-between px-3 py-2 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span>Interface Theme</span>
                <span className="flex items-center gap-1.5 font-semibold text-orange-600">
                  {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
                  {theme === 'dark' ? 'Dark' : 'Light'}
                </span>
              </button>
              <Button
                variant="primary"
                className="w-full justify-center"
                onClick={() => {
                  setActiveView('register');
                }}
              >
                Apply for Loan
              </Button>
              <Button
                variant="outline"
                className="w-full justify-center"
                onClick={() => setActiveView('login')}
              >
                Track Application
              </Button>
              <Button
                variant="outline"
                className="w-full justify-center"
                onClick={() => setActiveView('login-staff')}
              >
                Sign In (Staff & Underwriters)
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};
