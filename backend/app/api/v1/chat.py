"""AI Chatbot & Customer Support API Router.

Supports Google Gemini (via OpenAI-compatible API) and other LLM providers,
with an intelligent domain guardrail and offline fallback engine for CredVidhi
financial, loan, underwriting, and product inquiries.
"""

from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from app.core.logging import logger
from app.core.responses import success_response
from app.dependencies import get_optional_current_user
from app.models.user import User
from app.schemas.chat import ChatRequestSchema, ChatResponseSchema
from app.services.llm_service import get_llm_service

router = APIRouter(prefix="/chat", tags=["AI Chatbot"])

CREDVIDHI_SYSTEM_PROMPT = """You are CredVidhi AI Assistant, the intelligent customer support and financial advisor for CredVidhi (https://credvidhi.in).
CredVidhi is India's leading automated loan processing and deterministic underwriting platform.

STRICT DOMAIN BOUNDARY & SCOPE RESTRICTIONS:
1. You are EXCLUSIVELY a loan and banking assistant for the CredVidhi platform.
2. You MUST ONLY answer queries related to:
   - CredVidhi loan products (Home Prime, Auto Express, SME Growth, Personal Flexi, Education Ascent)
   - Interest rates (APR), tenors, limits, and processing fees
   - KYC verification, mandatory documents (PAN, Aadhaar, salary slips, bank statements, ITR)
   - Loan application lifecycle stages (DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, DISBURSED)
   - Application status tracking, reference number lookup (e.g., APP-2026-XXXX)
   - Mathematical calculations: deterministic compound EMI formulas, Debt-to-Income (DTI) limits, and disposable income
   - Underwriting rules: CIBIL bureau scores (prime >= 700), credit risk tiers, and approval criteria
   - User account registration, sign in, document upload, and website navigation
   - CredVidhi customer support channels (1800-CRED-VIDHI, support@credvidhi.in, BKC Mumbai office)

3. ABSOLUTE PROHIBITION ON OFF-TOPIC QUERIES:
   - You MUST NEVER answer questions about general knowledge, programming/coding, software development, creative writing, poetry, jokes, entertainment, movies, sports, politics, weather, recipes, or school homework.
   - Do NOT burn tokens or misuse the Gemini API on random queries.
   - If the user asks ANY question not directly related to CredVidhi or lending/credit, POLITELY AND FIRMLY DECLINE with this exact message:
     "I am CredVidhi's specialized loan assistant. I can only assist with inquiries regarding CredVidhi loan products, application status, KYC verification, EMI calculations, and website services. How can I help you with your loan application or credit requirements today?"

KEY PRODUCT CATALOG:
1. Home Prime Loan (HOME_PRIME):
   - Amount: ₹5,00,000 to ₹1,00,00,000
   - Base APR: 8.5% p.a.
   - Tenor: 12 to 360 months (up to 30 years)
   - Max DTI: 45.0%
   - Required: PAN Card, Aadhaar Card, 3 Months Salary Slips, 6 Months Bank Statement, Property Title Documents

2. Auto Express Loan (AUTO_EXPRESS):
   - Amount: ₹1,00,000 to ₹30,00,000
   - Base APR: 9.5% p.a.
   - Tenor: 12 to 84 months (up to 7 years)
   - Max DTI: 50.0%
   - Required: PAN Card, Aadhaar Card, 3 Months Salary Slips, 6 Months Bank Statement

3. SME Growth Term Loan (SME_GROWTH):
   - Amount: ₹2,00,000 to ₹50,00,000
   - Base APR: 11.0% p.a.
   - Tenor: 6 to 60 months (up to 5 years)
   - Max DTI: 45.0%
   - Required: PAN Card, GST Registration / Udyam Certificate, 2 Years ITR, 12 Months Bank Statement

4. Personal Flexi Credit (PERSONAL_FLEXI):
   - Amount: ₹50,000 to ₹10,00,000
   - Base APR: 12.5% p.a.
   - Tenor: 6 to 48 months (up to 4 years)
   - Max DTI: 50.0%
   - Required: PAN Card, Aadhaar Card, 3 Months Salary Slips, 6 Months Bank Statement

5. Education Ascent Loan (EDUCATION_ASCENT):
   - Amount: ₹1,00,000 to ₹40,00,000
   - Base APR: 9.0% p.a.
   - Tenor: 12 to 120 months (up to 10 years)
   - Max DTI: 45.0%
   - Required: PAN Card, Aadhaar Card, Admission Letter, Fee Schedule, Co-applicant Income Proof

LOAN LIFECYCLE STAGES:
- DRAFT: Application initiated by applicant.
- SUBMITTED: Applicant completed KYC and submitted for verification.
- UNDER_REVIEW: Loan Officer verifies KYC documents and confirms checklist.
- APPROVED / REJECTED: Underwriter reviews deterministic risk assessment (CIBIL, DTI, disposable income) and decides.
- DISBURSED: Loan funds sent via NEFT/RTGS to applicant's verified bank account.

UNDERWRITING RULES:
- Bureau Score (CIBIL): Score >= 700 recommended for prime rates.
- Debt-to-Income (DTI): Max 45% to 50% across all obligations.
- Compound Interest EMI: EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
- Disposable Income Surplus: Income minus living expenses and all EMIs must be positive.

CUSTOMER SUPPORT:
- Email: support@credvidhi.in
- Helpline: 1800-CRED-VIDHI (1800-2733-8434), Mon-Sat 9 AM - 7 PM IST
- Address: Bandra Kurla Complex (BKC), Mumbai, Maharashtra 400051

FORMATTING:
- Use clear markdown with bold headers, bullet points, and INR (₹) currency symbols.
- Keep answers warm, encouraging, concise, and trustworthy.
"""

