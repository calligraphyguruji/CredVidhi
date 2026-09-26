import React from 'react';
import { motion, type HTMLMotionProps, useReducedMotion } from 'framer-motion';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const shouldReduceMotion = useReducedMotion();

  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150';

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-3.5 py-2 gap-2',
    lg: 'text-base px-4 py-2.5 gap-2.5',
  }[size];

  const variantClasses = {
    primary:
      'bg-orange-600 text-white hover:bg-orange-700 shadow-sm border border-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-1',
    secondary:
      'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200 shadow-sm',
    outline:
      'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-sm',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 shadow-sm border border-rose-700 focus:ring-2 focus:ring-rose-500',
    success:
      'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm border border-emerald-700 focus:ring-2 focus:ring-emerald-500',
    ghost:
      'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
  }[variant];

  const isInteractive = !disabled && !isLoading;

  return (
    <motion.button
      whileHover={!shouldReduceMotion && isInteractive ? { scale: 1.01 } : undefined}
      whileTap={!shouldReduceMotion && isInteractive ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </motion.button>
  );
};
