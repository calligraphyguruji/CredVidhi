"""Deterministic Arbitrary-Precision Financial Math Engine.

Handles compound EMI amortization, Debt-to-Income (DTI) calculations,
disposable surplus projections, and amortization schedules using standard
commercial banking conventions and Python Decimal fixed-point arithmetic.
"""

from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Dict, List

CENT = Decimal("0.01")
PERCENT_DIVISOR = Decimal("1200")  # 12 months * 100 percent


def quantize_currency(value: Decimal) -> Decimal:
    """Round monetary value to 2 decimal places using ROUND_HALF_UP."""
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def calculate_emi(principal: Decimal, annual_rate: Decimal, tenor_months: int) -> Decimal:
    """Calculate deterministic Equated Monthly Installment (EMI).

    Formula:
        EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
        where P = principal, r = annual_rate / 1200, n = tenor_months.
        If annual_rate == 0: EMI = P / n.
    """
    if tenor_months <= 0:
        raise ValueError("Loan tenor must be at least 1 month.")
    if principal <= Decimal("0"):
        return Decimal("0.00")

    if annual_rate <= Decimal("0"):
        return quantize_currency(principal / Decimal(tenor_months))

    r = annual_rate / PERCENT_DIVISOR
    rate_factor = (Decimal("1") + r) ** tenor_months
    numerator = principal * r * rate_factor
    denominator = rate_factor - Decimal("1")
    return quantize_currency(numerator / denominator)


def calculate_dti(
    gross_monthly_income: Decimal, existing_debts: Decimal, proposed_emi: Decimal
) -> Decimal:
    """Calculate Debt-To-Income (DTI) percentage.

    Formula:
        DTI = ((existing_debts + proposed_emi) / gross_monthly_income) * 100
    """
    if gross_monthly_income <= Decimal("0"):
        return Decimal("100.00")

    total_debt_obligation = max(Decimal("0"), existing_debts) + max(Decimal("0"), proposed_emi)
    dti = (total_debt_obligation / gross_monthly_income) * Decimal("100")
    return quantize_currency(dti)


def calculate_disposable_income(
    gross_monthly_income: Decimal,
    existing_debts: Decimal,
    housing_expenses: Decimal,
    proposed_emi: Decimal,
) -> Decimal:
    """Calculate net monthly disposable income surplus.

    Formula:
        Surplus = gross_income - (existing_debts + housing_expenses + proposed_emi)
    """
    total_outflows = (
        max(Decimal("0"), existing_debts)
        + max(Decimal("0"), housing_expenses)
        + max(Decimal("0"), proposed_emi)
    )
    return quantize_currency(gross_monthly_income - total_outflows)


def generate_amortization_schedule(
    principal: Decimal, annual_rate: Decimal, tenor_months: int
) -> List[Dict[str, Any]]:
    """Generate month-by-month repayment amortization schedule.

    Guarantees that the sum of principal payments matches initial principal exactly
    and remaining balance closes to 0.00 on the final payment installment.
    """
    if tenor_months <= 0 or principal <= Decimal("0"):
        return []

    emi = calculate_emi(principal, annual_rate, tenor_months)
    r = (annual_rate / PERCENT_DIVISOR) if annual_rate > Decimal("0") else Decimal("0")

    schedule: List[Dict[str, Any]] = []
    balance = principal

    for month in range(1, tenor_months + 1):
        interest_payment = quantize_currency(balance * r)

        if month == tenor_months:
            # Final month adjustments to close balance to exact zero
            principal_payment = balance
            payment = principal_payment + interest_payment
            closing_balance = Decimal("0.00")
        else:
            principal_payment = min(emi - interest_payment, balance)
            payment = principal_payment + interest_payment
            closing_balance = quantize_currency(balance - principal_payment)

        schedule.append(
            {
                "month": month,
                "payment": str(payment),
                "principal": str(principal_payment),
                "interest": str(interest_payment),
                "remaining_balance": str(closing_balance),
            }
        )
        balance = closing_balance

    return schedule