OUT_OF_SCOPE_REPLY = (
    "### 🛡️ CredVidhi Assistance Scope\n\n"
    "I am CredVidhi's specialized loan and customer support assistant. "
    "I am dedicated exclusively to queries regarding our lending platform:\n\n"
    "- **CredVidhi Loan Products** (Home, Auto, SME, Personal, Education)\n"
    "- **Interest Rates & Tenors** (Starting from 8.5% p.a.)\n"
    "- **Application Status & Tracking** (Real-time lifecycle stages)\n"
    "- **Mandatory KYC Documents** (PAN, Aadhaar, Payslips, Bank Statements)\n"
    "- **EMI & DTI Calculations** (Deterministic compound formulas)\n"
    "- **Borrower Registration & Sign-in**\n\n"
    "How can I assist you with your loan application or credit requirements today?"
)

OUT_OF_SCOPE_SUGGESTIONS = [
    "What are your loan interest rates?",
    "How do I track my application status?",
    "What documents are required?",
    "How is my EMI calculated?",
]

# Keywords indicating explicit domain connection to finance, loans, or CredVidhi
FINANCIAL_INTENT_KEYWORDS = {
    "loan",
    "emi",
    "interest",
    "cibil",
    "credit",
    "rate",
    "apr",
    "dti",
    "tenor",
    "kyc",
    "pan",
    "aadhaar",
    "document",
    "borrow",
    "borrower",
    "borrowing",
    "apply",
    "application",
    "status",
    "track",
    "credvidhi",
    "bank",
    "account",
    "register",
    "salary",
    "income",
    "money",
    "rupee",
    "inr",
    "lakh",
    "crore",
    "underwriting",
    "approval",
    "disbursed",
    "disbursement",
    "statement",
    "paystub",
    "slip",
    "itr",
    "gst",
    "udyam",
    "collateral",
    "repayment",
    "foreclosure",
    "fee",
    "tenure",
    "downpayment",
    "login",
    "portal",
    "support",
    "helpline",
    "eligible",
    "eligibility",
    "finance",
    "financial",
    "lender",
    "lending",
    "mortgage",
    "prepayment",
    "turnaround",
    "tat",
}

# Keywords indicating completely unrelated, off-topic domains (code, jokes, general knowledge, etc.)
OFF_TOPIC_KEYWORDS = {
    "python",
    "javascript",
    "code",
    "programming",
    "html",
    "css",
    "react",
    "bug",
    "syntax",
    "algorithm",
    "function",
    "variable",
    "class",
    "poem",
    "poetry",
    "story",
    "joke",
    "riddle",
    "recipe",
    "cook",
    "cooking",
    "movie",
    "song",
    "lyrics",
    "cricket",
    "football",
    "match",
    "scorecard",
    "weather",
    "forecast",
    "astronomy",
    "homework",
    "essay",
    "translate",
    "president",
    "prime minister",
    "capital of",
    "who won",
    "geography",
    "history",
}


