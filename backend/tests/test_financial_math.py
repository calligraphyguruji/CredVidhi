"""Tests for Deterministic Arbitrary-Precision Financial Math Engine."""

from decimal import Decimal

import pytest

from app.services.financial_engine import (
    calculate_disposable_income,
    calculate_dti,
    calculate_emi,
    generate_amortization_schedule,
)


def test_emi_standard_compounding_values() -> None:
    """Verify standard banking compound amortization benchmark values to 2 decimal places."""
    # Test case 1: 500,000 INR @ 10.5% for 24 months
    emi_1 = calculate_emi(
        principal=Decimal("500000.00"),
        annual_rate=Decimal("10.50"),
        tenor_months=24,
    )
    assert emi_1 == Decimal("23188.02")

    # Test case 2: 1,000,000 INR @ 12.0% for 36 months
    emi_2 = calculate_emi(
        principal=Decimal("1000000.00"),
        annual_rate=Decimal("12.00"),
        tenor_months=36,
    )
    assert emi_2 == Decimal("33214.31")

    # Test case 3: 2,500,000 INR @ 8.75% for 60 months
    emi_3 = calculate_emi(
        principal=Decimal("2500000.00"),
        annual_rate=Decimal("8.75"),
        tenor_months=60,
    )
    assert emi_3 == Decimal("51593.08")


def test_emi_edge_cases() -> None:
    """Verify edge conditions: 0% interest, 0 principal, invalid tenor."""
    # 0% interest loan -> exact division by tenor
    emi_zero_interest = calculate_emi(
        principal=Decimal("120000.00"),
        annual_rate=Decimal("0.00"),
        tenor_months=12,
    )
    assert emi_zero_interest == Decimal("10000.00")

    # Zero principal -> 0.00
    emi_zero_principal = calculate_emi(
        principal=Decimal("0.00"),
        annual_rate=Decimal("12.00"),
        tenor_months=12,
    )
    assert emi_zero_principal == Decimal("0.00")

    # Invalid tenor <= 0 raises ValueError
    with pytest.raises(ValueError, match="Loan tenor must be at least 1 month"):
        calculate_emi(
            principal=Decimal("100000.00"),
            annual_rate=Decimal("10.00"),
            tenor_months=0,
        )


def test_dti_ratio_calculations() -> None:
    """Verify Debt-To-Income (DTI) calculations and boundaries."""
    # Normal case: Gross income 100,000, existing debts 20,000, new emi 15,000 -> 35%
    dti_normal = calculate_dti(
        gross_monthly_income=Decimal("100000.00"),
        existing_debts=Decimal("20000.00"),
        proposed_emi=Decimal("15000.00"),
    )
    assert dti_normal == Decimal("35.00")

    # High debt case: Gross income 50,000, existing debts 25,000, new emi 10,000 -> 70%
    dti_high = calculate_dti(
        gross_monthly_income=Decimal("50000.00"),
        existing_debts=Decimal("25000.00"),
        proposed_emi=Decimal("10000.00"),
    )
    assert dti_high == Decimal("70.00")

    # Zero income case -> caps to 100%
    dti_zero_income = calculate_dti(
        gross_monthly_income=Decimal("0.00"),
        existing_debts=Decimal("10000.00"),
        proposed_emi=Decimal("5000.00"),
    )
    assert dti_zero_income == Decimal("100.00")


def test_disposable_income_surplus() -> None:
    """Verify net monthly disposable income surplus calculation."""
    # Positive surplus: 100,000 - (20,000 debts + 15,000 housing + 23,188.02 emi) = 41,811.98
    surplus_positive = calculate_disposable_income(
        gross_monthly_income=Decimal("100000.00"),
        existing_debts=Decimal("20000.00"),
        housing_expenses=Decimal("15000.00"),
        proposed_emi=Decimal("23188.02"),
    )
    assert surplus_positive == Decimal("41811.98")

    # Deficit / negative surplus: 40,000 - (20,000 debts + 15,000 housing + 10,000 emi) = -5,000.00
    surplus_negative = calculate_disposable_income(
        gross_monthly_income=Decimal("40000.00"),
        existing_debts=Decimal("20000.00"),
        housing_expenses=Decimal("15000.00"),
        proposed_emi=Decimal("10000.00"),
    )
    assert surplus_negative == Decimal("-5000.00")


def test_amortization_schedule_reconciliation() -> None:
    """Verify that amortization schedule closes to exact 0.00 balance and principal sums match."""
    principal = Decimal("500000.00")
    apr = Decimal("10.50")
    tenor = 24

    schedule = generate_amortization_schedule(principal, apr, tenor)
    assert len(schedule) == tenor

    # Verify each row structure and types
    total_principal_paid = Decimal("0.00")
    total_interest_paid = Decimal("0.00")

    for row in schedule:
        assert "month" in row
        assert "payment" in row
        assert "principal" in row
        assert "interest" in row
        assert "remaining_balance" in row

        p = Decimal(row["principal"])
        i = Decimal(row["interest"])
        total_principal_paid += p
        total_interest_paid += i

    # Sum of principal paid across 24 months must match initial principal to the cent
    assert total_principal_paid == principal
    # Final installment remaining balance must be exactly 0.00
    assert Decimal(schedule[-1]["remaining_balance"]) == Decimal("0.00")
    assert total_interest_paid > Decimal("0.00")


def test_amortization_single_month_and_zero_interest() -> None:
    """Verify amortization schedule on edge cases (1 month loan, 0% interest)."""
    # 1 month loan
    sched_1m = generate_amortization_schedule(
        principal=Decimal("10000.00"),
        annual_rate=Decimal("12.00"),
        tenor_months=1,
    )
    assert len(sched_1m) == 1
    assert Decimal(sched_1m[0]["principal"]) == Decimal("10000.00")
    assert Decimal(sched_1m[0]["interest"]) == Decimal("100.00")
    assert Decimal(sched_1m[0]["remaining_balance"]) == Decimal("0.00")

    # 0% interest loan
    sched_zero_apr = generate_amortization_schedule(
        principal=Decimal("60000.00"),
        annual_rate=Decimal("0.00"),
        tenor_months=6,
    )
    assert len(sched_zero_apr) == 6
    for row in sched_zero_apr:
        assert Decimal(row["interest"]) == Decimal("0.00")
        assert Decimal(row["principal"]) == Decimal("10000.00")
    assert Decimal(sched_zero_apr[-1]["remaining_balance"]) == Decimal("0.00")
