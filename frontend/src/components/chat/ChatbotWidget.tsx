import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { preprocessLaTeX, chatMarkdownComponents } from '../../utils/mathRenderer';
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
      const fallback = getLocalOfflineResponse(query);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: fallback.reply },
      ]);
      if (fallback.suggestions && fallback.suggestions.length > 0) {
        setSuggestions(fallback.suggestions);
      }
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
 * Robust markdown and LaTeX math formatter for AI responses.
 * Memoized to eliminate costly LaTeX parsing during keystroke typing.
 */
const FormattedMarkdown = React.memo<{ text: string; isUser: boolean }>(({ text, isUser }) => {
  if (isUser) {
    return <span>{text}</span>;
  }

  const processed = preprocessLaTeX(text);

  return (
    <div className="space-y-1 text-xs sm:text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: '#ea580c' }]]}
        components={chatMarkdownComponents}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
});

FormattedMarkdown.displayName = 'FormattedMarkdown';

interface OfflineResponse {
  reply: string;
  suggestions?: string[];
}

const FINANCIAL_INTENT_TERMS = [
  'loan', 'emi', 'interest', 'cibil', 'credit', 'rate', 'apr', 'dti', 'tenor', 'kyc',
  'pan', 'aadhaar', 'document', 'borrow', 'borrower', 'borrowing', 'apply', 'application',
  'status', 'track', 'credvidhi', 'bank', 'account', 'register', 'salary', 'income', 'money',
  'rupee', 'inr', 'approval', 'disbursed', 'statement', 'slip', 'itr', 'login', 'support', 'helpline',
  'eligible', 'eligibility', 'finance', 'financial', 'lender', 'lending', 'mortgage', 'prepayment',
];

const OFF_TOPIC_TERMS = [
  'python', 'javascript', 'code', 'programming', 'html', 'css', 'react', 'bug',
  'algorithm', 'poem', 'poetry', 'story', 'joke', 'riddle', 'recipe', 'cook',
  'movie', 'song', 'lyrics', 'cricket', 'football', 'weather', 'forecast',
  'homework', 'essay', 'president', 'prime minister', 'capital of',
];

function getLocalOfflineResponse(query: string): OfflineResponse {
  const q = query.toLowerCase();
  const qWords = q.replace(/[?!.,]/g, ' ').split(/\s+/);

  // 0. Off-topic domain guardrail: do not answer random questions
  const hasFinancialContext = FINANCIAL_INTENT_TERMS.some((term) => q.includes(term));
  const hasOffTopicContext = OFF_TOPIC_TERMS.some((term) => qWords.includes(term) || q.includes(term));

  if (!hasFinancialContext && hasOffTopicContext) {
    return {
      reply:
        '### 🛡️ CredVidhi Assistance Scope\n\n' +
        'I am CredVidhi\'s specialized loan and customer support assistant. ' +
        'I am dedicated exclusively to queries regarding our lending platform:\n\n' +
        '- **CredVidhi Loan Products** (Home, Auto, SME, Personal, Education)\n' +
        '- **Interest Rates & Tenors** (Starting from 8.5% p.a.)\n' +
        '- **Application Status & Tracking** (Real-time lifecycle stages)\n' +
        '- **Mandatory KYC Documents** (PAN, Aadhaar, Payslips, Bank Statements)\n' +
        '- **EMI & DTI Calculations** (Deterministic compound formulas)\n' +
        '- **Borrower Registration & Sign-in**\n\n' +
        'How can I assist you with your loan application or credit requirements today?',
      suggestions: [
        'What are your loan interest rates?',
        'How do I track my application status?',
        'What documents are required?',
        'How is my EMI calculated?',
      ],
    };
  }

  // 1. Application Status & Tracking
  if (
    q.includes('status') ||
    q.includes('track') ||
    q.includes('stage') ||
    q.includes('lifecycle') ||
    q.includes('timeline') ||
    q.includes('progress') ||
    q.includes('where is my')
  ) {
    return {
      reply:
        '### ⏱️ Application Status & Tracking\n\n' +
        'You can track your CredVidhi loan application in real-time across our 5 automated stages:\n\n' +
        '1. **DRAFT:** Application created, loan amount and tenor selected.\n' +
        '2. **SUBMITTED:** KYC documents uploaded and queued for verification.\n' +
        '3. **UNDER_REVIEW:** Loan Officer verifies your identity and documents (approx. 2–4 hours).\n' +
        '4. **APPROVED / REJECTED:** Deterministic underwriting assessment (CIBIL score & DTI evaluation).\n' +
        '5. **DISBURSED:** Immediate funds release to your bank account via NEFT/RTGS.\n\n' +
        '**How to track:** Click **"Track Application"** in the top navigation bar and enter your registered Application Reference Number (e.g., `APP-2026-0891`).',
      suggestions: [
        'What documents are required?',
        'What are the interest rates?',
        'How long does approval take?',
        'Contact customer support',
      ],
    };
  }

  // 2. Registration & How to Apply
  if (
    q.includes('register') ||
    q.includes('sign up') ||
    q.includes('signup') ||
    q.includes('apply') ||
    q.includes('new account') ||
    q.includes('create account') ||
    q.includes('how to apply')
  ) {
    return {
      reply:
        '### 📝 How to Apply & Register with CredVidhi\n\n' +
        'Applying for a loan is 100% digital and takes less than 5 minutes:\n\n' +
        '1. **Click "Apply for Loan":** Located in the top header or hero section to open the registration view.\n' +
        '2. **Create Account:** Provide your full name, email, phone number, and a secure password.\n' +
        '3. **Select Loan Product:** Choose from Home Prime, Auto Express, SME Growth, Personal Flexi, or Education Ascent.\n' +
        '4. **Upload KYC Documents:** Submit your PAN Card, Aadhaar, and income proof.\n' +
        '5. **Instant Underwriting:** Our automated engine calculates your DTI and generates a decision.\n\n' +
        'Click **"Apply for Loan"** at the top right to start your registration immediately!',
      suggestions: [
        'What documents do I need to prepare?',
        'What are the interest rates?',
        'How is my EMI calculated?',
        'What is the minimum CIBIL score?',
      ],
    };
  }

  // 3. Sign In & Login
  if (q.includes('login') || q.includes('sign in') || q.includes('signin') || q.includes('portal') || q.includes('staff sso')) {
    return {
      reply:
        '### 🔐 CredVidhi Portal Sign In\n\n' +
        '- **Borrowers & Applicants:** Click **"Track Application"** in the navigation header to sign in with your Application Reference Number or credentials.\n' +
        '- **Staff & Loan Officers:** Click **"Staff SSO"** to access the staff verification cockpit and risk triage queue.\n\n' +
        'If you do not have an account yet, click **"Apply for Loan"** to create a new profile.',
      suggestions: [
        'How do I track my application status?',
        'How do I register a new account?',
        'What documents are required?',
        'Contact customer support',
      ],
    };
  }

  // 4. Interest Rates & APR
  if (q.includes('rate') || q.includes('interest') || q.includes('apr') || q.includes('cost') || q.includes('charge')) {
    return {
      reply:
        '### 📊 Current CredVidhi Loan Interest Rates (APR)\n\n' +
        '- **Home Prime Loan:** Starting at **8.5% p.a.** (Tenor up to 30 years)\n' +
        '- **Education Ascent:** Starting at **9.0% p.a.** (Tenor up to 10 years)\n' +
        '- **Auto Express:** Starting at **9.5% p.a.** (Tenor up to 7 years)\n' +
        '- **SME Growth:** Starting at **11.0% p.a.** (Tenor up to 5 years)\n' +
        '- **Personal Flexi Credit:** Starting at **12.5% p.a.** (Tenor up to 4 years)\n\n' +
        'All loans feature zero prepayment penalties on floating interest rates.',
      suggestions: [
        'What documents are required?',
        'How is EMI calculated?',
        'What is the maximum loan amount?',
        'How do I apply for a loan?',
      ],
    };
  }

  // 5. Mandatory KYC & Documents
  if (
    q.includes('document') ||
    q.includes('doc') ||
    q.includes('kyc') ||
    q.includes('pan') ||
    q.includes('aadhaar') ||
    q.includes('upload') ||
    q.includes('salary') ||
    q.includes('statement')
  ) {
    return {
      reply:
        '### 📑 Required KYC Documents\n\n' +
        '1. **PAN Card** (Mandatory identity and credit bureau evaluation)\n' +
        '2. **Aadhaar Card or Passport** (Proof of current address)\n' +
        '3. **3 Months Salary Slips** (Income verification for salaried individuals)\n' +
        '4. **6 Months Bank Statement** (PDF format showing monthly cash flows)\n' +
        '5. **Product-Specific:** Property deeds (Home Loan), Dealer Invoice (Auto Loan), GST/ITR (SME Loan).\n\n' +
        'All documents can be uploaded directly in your applicant portal with instant OCR verification.',
      suggestions: [
        'What are the interest rates?',
        'How long does loan approval take?',
        'What is the minimum CIBIL score?',
        'How do I track my application status?',
      ],
    };
  }

  // 6. EMI & DTI Calculation
  if (q.includes('emi') || q.includes('calculate') || q.includes('calculator') || q.includes('dti') || q.includes('formula')) {
    return {
      reply:
        '### 🧮 EMI & DTI Calculation at CredVidhi\n\n' +
        'We use the deterministic standard compound interest amortization formula:\n\n' +
        '$$\\text{EMI} = \\frac{P \\times r \\times (1 + r)^n}{(1 + r)^n - 1}$$\n\n' +
        '- **P:** Principal loan amount\n' +
        '- **r:** Monthly interest rate (Annual Rate / 12 / 100)\n' +
        '- **n:** Loan duration in months\n\n' +
        '**Debt-to-Income (DTI) Ceiling:**\n' +
        'Your total monthly debt obligations (including the new EMI) must not exceed **45% to 50%** of your verified monthly net income.',
      suggestions: [
        'What interest rates do you offer?',
        'Can I apply if my CIBIL score is 680?',
        'What is the Home Loan eligibility?',
        'How do I apply for a loan?',
      ],
    };
  }

  // 7. CIBIL & Credit Score
  if (q.includes('cibil') || q.includes('credit score') || q.includes('score') || q.includes('experian')) {
    return {
      reply:
        '### 📈 Credit Score (CIBIL) Guidelines\n\n' +
        '- **750+ (Prime Tier):** Instant digital fast-track approval with our lowest interest rates.\n' +
        '- **700 - 749 (Standard Tier):** Eligible for standard retail rates with standard DTI criteria.\n' +
        '- **650 - 699 (Conditional Tier):** Requires manual underwriter review, co-applicant, or collateral.\n' +
        '- **Below 650:** High risk tier; we recommend resolving outstanding defaults prior to applying.',
      suggestions: [
        'What interest rates are available?',
        'What documents do I need to prepare?',
        'How do I apply for a loan?',
        'Contact customer support',
      ],
    };
  }

  // 8. Specific Loan Products
  if (q.includes('home') || q.includes('housing') || q.includes('property')) {
    return {
      reply:
        '### 🏠 Home Prime Loan\n\n' +
        '- **Loan Range:** ₹5,00,000 to ₹1,00,00,000 (1 Crore)\n' +
        '- **Interest Rate:** Starting from **8.5% p.a.**\n' +
        '- **Tenor:** 12 to 360 months (up to 30 years)\n' +
        '- **Max DTI:** 45.0%\n' +
        '- **Key Documents:** PAN, Aadhaar, 3 Months Salary Slips, 6 Months Bank Statement, Property Title Deeds',
      suggestions: ['How do I apply for Home Loan?', 'What are the interest rates?', 'How is EMI calculated?'],
    };
  }

  if (q.includes('auto') || q.includes('car') || q.includes('vehicle')) {
    return {
      reply:
        '### 🚗 Auto Express Loan\n\n' +
        '- **Loan Range:** ₹1,00,000 to ₹30,00,000\n' +
        '- **Interest Rate:** Starting from **9.5% p.a.**\n' +
        '- **Tenor:** 12 to 84 months (up to 7 years)\n' +
        '- **Max DTI:** 50.0%\n' +
        '- **Key Documents:** PAN, Aadhaar, 3 Months Salary Slips, 6 Months Bank Statement, Vehicle Proforma',
      suggestions: ['How do I apply for Auto Loan?', 'What are the interest rates?', 'How is EMI calculated?'],
    };
  }

  if (q.includes('sme') || q.includes('business') || q.includes('commercial')) {
    return {
      reply:
        '### 🏢 SME Growth Term Loan\n\n' +
        '- **Loan Range:** ₹2,00,000 to ₹50,00,000\n' +
        '- **Interest Rate:** Starting from **11.0% p.a.**\n' +
        '- **Tenor:** 6 to 60 months (up to 5 years)\n' +
        '- **Max DTI:** 45.0%\n' +
        '- **Key Documents:** PAN, GST Registration / Udyam Certificate, 2 Years ITR, 12 Months Bank Statement',
      suggestions: ['How do I apply for SME Loan?', 'What are the interest rates?', 'What documents are required?'],
    };
  }

  if (q.includes('personal') || q.includes('flexi')) {
    return {
      reply:
        '### 💳 Personal Flexi Credit\n\n' +
        '- **Loan Range:** ₹50,000 to ₹10,00,000\n' +
        '- **Interest Rate:** Starting from **12.5% p.a.**\n' +
        '- **Tenor:** 6 to 48 months (up to 4 years)\n' +
        '- **Max DTI:** 50.0%\n' +
        '- **Key Documents:** PAN, Aadhaar, 3 Months Salary Slips, 6 Months Bank Statement',
      suggestions: ['How do I apply for Personal Loan?', 'What are the interest rates?', 'How is EMI calculated?'],
    };
  }

  if (q.includes('education') || q.includes('student') || q.includes('study')) {
    return {
      reply:
        '### 🎓 Education Ascent Loan\n\n' +
        '- **Loan Range:** ₹1,00,000 to ₹40,00,000\n' +
        '- **Interest Rate:** Starting from **9.0% p.a.**\n' +
        '- **Tenor:** 12 to 120 months (up to 10 years)\n' +
        '- **Max DTI:** 45.0%\n' +
        '- **Key Documents:** PAN, Aadhaar, University Admission Offer, Fee Structure, Co-applicant Income Proof',
      suggestions: ['How do I apply for Education Loan?', 'What are the interest rates?', 'How is EMI calculated?'],
    };
  }

  // 9. Customer Support & Helpline
  if (q.includes('contact') || q.includes('support') || q.includes('help') || q.includes('phone') || q.includes('email') || q.includes('helpline')) {
    return {
      reply:
        '### 📞 CredVidhi Customer Support\n\n' +
        'Our dedicated loan support team is available to assist you:\n\n' +
        '- **Toll-Free Helpline:** 1800-CRED-VIDHI (1800-2733-8434)\n' +
        '- **Support Email:** `support@credvidhi.in`\n' +
        '- **Hours:** Monday to Saturday, 9:00 AM – 7:00 PM IST\n' +
        '- **Corporate Office:** CredVidhi Tower, G Block, BKC, Mumbai 400051\n\n' +
        'You can also track status and submit inquiry tickets directly inside the applicant portal.',
      suggestions: [
        'What are your loan interest rates?',
        'How do I register for an account?',
        'What documents are required?',
        'How do I track my application status?',
      ],
    };
  }

  // 10. Contextual Fallback for general greetings or broad questions (no repetitive loop)
  return {
    reply:
      '### 🇮🇳 CredVidhi AI Financial Assistant\n\n' +
      'I can answer any question regarding CredVidhi lending services and applications:\n\n' +
      '- **Loan Products & Interest Rates:** Home (from 8.5%), Auto (from 9.5%), SME (from 11%), Personal (from 12.5%)\n' +
      '- **Application Tracking:** Real-time lifecycle status from submission to NEFT/RTGS bank disbursement\n' +
      '- **KYC & Eligibility:** PAN card, Aadhaar, payslips, CIBIL score (>= 700), DTI limits (45-50%)\n' +
      '- **Calculations:** Deterministic compound EMI and disposable income analysis\n\n' +
      'Please select one of the suggested topics below or ask your specific question!',
    suggestions: [
      'What loan products do you offer?',
      'What are the current interest rates?',
      'How do I track my application status?',
      'How do I apply for a loan?',
    ],
  };
}

export default ChatbotWidget;