def is_clearly_off_topic(query: str) -> bool:
    """Detect if a user prompt is completely outside the CredVidhi loan domain,

    preventing Gemini API token waste and random question misuse.
    """
    q_words = set(query.lower().replace("?", " ").replace("!", " ").replace(".", " ").split())

    # If any financial / CredVidhi keyword is present, it is relevant
    if any(k in q_words or k in query.lower() for k in FINANCIAL_INTENT_KEYWORDS):
        return False

    # If an off-topic keyword is present with zero financial context, flag it
    if any(k in q_words or k in query.lower() for k in OFF_TOPIC_KEYWORDS):
        return True

    # Generic short greetings like 'hi', 'hello', 'hey' are allowed
    if query.strip().lower() in ("hi", "hello", "hey", "help", "good morning", "good evening"):
        return False

    return False


def _generate_fallback_response(query: str) -> tuple[str, List[str]]:
    """Intelligent rule-based fallback answering common customer inquiries offline."""
    q = query.lower()

    # 0. Check off-topic guardrail
    if is_clearly_off_topic(query):
        return OUT_OF_SCOPE_REPLY, OUT_OF_SCOPE_SUGGESTIONS

    # 1. Application Status & Tracking
    if any(
        k in q
        for k in [
            "status",
            "track",
            "stage",
            "timeline",
            "lifecycle",
            "where is my loan",
            "progress",
        ]
    ):
        reply = (
            "### ⏱️ Application Status & Tracking\n\n"
            "You can track your CredVidhi loan application in real-time across our 5 automated stages:\n\n"
            "1. **DRAFT:** Application initiated, loan amount and tenor selected.\n"
            "2. **SUBMITTED:** KYC documents uploaded and queued for verification.\n"
            "3. **UNDER_REVIEW:** Loan Officer verifies your identity and documents (approx. 2–4 hours).\n"
            "4. **APPROVED / REJECTED:** Deterministic underwriting assessment (CIBIL score & DTI evaluation).\n"
            "5. **DISBURSED:** Immediate funds release to your bank account via NEFT/RTGS.\n\n"
            "**How to track:** Click **'Track Application'** in the top navigation and enter your Application Reference Number (e.g., `APP-2026-0891`)."
        )
        suggestions = [
            "What documents are required?",
            "What are the interest rates?",
            "How long does approval take?",
            "Contact customer support",
        ]
        return reply, suggestions

    # 2. Registration & How to Apply
    if any(
        k in q
        for k in [
            "register",
            "sign up",
            "signup",
            "create account",
            "new user",
            "how to apply",
            "apply",
        ]
    ):
        reply = (
            "### 📝 How to Apply & Register with CredVidhi\n\n"
            "Applying for a loan is 100% digital and takes less than 5 minutes:\n\n"
            "1. **Click 'Apply for Loan':** In the top header or hero section to open the registration portal.\n"
            "2. **Create Account:** Provide your full name, email, phone number, and a secure password.\n"
            "3. **Select Loan Product:** Choose from Home, Auto, SME, Personal, or Education loan.\n"
            "4. **Upload KYC Documents:** Submit your PAN Card, Aadhaar, and income statements.\n"
            "5. **Instant Underwriting:** Our automated engine calculates your DTI and generates a decision.\n\n"
            "Ready to begin? Click **'Apply for Loan'** at the top right of this page!"
        )
        suggestions = [
            "What documents do I need to prepare?",
            "What are the interest rates?",
            "How is my EMI calculated?",
            "What is the minimum CIBIL score?",
        ]
        return reply, suggestions

    # 3. Sign In & Login
    if any(k in q for k in ["login", "sign in", "signin", "portal", "staff sso"]):
        reply = (
            "### 🔐 CredVidhi Portal Sign In\n\n"
            "- **Borrowers & Applicants:** Click **'Track Application'** in the header and sign in with your Application Reference Number or registered credentials.\n"
            "- **Staff & Loan Officers:** Click **'Staff SSO'** to access the underwriting queue and document verification cockpit.\n\n"
            "If you do not have an account yet, click **'Apply for Loan'** to register in under 2 minutes."
        )
        suggestions = [
            "How do I track my application status?",
            "How do I register a new account?",
            "What documents are required?",
            "Contact customer support",
        ]
        return reply, suggestions

    # 4. Interest Rates & APR
    if any(k in q for k in ["rate", "interest", "apr", "cost", "charge", "percentage"]):
        reply = (
            "### 📊 CredVidhi Loan Interest Rates (APR)\n\n"
            "Here are our current competitive annual interest rates:\n\n"
            "- **Home Prime Loan:** Starting at **8.5% p.a.** (Tenor up to 30 years)\n"
            "- **Education Ascent Loan:** Starting at **9.0% p.a.** (Tenor up to 10 years)\n"
            "- **Auto Express Loan:** Starting at **9.5% p.a.** (Tenor up to 7 years)\n"
            "- **SME Growth Term Loan:** Starting at **11.0% p.a.** (Tenor up to 5 years)\n"
            "- **Personal Flexi Credit:** Starting at **12.5% p.a.** (Tenor up to 4 years)\n\n"
            "All interest rates are transparent with no hidden foreclosure charges for floating retail loans."
        )
        suggestions = [
            "What documents are required?",
            "How is EMI calculated?",
            "What is the maximum loan amount?",
            "How do I apply for a loan?",
        ]
        return reply, suggestions

    # 5. Documents & KYC
    if any(
        k in q
        for k in ["document", "doc", "kyc", "pan", "aadhaar", "upload", "statement", "salary"]
    ):
        reply = (
            "### 📑 Mandatory KYC & Application Documents\n\n"
            "To ensure fast-track digital approval, please keep the following documents ready:\n\n"
            "1. **Identity & Tax Proof:** PAN Card (mandatory for all credit assessments)\n"
            "2. **Address Proof:** Aadhaar Card, Passport, or Voter ID\n"
            "3. **Income Proof (Salaried):** Latest 3 months' salary slips\n"
            "4. **Banking Records:** Latest 6 months' bank account statements (PDF format)\n"
            "5. **Product-Specific:**\n"
            "   - *Home Loan:* Property title deeds and sale agreement\n"
            "   - *SME Loan:* GST registration, Udyam certificate, 2 years ITR\n"
            "   - *Education Loan:* University admission offer and fee structure\n\n"
            "Our automated OCR engine verifies uploaded documents instantly!"
        )
        suggestions = [
            "What are the interest rates?",
            "How long does loan approval take?",
            "What is the minimum CIBIL score required?",
            "How do I track my application status?",
        ]
        return reply, suggestions

    # 6. EMI & DTI Calculation
    if any(k in q for k in ["emi", "calculate", "calculator", "dti", "formula", "monthly"]):
        reply = (
            "### 🧮 EMI & DTI Calculation at CredVidhi\n\n"
            "We use the deterministic standard compound interest amortization formula:\n\n"
            "$$\\text{EMI} = \\frac{P \\times r \\times (1 + r)^n}{(1 + r)^n - 1}$$\n\n"
            "- **P:** Principal loan amount\n"
            "- **r:** Monthly interest rate (Annual Rate / 12 / 100)\n"
            "- **n:** Loan duration in months\n\n"
            "**Debt-to-Income (DTI) Limit:**\n"
            "CredVidhi requires your total monthly debt obligations (including your new EMI) to remain within **45% to 50%** of your verified net monthly income."
        )
        suggestions = [
            "What interest rates do you offer?",
            "Can I apply if my CIBIL score is 680?",
            "What is the Home Loan eligibility?",
            "How can I register an account?",
        ]
        return reply, suggestions

    # 7. CIBIL & Credit Score
    if any(k in q for k in ["cibil", "credit score", "score", "experian", "crif"]):
        reply = (
            "### 📈 Credit Score (CIBIL) Guidelines\n\n"
            "- **750+ (Prime Tier):** Instant fast-track approval with our lowest base interest rates.\n"
            "- **700 - 749 (Standard Tier):** Eligible for standard approval with standard DTI limits.\n"
            "- **650 - 699 (Conditional Tier):** Requires senior underwriter review, co-applicant, or additional collateral.\n"
            "- **Below 650:** High credit risk; we recommend debt consolidation and credit building before applying."
        )
        suggestions = [
            "What interest rates are available?",
            "How can I check my loan eligibility?",
            "What documents do I need to prepare?",
            "Talk to a human support agent",
        ]
        return reply, suggestions

    # 8. Specific Product Deep-Dives
    if any(k in q for k in ["home", "housing", "property"]):
        reply = (
            "### 🏠 Home Prime Loan\n\n"
            "- **Amount:** ₹5,00,000 to ₹1,00,00,000 (1 Crore)\n"
            "- **Interest Rate:** Starting from **8.5% p.a.**\n"
            "- **Tenor:** 12 to 360 months (up to 30 years)\n"
            "- **Max DTI:** 45.0%\n"
            "- **Documents:** PAN, Aadhaar, 3 Months Salary Slips, 6 Months Bank Statement, Property Title Deeds"
        )
        return reply, [
            "How do I apply for Home Loan?",
            "What is the Home Loan EMI?",
            "What are the interest rates?",
        ]

    if any(k in q for k in ["auto", "car", "vehicle"]):
        reply = (
            "### 🚗 Auto Express Loan\n\n"
            "- **Amount:** ₹1,00,000 to ₹30,00,000\n"
            "- **Interest Rate:** Starting from **9.5% p.a.**\n"
            "- **Tenor:** 12 to 84 months (up to 7 years)\n"
            "- **Max DTI:** 50.0%\n"
            "- **Documents:** PAN, Aadhaar, 3 Months Salary Slips, 6 Months Bank Statement, Vehicle Dealer Proforma"
        )
        return reply, [
            "How do I apply for Auto Loan?",
            "What is the Auto Loan EMI?",
            "What are the interest rates?",
        ]

    if any(k in q for k in ["sme", "business", "commercial", "enterprise"]):
        reply = (
            "### 🏢 SME Growth Term Loan\n\n"
            "- **Amount:** ₹2,00,000 to ₹50,00,000\n"
            "- **Interest Rate:** Starting from **11.0% p.a.**\n"
            "- **Tenor:** 6 to 60 months (up to 5 years)\n"
            "- **Max DTI:** 45.0%\n"
            "- **Documents:** PAN, GST Registration / Udyam Certificate, 2 Years ITR, 12 Months Bank Statement"
        )
        return reply, [
            "How do I apply for SME Loan?",
            "What documents are needed for SME?",
            "What are the interest rates?",
        ]

    if any(k in q for k in ["personal", "flexi"]):
        reply = (
            "### 💳 Personal Flexi Credit\n\n"
            "- **Amount:** ₹50,000 to ₹10,00,000\n"
            "- **Interest Rate:** Starting from **12.5% p.a.**\n"
            "- **Tenor:** 6 to 48 months (up to 4 years)\n"
            "- **Max DTI:** 50.0%\n"
            "- **Documents:** PAN, Aadhaar, 3 Months Salary Slips, 6 Months Bank Statement"
        )
        return reply, [
            "How do I apply for Personal Loan?",
            "What is the Personal Loan EMI?",
            "What are the interest rates?",
        ]

    if any(k in q for k in ["education", "student", "study", "college"]):
        reply = (
            "### 🎓 Education Ascent Loan\n\n"
            "- **Amount:** ₹1,00,000 to ₹40,00,000\n"
            "- **Interest Rate:** Starting from **9.0% p.a.**\n"
            "- **Tenor:** 12 to 120 months (up to 10 years)\n"
            "- **Max DTI:** 45.0%\n"
            "- **Documents:** PAN, Aadhaar, Admission Letter, Fee Schedule, Co-applicant Income Proof"
        )
        return reply, [
            "How do I apply for Education Loan?",
            "What documents are needed?",
            "What are the interest rates?",
        ]

    # 9. Customer Support Channels
    if any(
        k in q
        for k in [
            "contact",
            "support",
            "help",
            "phone",
            "email",
            "call",
            "agent",
            "human",
            "helpline",
        ]
    ):
        reply = (
            "### 📞 CredVidhi Customer Support\n\n"
            "Our dedicated loan support team is here to assist you:\n\n"
            "- **Toll-Free Helpline:** 1800-CRED-VIDHI (1800-2733-8434)\n"
            "- **Support Email:** `support@credvidhi.in`\n"
            "- **Operating Hours:** Monday to Saturday, 9:00 AM – 7:00 PM IST\n"
            "- **Head Office:** CredVidhi Tower, G Block, Bandra Kurla Complex (BKC), Mumbai 400051\n\n"
            "You can also raise an in-app support ticket directly from your borrower portal."
        )
        suggestions = [
            "What are your loan interest rates?",
            "How do I register for an account?",
            "What documents are required?",
            "How long does approval take?",
        ]
        return reply, suggestions

    # 10. Intelligent contextual loan assistance (replaces static welcome repetition)
    reply = (
        "### 🇮🇳 CredVidhi Loan Assistance\n\n"
        "I am your dedicated CredVidhi loan assistant. I can help you with:\n\n"
        "- **Loan Products & Interest Rates:** Home (from 8.5%), Auto (from 9.5%), SME (from 11%), Personal (from 12.5%)\n"
        "- **Eligibility & KYC:** Required documents, CIBIL score requirements (>= 700), DTI limits (45-50%)\n"
        "- **Calculations:** EMI schedules, amortization breakdowns, disposable income\n"
        "- **Application Status:** Tracking stages from submission to bank disbursement\n\n"
        "Please select an option below or type your question about our loans and application process!"
    )
    suggestions = [
        "What loan products do you offer?",
        "What are the current interest rates?",
        "How do I track my application status?",
        "How do I apply for a loan?",
    ]
    return reply, suggestions


