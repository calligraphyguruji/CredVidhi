import React from 'react';
import { Check } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

interface StepperStep {
  label: string;
  description?: string;
}

interface StepperProps {
  steps: StepperStep[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export const Stepper: React.FC<StepperProps> = ({ steps, currentStep, onStepClick }) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center">
        {steps.map((step, idx) => {
          const stepNum = idx + 1;
          const isCompleted = stepNum < currentStep;
          const isActive = stepNum === currentStep;
          const isClickable = onStepClick && (isCompleted || isActive);

          return (
            <li key={idx} className={`relative flex-1 ${idx < steps.length - 1 ? '' : ''}`}>
              <div className="flex items-center">
                {/* Step Circle */}
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick?.(stepNum)}
                  disabled={!isClickable}
                  className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 transition-all shrink-0 ${
                    isCompleted
                      ? 'bg-orange-600 border-orange-600 text-white cursor-pointer'
                      : isActive
                        ? 'bg-white border-orange-600 text-orange-600 ring-4 ring-orange-100'
                        : 'bg-white border-slate-300 text-slate-400'
                  } ${isClickable ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <motion.div
                      initial={shouldReduceMotion ? undefined : { scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <Check className="w-4 h-4" />
                    </motion.div>
                  ) : (
                    stepNum
                  )}
                </button>

                {/* Connector Line */}
                {idx < steps.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2">
                    <div
                      className={`h-full rounded transition-colors duration-300 ${
                        isCompleted ? 'bg-orange-600' : 'bg-slate-200'
                      }`}
                    />
                  </div>
                )}
              </div>

              {/* Label below circle */}
              <div className="mt-1.5 pr-4">
                <span
                  className={`block text-[11px] font-semibold leading-tight ${
                    isActive ? 'text-orange-600' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
                {step.description && (
                  <span className="block text-[10px] text-slate-400 mt-0.5 leading-snug">
                    {step.description}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
