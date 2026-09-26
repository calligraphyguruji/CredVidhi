import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  prefixText?: string;
  suffixText?: string;
  isMono?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  prefixText,
  suffixText,
  isMono = false,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center rounded-md shadow-sm">
        {prefixText && (
          <span className="inline-flex items-center px-3 text-sm text-slate-500 bg-slate-50 border border-r-0 border-slate-300 rounded-l-md font-mono select-none">
            {prefixText}
          </span>
        )}
        <input
          id={inputId}
          className={`block w-full text-sm text-slate-900 border ${
            error ? 'border-rose-500 focus:ring-rose-500 focus:border-rose-500' : 'border-slate-300 focus:ring-orange-500 focus:border-orange-500'
          } ${prefixText ? 'rounded-l-none' : 'rounded-l-md'} ${
            suffixText ? 'rounded-r-none' : 'rounded-r-md'
          } px-3 py-2 bg-white placeholder-slate-400 focus:outline-none focus:ring-1 transition-colors ${
            isMono ? 'font-mono' : ''
          } ${className}`}
          {...props}
        />
        {suffixText && (
          <span className="inline-flex items-center px-3 text-sm text-slate-500 bg-slate-50 border border-l-0 border-slate-300 rounded-r-md select-none">
            {suffixText}
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">⚠ {error}</p>}
      {!error && helperText && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
    </div>
  );
};
