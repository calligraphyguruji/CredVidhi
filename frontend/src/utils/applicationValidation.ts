import type { LoanProduct } from "../types";
export interface WizardValues {
  productId: string;
  requestedAmount: string;
  requestedTenorMonths: string;
  purpose: string;
  personal: {
    fullName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    residentialAddress: string;
    taxId: string;
  };
  financial: {
    employmentType: string;
    employerName: string;
    jobTitle: string;
    yearsEmployed: string;
    grossMonthlyIncome: string;
    housingExpense: string;
    existingMonthlyDebt: string;
    creditScoreDeclared: string;
  };
}
export type FieldErrors = Record<string, string>;
export interface UploadedDocument {
  id: string;
  document_type: string;
  original_filename: string;
  file_size_bytes: number;
  verification_status: string;
  verification_remarks?: string;
}
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export function validateFile(file: {
  name: string;
  size: number;
  type: string;
}): string | undefined {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const mime = (
    {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
    } as Record<string, string>
  )[extension];
  if (!mime || mime !== file.type)
    return "Choose a PDF, PNG or JPEG with a matching file type.";
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > MAX_DOCUMENT_BYTES) return "Files must be 10 MB or smaller.";
}
export function validateWizardStep(
  step: number,
  values: WizardValues,
  product: LoanProduct | undefined,
  documents: UploadedDocument[] = [],
  consent = false,
): FieldErrors {
  const errors: FieldErrors = {};
  const numeric = (
    key: string,
    text: string,
    label: string,
    positive = false,
  ) => {
    if (text.trim() === "") errors[key] = `Please enter ${label}.`;
    else if (
      !Number.isFinite(Number(text)) ||
      (positive ? Number(text) <= 0 : Number(text) < 0)
    )
      errors[key] =
        `${label[0].toUpperCase() + label.slice(1)} must be ${positive ? "a positive number" : "a non-negative number"}.`;
  };
  if (step === 1) {
    if (!product || values.productId !== product.id)
      errors.productId = "Please select a loan product.";
    numeric(
      "requestedAmount",
      values.requestedAmount,
      "your requested loan amount",
      true,
    );
    numeric(
      "requestedTenorMonths",
      values.requestedTenorMonths,
      "your loan tenure",
      true,
    );
    if (
      !errors.requestedAmount &&
      product &&
      (Number(values.requestedAmount) < product.minAmount ||
        Number(values.requestedAmount) > product.maxAmount)
    )
      errors.requestedAmount = `Amount must be between ₹${product.minAmount.toLocaleString("en-IN")} and ₹${product.maxAmount.toLocaleString("en-IN")}.`;
    if (
      !errors.requestedTenorMonths &&
      (!Number.isInteger(Number(values.requestedTenorMonths)) ||
        (product &&
          (Number(values.requestedTenorMonths) < product.minTenorMonths ||
            Number(values.requestedTenorMonths) > product.maxTenorMonths)))
    )
      errors.requestedTenorMonths = `Enter a whole-number tenure between ${product?.minTenorMonths} and ${product?.maxTenorMonths} months.`;
    if (!values.purpose.trim())
      errors.purpose = "Please enter your loan purpose.";
    else if (values.purpose.length > 500)
      errors.purpose = "Loan purpose must be 500 characters or fewer.";
  }
  if (step === 2) {
    const p = values.personal;
    if (!p.fullName.trim())
      errors["personal.fullName"] = "Please enter your full legal name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim()))
      errors["personal.email"] = "Please enter a valid email address.";
    if (
      !/^[+\d ()\-.]+$/.test(p.phone) ||
      p.phone.length > 20 ||
      !/^\d{8,15}$/.test(p.phone.replace(/\D/g, ""))
    )
      errors["personal.phone"] = "Enter a valid phone number with 8–15 digits.";
    const date = new Date(`${p.dateOfBirth}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(p.dateOfBirth) ||
      !Number.isFinite(date.getTime()) ||
      date.getFullYear() !== Number(p.dateOfBirth.slice(0, 4)) ||
      date.getMonth() + 1 !== Number(p.dateOfBirth.slice(5, 7)) ||
      date.getDate() !== Number(p.dateOfBirth.slice(8, 10)) ||
      date >= today
    )
      errors["personal.dateOfBirth"] =
        "Enter a valid date of birth in the past.";
    if (!p.residentialAddress.trim())
      errors["personal.residentialAddress"] =
        "Please enter your residential address.";
    if (p.fullName.length > 200)
      errors["personal.fullName"] =
        "Full name must be 200 characters or fewer.";
    if (p.residentialAddress.length > 1000)
      errors["personal.residentialAddress"] =
        "Address must be 1,000 characters or fewer.";
  }
  if (step === 3) {
    const f = values.financial;
    if (!["SALARIED", "SELF_EMPLOYED"].includes(f.employmentType))
      errors["financial.employmentType"] =
        "Please select your employment status.";
    if (!f.employerName.trim())
      errors["financial.employerName"] =
        "Employer or business name is required.";
    if (f.employmentType === "SALARIED" && !f.jobTitle.trim())
      errors["financial.jobTitle"] =
        "Job title is required for salaried applicants.";
    if (f.employerName.length > 255)
      errors["financial.employerName"] =
        "Employer name must be 255 characters or fewer.";
    if (f.jobTitle.length > 255)
      errors["financial.jobTitle"] =
        "Job title must be 255 characters or fewer.";
    numeric(
      "financial.yearsEmployed",
      f.yearsEmployed,
      "years with your current employer",
    );
    numeric(
      "financial.grossMonthlyIncome",
      f.grossMonthlyIncome,
      "your gross monthly income",
      true,
    );
    numeric(
      "financial.housingExpense",
      f.housingExpense,
      "monthly housing expenses",
    );
    numeric(
      "financial.existingMonthlyDebt",
      f.existingMonthlyDebt,
      "monthly debt commitments",
    );
    if (
      f.creditScoreDeclared.trim() !== "" &&
      (!Number.isInteger(Number(f.creditScoreDeclared)) ||
        Number(f.creditScoreDeclared) < 300 ||
        Number(f.creditScoreDeclared) > 900)
    )
      errors["financial.creditScoreDeclared"] =
        "Enter a whole-number credit score from 300 to 900, or leave it blank.";
  }
  if (step === 4) {
    for (const requirement of product?.requiredDocuments || []) {
      if (
        requirement.mandatory &&
        !documents.some(
          (d) =>
            d.document_type === requirement.code &&
            ["PENDING", "VERIFIED"].includes(d.verification_status),
        )
      )
        errors[`documents.${requirement.code}`] =
          `Upload ${requirement.title}.`;
    }
    if (!consent)
      errors.consent = "Please confirm the application declaration.";
  }
  return errors;
}