def _extract_suggestions(reply: str) -> List[str]:
    """Provide relevant follow-up suggestion chips based on response text."""
    lower = reply.lower()
    if "home prime" in lower or "property" in lower:
        return [
            "What documents are needed for Home Loan?",
            "What is the maximum Home Loan amount?",
            "How does CredVidhi calculate EMI?",
        ]
    if "status" in lower or "track" in lower:
        return [
            "What documents are required?",
            "What are the interest rates?",
            "How long does approval take?",
        ]
    if "rate" in lower or "apr" in lower:
        return [
            "What is the minimum CIBIL score?",
            "What are the required KYC documents?",
            "How do I register an account?",
        ]
    if "document" in lower or "kyc" in lower:
        return [
            "How do I upload documents?",
            "How long does verification take?",
            "What interest rates do you offer?",
        ]
    return [
        "What are your interest rates?",
        "How do I track my application status?",
        "How do I apply for a loan?",
    ]


@router.post(
    "",
    response_model=None,
    status_code=status.HTTP_200_OK,
    summary="Query AI Customer Support Chatbot",
)
async def chat_with_assistant(
    request: ChatRequestSchema,
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> JSONResponse:
    """Execute customer support query with Google Gemini or configured LLM,

    enforcing strict domain guardrails so Gemini is only used for CredVidhi project queries.
    """
    # 1. Fast off-topic guardrail pre-check: prevent Gemini API key misuse for random questions
    if is_clearly_off_topic(request.message):
        return success_response(
            data=ChatResponseSchema(
                reply=OUT_OF_SCOPE_REPLY,
                suggested_questions=OUT_OF_SCOPE_SUGGESTIONS,
                provider="credvidhi-guardrail",
                model="domain-firewall-v1",
            ).model_dump()
        )

    llm = get_llm_service()

    # Determine personalized user greeting/context
    user_context_snippet = ""
    if current_user:
        user_context_snippet = (
            f"\nUSER CONTEXT: The user is authenticated as {current_user.full_name} "
            f"({current_user.role.value}), email: {current_user.email}."
        )

    # Build prompt messages
    messages: List[Dict[str, str]] = [
        {"role": "system", "content": CREDVIDHI_SYSTEM_PROMPT + user_context_snippet}
    ]

    # Append recent conversation history if provided
    if request.history:
        for turn in request.history[-6:]:  # Keep recent 6 turns for context
            if turn.role in ("user", "assistant"):
                messages.append({"role": turn.role, "content": turn.content})

    # Append current user message
    messages.append({"role": "user", "content": request.message})

    # Try calling the configured LLM (Google Gemini / Groq / OpenRouter)
    if llm.is_configured:
        try:
            response_data = await llm.chat_completion(
                messages=messages,
                temperature=0.2,
                max_tokens=800,
            )
            choices = response_data.get("choices", [])
            raw_reply = choices[0].get("message", {}).get("content") if choices else None
            reply_text = str(raw_reply).strip() if raw_reply else ""

            if reply_text:
                suggestions = _extract_suggestions(reply_text)
                return success_response(
                    data=ChatResponseSchema(
                        reply=reply_text,
                        suggested_questions=suggestions,
                        provider=llm.provider,
                        model=llm.model,
                    ).model_dump()
                )
        except Exception as exc:
            logger.warning(
                f"LLM chat completion failed with provider [{llm.provider}], "
                f"falling back to grounded knowledge base: {str(exc)}"
            )

    # Fallback to intelligent offline CredVidhi knowledge base
    reply_text, suggestions = _generate_fallback_response(request.message)
    return success_response(
        data=ChatResponseSchema(
            reply=reply_text,
            suggested_questions=suggestions,
            provider="credvidhi-knowledge-base",
            model="grounded-faq-engine-v1",
        ).model_dump()
    )
