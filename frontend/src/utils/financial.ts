/**
 * Financial calculation engine matching PRD Section 5.5 and RULES.md
 */

/**
 * Calculates Equated Monthly Installment (EMI) using the standard compound amortization formula:
 * E = P * r * (1 + r)^n / ((1 + r)^n - 1)
 *
 * @param principal Loan principal amount (P)
 * @param annualRatePercentage Annual interest rate in percent (e.g., 10.5 for 10.5%)
 * @param tenorMonths Loan duration in months (n)
 * @returns Monthly EMI amount rounded to 2 decimal places
 */
export function calculateEmi(principal: number, annualRatePercentage: number, tenorMonths: number): number {
  if (principal <= 0 || tenorMonths <= 0) return 0;
  if (annualRatePercentage <= 0) return Math.round((principal / tenorMonths) * 100) / 100;

  const monthlyRate = annualRatePercentage / 12 / 100;
  const factor = Math.pow(1 + monthlyRate, tenorMonths);
  const emi = (principal * monthlyRate * factor) / (factor - 1);

  return Math.round(emi * 100) / 100;
}

/**
 * Calculates Debt-to-Income (DTI) ratio:
 * DTI = ((Existing Monthly Debt + New Monthly EMI) / Gross Monthly Income) * 100
 */
export function calculateDti(
  grossMonthlyIncome: number,
  existingMonthlyDebt: number,
  newMonthlyEmi: number
): number {
  if (grossMonthlyIncome <= 0) return 100;
  const totalDebt = existingMonthlyDebt + newMonthlyEmi;
  const ratio = (totalDebt / grossMonthlyIncome) * 100;
  return Math.round(ratio * 10) / 10;
}

/**
 * Calculates Disposable Income:
 * Disposable = Gross Monthly Income - (Existing Debt + Housing Expense + New EMI)
 */
export function calculateDisposableIncome(
  grossMonthlyIncome: number,
  existingMonthlyDebt: number,
  housingExpense: number,
  newMonthlyEmi: number
): number {
  const disposable = grossMonthlyIncome - (existingMonthlyDebt + housingExpense + newMonthlyEmi);
  return Math.round(disposable * 100) / 100;
}

/**
 * Formats a numeric currency value to standard USD format ($XX,XXX.XX)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a date string to institutional ISO/display format
 */
export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return isoString;
  }
}
