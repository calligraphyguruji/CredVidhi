import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateWizardStep,
  validateFile,
  type WizardValues,
} from "../utils/applicationValidation.ts";
import type { LoanProduct } from "../types/index.ts";

const product = {
  id: "p1",
  minAmount: 10000,
  maxAmount: 1000000,
  minTenorMonths: 12,
  maxTenorMonths: 60,
  requiredDocuments: [
    { code: "PAN_CARD", title: "Identity proof", mandatory: true },
    { code: "OTHER", title: "Optional", mandatory: false },
  ],
} as LoanProduct;
const valid: WizardValues = {
  productId: "p1",
  requestedAmount: "50000",
  requestedTenorMonths: "24",
  purpose: "Renovation",
  personal: {
    fullName: "Real Borrower",
    email: "real@example.com",
    phone: "+919123456789",
    dateOfBirth: "1990-01-01",
    residentialAddress: "Borrower address",
    taxId: "",
  },
  financial: {
    employmentType: "SALARIED",
    employerName: "Actual employer",
    jobTitle: "Engineer",
    yearsEmployed: "0",
    grossMonthlyIncome: "50000",
    housingExpense: "0",
    existingMonthlyDebt: "0",
    creditScoreDeclared: "",
  },
};
test("all required steps accept complete inputs including zero expenses and blank optional score", () => {
  for (const step of [1, 2, 3])
    assert.deepEqual(validateWizardStep(step, valid, product), {});
});
test("empty steps and partially completed steps block navigation", () => {
  assert.equal(
    Object.keys(
      validateWizardStep(
        1,
        {
          ...valid,
          productId: "",
          requestedAmount: "",
          requestedTenorMonths: "",
          purpose: "",
        },
        undefined,
      ),
    ).length,
    4,
  );
  assert.ok(
    validateWizardStep(
      2,
      { ...valid, personal: { ...valid.personal, phone: "" } },
      product,
    )["personal.phone"],
  );
  assert.ok(
    validateWizardStep(
      3,
      { ...valid, financial: { ...valid.financial, employerName: "" } },
      product,
    )["financial.employerName"],
  );
});
for (const [field, value] of [
  ["grossMonthlyIncome", "0"],
  ["grossMonthlyIncome", ""],
  ["grossMonthlyIncome", "-10"],
  ["housingExpense", ""],
  ["housingExpense", "-1"],
  ["existingMonthlyDebt", ""],
  ["existingMonthlyDebt", "-1"],
  ["yearsEmployed", "-1"],
  ["creditScoreDeclared", "299"],
  ["creditScoreDeclared", "901"],
  ["creditScoreDeclared", "700.5"],
  ["employmentType", ""],
  ["jobTitle", ""],
])
  test(`rejects invalid financial ${field}=${value}`, () =>
    assert.ok(
      Object.keys(
        validateWizardStep(
          3,
          { ...valid, financial: { ...valid.financial, [field]: value } },
          product,
        ),
      ).length,
    ));
test("dependent product limits revalidate and whole tenure is required", () => {
  assert.ok(
    validateWizardStep(1, valid, { ...product, maxAmount: 40000 })
      .requestedAmount,
  );
  assert.ok(
    validateWizardStep(1, { ...valid, requestedTenorMonths: "12.5" }, product)
      .requestedTenorMonths,
  );
});
test("self employed job title optional; blank score differs from zero", () => {
  assert.deepEqual(
    validateWizardStep(
      3,
      {
        ...valid,
        financial: {
          ...valid.financial,
          employmentType: "SELF_EMPLOYED",
          jobTitle: "",
        },
      },
      product,
    ),
    {},
  );
  assert.ok(
    validateWizardStep(
      3,
      { ...valid, financial: { ...valid.financial, creditScoreDeclared: "0" } },
      product,
    )["financial.creditScoreDeclared"],
  );
});
test("invalid email, phone, date and missing address are reported", () => {
  const errors = validateWizardStep(
    2,
    {
      ...valid,
      personal: {
        ...valid.personal,
        email: "invalid",
        phone: "abc",
        dateOfBirth: "2025-02-30",
        residentialAddress: "",
      },
    },
    product,
  );
  assert.equal(Object.keys(errors).length, 4);
});
test("mandatory uploads and consent required; optional uploads never block", () => {
  assert.ok(validateWizardStep(4, valid, product)["documents.PAN_CARD"]);
  const docs = [
    {
      id: "doc",
      document_type: "PAN_CARD",
      original_filename: "proof.pdf",
      file_size_bytes: 100,
      verification_status: "PENDING",
    },
  ];
  assert.deepEqual(validateWizardStep(4, valid, product, docs, true), {});
  assert.ok(
    validateWizardStep(
      4,
      valid,
      product,
      [{ ...docs[0], verification_status: "REJECTED" }],
      true,
    )["documents.PAN_CARD"],
  );
});
test("file validation rejects mismatched type, empty and oversized uploads", () => {
  assert.equal(
    validateFile({ name: "proof.pdf", type: "application/pdf", size: 100 }),
    undefined,
  );
  for (const file of [
    { name: "bad.exe", type: "application/pdf", size: 1 },
    { name: "proof.pdf", type: "image/png", size: 100 },
    { name: "proof.pdf", type: "application/pdf", size: 0 },
    { name: "proof.pdf", type: "application/pdf", size: 10485761 },
  ])
    assert.ok(validateFile(file));
});
