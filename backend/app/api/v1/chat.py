"""AI Chatbot & Customer Support API Router.

Supports Google Gemini (via OpenAI-compatible API) and other LLM providers,
with an intelligent offline fallback engine for CredVidhi financial and product inquiries.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from app.core.logging import logger
from app.core.responses import success_response
from app.dependencies import get_optional_current_user
from app.models.user import User
from app.schemas.chat import ChatMessageSchema, ChatRequestSchema, ChatResponseSchema
from app.services.llm_service import get_llm_service

router = APIRouter(prefix="/chat", tags=["AI Chatbot"])

CREDVIDHI_SYSTEM_PROMPT = """You are CredVidhi AI Assistant, the intelligent customer support and financial advisor for CredVidhi.
CredVidhi is India's leading automated loan processing and deterministic underwriting platform.

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

GUIDELINES FOR ANSWERS:
- Answer any question the user asks helpfully, professionally, and accurately (whether about CredVidhi loans, interest rates, eligibility, repayment, documents, or general queries).
- Use clear markdown with bold headers, bullet points, and INR (₹) currency symbols.
- Keep answers warm, encouraging, concise, and trustworthy.
"""


def _generate_fallback_response(query: str) -> tuple[str, List[str]]:
    """Intelligent rule-based fallback answering common customer inquiries offline."""
    q = query.lower()

    if any(k in q for k in ["rate", "interest", "apr", "cost", "charge"]):
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

    if any(k in q for k in ["document", "doc", "kyc", "pan", "aadhaar", "upload"]):
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

    if any(k in q for k in ["emi", "calculate", "dti", "formula", "monthly"]):
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

    if any(k in q for k in ["status", "track", "lifecycle", "process", "time", "stage"]):
        reply = (
            "### ⏱️ Loan Lifecycle & Processing Timeline\n\n"
            "CredVidhi processes loans through 5 automated, transparent stages:\n\n"
            "1. **DRAFT:** Fill in your loan amount and tenor.\n"
            "2. **SUBMITTED:** Upload your KYC documents (PAN, Aadhaar, Payslips).\n"
            "3. **UNDER_REVIEW:** Automated KYC checklist verification by our credit operations team (approx. 2–4 hours).\n"
            "4. **APPROVED:** Deterministic risk underwriting assessment based on CIBIL and DTI.\n"
            "5. **DISBURSED:** Immediate funds release to your bank account via NEFT/RTGS.\n\n"
            "You can track real-time progress on your borrower dashboard!"
        )
        suggestions = [
            "What documents do I need to submit?",
            "What are the interest rates?",
            "Who can I contact for customer support?",
            "How do I register a new account?",
        ]
        return reply, suggestions

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

    if any(k in q for k in ["contact", "support", "help", "phone", "email", "call", "agent", "human"]):
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

    # Default welcoming overview
    reply = (
        "### Welcome to CredVidhi Support! 🇮🇳\n\n"
        "I am your AI Financial Assistant. I can help you with:\n\n"
        "- **Loan Products & Interest Rates:** Home Loans (from 8.5%), Auto Loans (from 9.5%), SME Loans (from 11%), Personal Loans (from 12.5%)\n"
        "- **Eligibility & KYC:** Required documents, CIBIL score requirements (>= 700), DTI limits (45-50%)\n"
        "- **Calculations:** EMI schedules, amortization breakdowns, disposable income\n"
        "- **Application Status:** Tracking stages from submission to bank disbursement\n\n"
        "How can I help you today?"
    )
    suggestions = [
        "What loan products do you offer?",
        "What are the current interest rates?",
        "What documents are required for application?",
        "How is my EMI calculated?",
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
        "What documents are required?",
        "How long does loan approval take?",
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

    falling back to grounded financial knowledge base if offline.
    """
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
                temperature=0.3,
                max_tokens=800,
            )
            raw_reply = response_data["choices"][0]["message"]["content"]
            reply_text = str(raw_reply).strip()

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
