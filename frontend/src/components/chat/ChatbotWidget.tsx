import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Send,
  X,
  RotateCcw,
  Bot,
  User,
  ChevronDown,
} from 'lucide-react';
import { chatApi, type ChatMessage } from '../../services/api';
import { useApp } from '../../context/AppContext';

interface UIProps {
  initialOpen?: boolean;
}

const DEFAULT_SUGGESTIONS = [
  '📊 What are your loan interest rates?',
  '📑 What KYC documents are required?',
  '🧮 How is my monthly EMI calculated?',
  '⏱️ How long does loan approval take?',
];

const INITIAL_GREETING: ChatMessage = {
  role: 'assistant',
  content:
    '### Namaste! Welcome to CredVidhi AI 🇮🇳\n\n' +
    'I am your AI financial advisor powered by **Google Gemini**. ' +
    'Ask me any question about our loan products, interest rates, KYC eligibility, or application tracking!',
};

export const ChatbotWidget: React.FC<UIProps> = ({ initialOpen = false }) => {
  const { currentUser } = useApp();
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETING]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [modelBadge, setModelBadge] = useState<string>('Gemini 3.8 Flash');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [isOpen, messages]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: query };
    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatApi.sendMessage({
        message: query,
        history: newHistory.slice(-6),
        context: currentUser ? { userId: currentUser.id, role: currentUser.role, name: currentUser.fullName } : undefined,
      });

      if (response && response.reply) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: response.reply },
        ]);
        if (response.suggested_questions && response.suggested_questions.length > 0) {
          setSuggestions(response.suggested_questions);
        }
        if (response.provider === 'gemini') {
          setModelBadge('Gemini 3.8 Flash');
        } else if (response.model) {
          setModelBadge(response.model);
        }
      }
    } catch {
      // Offline fallback handling
      const fallbackReply = getLocalOfflineResponse(query);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: fallbackReply },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([INITIAL_GREETING]);
    setSuggestions(DEFAULT_SUGGESTIONS);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <aside aria-label="Customer Support Chatbot" className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Floating Chat Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-[360px] sm:w-[420px] h-[580px] max-h-[82vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden mb-4"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 p-4 text-white flex items-center justify-between shadow-md">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-white font-bold">
                    <Bot className="w-5 h-5 text-amber-200" />
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full"></span>
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <h3 className="font-semibold text-sm leading-tight">CredVidhi AI</h3>
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-white/20 rounded-md text-amber-100 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      {modelBadge}
                    </span>
                  </div>
                  <p className="text-xs text-orange-100/90 font-medium">Customer Support & Underwriting</p>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={handleReset}
                  title="Clear conversation"
                  aria-label="Clear conversation"
                  className="p-1.5 hover:bg-white/20 rounded-xl transition text-white/90 hover:text-white"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="Close chat"
                  aria-label="Close chat"
                  className="p-1.5 hover:bg-white/20 rounded-xl transition text-white/90 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Conversation Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/60 dark:bg-slate-950/60">
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                        isUser
                          ? 'bg-orange-600 text-white'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                      }`}
                    >
                      {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </div>

                    <div
                      className={`max-w-[82%] px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        isUser
                          ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-tr-sm shadow-sm'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-sm shadow-sm'
                      }`}
                    >
                      <FormattedMarkdown text={msg.content} isUser={isUser} />
                    </div>
                  </motion.div>
                );
              })}

              {isLoading && (
                <div className="flex items-center gap-2 text-slate-400 text-xs pl-2">
                  <div className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-800 dark:text-amber-300">
                    <Bot className="w-3.5 h-3.5 animate-pulse" />
                  </div>
                  <div className="flex space-x-1.5 items-center bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-bounce"></span>
                    <span className="ml-1 text-[11px] text-slate-500 dark:text-slate-400">CredVidhi AI is thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestions Chips */}
            {suggestions.length > 0 && (
              <div className="px-4 py-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-1.5 overflow-x-auto no-scrollbar">
                {suggestions.map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSend(sug)}
                    className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800/60 hover:bg-orange-100 dark:hover:bg-orange-900/60 transition whitespace-nowrap"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}

            {/* Input Bar */}
            <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about loans, documents, rates..."
                aria-label="Ask CredVidhi AI a question"
                disabled={isLoading}
                className="flex-1 text-xs sm:text-sm bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 px-3.5 py-2.5 rounded-xl border border-transparent focus:border-orange-500 focus:outline-none transition disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
                className="w-9 h-9 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 text-white flex items-center justify-center hover:from-orange-700 hover:to-amber-700 disabled:opacity-40 transition shrink-0 shadow-md shadow-orange-500/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Trigger Button */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close customer support chat" : "Open customer support chat"}
        className="group relative flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 text-white shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 border border-white/20 transition-all cursor-pointer"
      >
        <div className="relative">
          <Bot className="w-5 h-5 text-amber-100 group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-orange-600 rounded-full animate-pulse"></span>
        </div>
        <span className="font-semibold text-xs tracking-wide uppercase">Ask AI</span>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 ml-0.5 text-white/80" />
        ) : (
          <Sparkles className="w-4 h-4 ml-0.5 text-amber-200 animate-spin [animation-duration:4s]" />
        )}
      </motion.button>
    </aside>
  );
};

/**
 * Lightweight markdown-like formatter for structured AI responses.
 */
const FormattedMarkdown: React.FC<{ text: string; isUser: boolean }> = ({ text, isUser }) => {
  if (isUser) {
    return <span>{text}</span>;
  }

  const lines = text.split('\n');

  return (
    <div className="space-y-1.5">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Headers
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white mt-1 mb-0.5">
              {trimmed.replace('### ', '')}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="font-bold text-sm text-orange-600 dark:text-orange-400 mt-1 mb-0.5">
              {trimmed.replace('## ', '')}
            </h3>
          );
        }

        // Bullet point
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const bulletText = trimmed.slice(2);
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1">
              <span className="text-orange-500 font-bold leading-tight">•</span>
              <span>{renderBoldSpans(bulletText)}</span>
            </div>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1">
              <span className="text-orange-600 dark:text-orange-400 font-semibold">{numMatch[1]}.</span>
              <span>{renderBoldSpans(numMatch[2])}</span>
            </div>
          );
        }

        return <p key={idx}>{renderBoldSpans(trimmed)}</p>;
      })}
    </div>
  );
};

function renderBoldSpans(str: string): React.ReactNode {
  const parts = str.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function getLocalOfflineResponse(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('rate') || q.includes('interest') || q.includes('apr')) {
    return (
      '### 📊 Current Loan Interest Rates\n\n' +
      '- **Home Prime Loan:** Starting at **8.5% p.a.**\n' +
      '- **Education Ascent:** Starting at **9.0% p.a.**\n' +
      '- **Auto Express:** Starting at **9.5% p.a.**\n' +
      '- **SME Growth:** Starting at **11.0% p.a.**\n' +
      '- **Personal Flexi Credit:** Starting at **12.5% p.a.**\n\n' +
      'All loans feature zero prepayment penalties on floating rates.'
    );
  }

  if (q.includes('document') || q.includes('kyc') || q.includes('pan')) {
    return (
      '### 📑 Required Documents\n\n' +
      '1. **PAN Card** (Mandatory for credit bureau lookup)\n' +
      '2. **Aadhaar Card** or Passport (Proof of Address)\n' +
      '3. **3 Months Salary Slips** (Income proof)\n' +
      '4. **6 Months Bank Statement** (PDF banking verification)'
    );
  }

  if (q.includes('emi') || q.includes('calculate') || q.includes('dti')) {
    return (
      '### 🧮 EMI & DTI Calculation\n\n' +
      'CredVidhi uses the deterministic standard compound interest amortization formula. ' +
      'Your Debt-to-Income (DTI) must be under **45% - 50%** for instant approval.'
    );
  }

  return (
    '### Welcome to CredVidhi Support! 🇮🇳\n\n' +
    'I can answer questions regarding:\n' +
    '- **Interest rates & loan products**\n' +
    '- **KYC verification & documents**\n' +
    '- **EMI calculation & DTI limits**\n' +
    '- **Application status tracking**\n\n' +
    'How can I help you today?'
  );
}

export default ChatbotWidget;
