import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { toastVariants } from '../../utils/motion';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const icon = {
            success: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />,
            error: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />,
            warning: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,
            info: <Info className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />,
          }[toast.type];

          const borderBg = {
            success: 'border-emerald-200 bg-white/95 text-slate-900',
            error: 'border-rose-200 bg-white/95 text-slate-900',
            warning: 'border-amber-200 bg-white/95 text-slate-900',
            info: 'border-orange-200 bg-white/95 text-slate-900',
          }[toast.type];

          return (
            <motion.div
              key={toast.id}
              layout={!shouldReduceMotion}
              variants={shouldReduceMotion ? undefined : toastVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className={`pointer-events-auto p-3.5 rounded-lg border shadow-lg backdrop-blur-md flex items-start justify-between gap-3 ${borderBg}`}
            >
              <div className="flex items-start gap-2.5">
                {icon}
                <div>
                  <h4 className="text-xs font-semibold leading-tight text-slate-900">
                    {toast.title}
                  </h4>
                  {toast.message && (
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      {toast.message}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => onDismiss(toast.id)}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                aria-label="Close notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
