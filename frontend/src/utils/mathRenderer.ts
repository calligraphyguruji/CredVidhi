import React from 'react';
import type { Components, ExtraProps } from 'react-markdown';

type ElementProps<T extends keyof React.JSX.IntrinsicElements> = React.ComponentPropsWithoutRef<T> & ExtraProps;

/**
 * Normalizes LaTeX math expressions in AI responses so react-markdown and rehype-katex
 * render both inline ($...$, \(...\)) and block ($$...$$, \[...\]) formulas accurately.
 * Handles double-escaped backslashes (e.g. \\frac -> \frac) without corrupting text,
 * and shields currency dollar figures from accidental math parsing.
 */
export function preprocessLaTeX(content: string): string {
  if (!content) return '';

  // 1. Protect unescaped currency figures ($500, $1,000) while guarding pre-escaped figures (\$500)
  let text = content.replace(/(^|[^$\\])\$(\d[\d,.]*)/g, (_m, prefix, num) => `${prefix}\\$${num}`);

  // 2. Convert \[ ... \] display math to standard $$ ... $$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_m, formula) => `\n\n$$\n${formula.trim()}\n$$\n\n`);

  // 3. Convert \( ... \) inline math to $ ... $
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_m, formula) => `$${formula.trim()}$`);

  // 4. Ensure $$...$$ block math has distinct newlines so CommonMark/remark-math treats it as display mode
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_m, formula) => `\n\n$$\n${formula.trim()}\n$$\n\n`);

  // 5. Normalize double-escaped LaTeX commands (e.g., \\frac, \\text, \\times) inside math delimiters
  text = text.replace(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g, (math) => {
    return math.replace(/\\\\([a-zA-Z]+)/g, '\\$1');
  });

  return text;
}

export const chatMarkdownComponents: Components = {
  h1: ({ children, node: _node, ...props }: ElementProps<'h1'>) =>
    React.createElement('h3', { className: 'font-bold text-sm text-orange-600 dark:text-orange-400 mt-2 mb-1', ...props }, children),
  h2: ({ children, node: _node, ...props }: ElementProps<'h2'>) =>
    React.createElement('h3', { className: 'font-bold text-sm text-orange-600 dark:text-orange-400 mt-2 mb-1', ...props }, children),
  h3: ({ children, node: _node, ...props }: ElementProps<'h3'>) =>
    React.createElement('h4', { className: 'font-bold text-xs sm:text-sm text-slate-900 dark:text-white mt-1.5 mb-1', ...props }, children),
  h4: ({ children, node: _node, ...props }: ElementProps<'h4'>) =>
    React.createElement('h5', { className: 'font-bold text-xs text-slate-800 dark:text-slate-100 mt-1 mb-0.5', ...props }, children),
  p: ({ children, node: _node, ...props }: ElementProps<'p'>) =>
    React.createElement('p', { className: 'my-1.5 leading-relaxed text-slate-800 dark:text-slate-100', ...props }, children),
  ul: ({ children, node: _node, ...props }: ElementProps<'ul'>) =>
    React.createElement('ul', { className: 'my-1.5 space-y-1 list-disc list-outside pl-4 marker:text-orange-500 text-slate-800 dark:text-slate-100', ...props }, children),
  ol: ({ children, node: _node, ...props }: ElementProps<'ol'>) =>
    React.createElement('ol', { className: 'my-1.5 space-y-1 list-decimal list-outside pl-4 marker:text-orange-600 dark:marker:text-orange-400 text-slate-800 dark:text-slate-100 font-normal', ...props }, children),
  li: ({ children, node: _node, ...props }: ElementProps<'li'>) =>
    React.createElement('li', { className: 'my-0.5 leading-relaxed pl-0.5', ...props }, children),
  strong: ({ children, node: _node, ...props }: ElementProps<'strong'>) =>
    React.createElement('strong', { className: 'font-semibold text-slate-900 dark:text-white', ...props }, children),
  em: ({ children, node: _node, ...props }: ElementProps<'em'>) =>
    React.createElement('em', { className: 'italic', ...props }, children),
  code: ({ className, children, node: _node, ...props }: ElementProps<'code'>) =>
    React.createElement(
      'code',
      {
        className: `bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-mono text-orange-600 dark:text-orange-400 border border-slate-200 dark:border-slate-700/80 ${className || ''}`,
        ...props,
      },
      children
    ),
  pre: ({ children, node: _node, ...props }: ElementProps<'pre'>) =>
    React.createElement('pre', { className: 'my-2 p-2.5 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto border border-slate-800', ...props }, children),
  blockquote: ({ children, node: _node, ...props }: ElementProps<'blockquote'>) =>
    React.createElement('blockquote', { className: 'border-l-2 border-orange-500 pl-3 my-2 text-slate-600 dark:text-slate-300 italic', ...props }, children),
  a: ({ href, children, node: _node, ...props }: ElementProps<'a'>) =>
    React.createElement(
      'a',
      {
        href,
        target: '_blank',
        rel: 'noopener noreferrer',
        className: 'text-orange-600 dark:text-orange-400 underline font-medium hover:text-orange-700 dark:hover:text-orange-300 transition-colors',
        ...props,
      },
      children
    ),
};
