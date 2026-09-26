import React, { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { modalBackdropVariants, modalDialogVariants } from '../../utils/motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
}) => {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = prevOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[maxWidth];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            variants={shouldReduceMotion ? undefined : modalBackdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={onClose}
          />

          {/* Modal Dialog */}
          <motion.div
            variants={shouldReduceMotion ? undefined : modalDialogVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={`relative w-full ${widthClasses} bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden z-10`}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
              <div>
                <h3 className="text-base font-semibold text-slate-900 leading-tight">{title}</h3>
                {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 rounded p-1 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 max-h-[75vh] overflow-y-auto">{children}</div>

            {footer && (
              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
