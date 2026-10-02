import React from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  interactive?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  headerAction,
  footer,
  interactive = false,
  onClick,
}) => {
  const shouldReduceMotion = useReducedMotion();

  const motionProps: HTMLMotionProps<'div'> =
    interactive && !shouldReduceMotion
      ? {
          whileHover: { y: -2, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
          whileTap: onClick ? { scale: 0.995 } : undefined,
        }
      : {};

  const commonClasses = `bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 shadow-xs transition-[border-color,box-shadow,background-color] duration-200 overflow-hidden ${
    interactive ? 'hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md cursor-pointer' : ''
  } ${className}`;

  const content = (
    <>
      {(title || subtitle || headerAction) && (
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/40">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
      {footer && <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800">{footer}</div>}
    </>
  );

  if (interactive) {
    return (
      <motion.div
        onClick={onClick}
        {...motionProps}
        className={commonClasses}
      >
        {content}
      </motion.div>
    );
  }

  return (
    <div onClick={onClick} className={commonClasses}>
      {content}
    </div>
  );
};
