import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Upload } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ApiError, applicationsApi, documentsApi } from "../../services/api";
import {
  validateWizardStep,
  validateFile,
  type WizardValues,
  type FieldErrors,
  type UploadedDocument,
} from "../../utils/applicationValidation";

type Job = {
  id: string;
  file: File;
  category: string;
  replacement?: string;
  status: "Uploading" | "Failed";
  progress: number;
  error?: string;
};
const steps = ["Specifications", "Personal", "Financials", "Documents"];
const message = (error: unknown) =>
  error instanceof Error ? error.message : "The request failed. Please retry.";

export function LoanApplicationWizard({
  isOpen,
  onClose,
  onSubmitted,
  resumeId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: (id: string) => void;
  resumeId?: string;
}) {
  const { products, currentUser, submitNewApplication, refreshFromBackend } =
    useApp();
  const initialValues = (): WizardValues => ({
    productId: "",
    requestedAmount: "",
    requestedTenorMonths: "",
    purpose: "",
    personal: {
      fullName: currentUser.fullName || "",
      email: currentUser.email || "",
      phone: currentUser.phone || "",
      dateOfBirth: "",
      residentialAddress: "",
      taxId: "",
    },
    financial: {
      employmentType: "",
      employerName: "",
      jobTitle: "",
      yearsEmployed: "",
      grossMonthlyIncome: "",
      housingExpense: "",
      existingMonthlyDebt: "",
      creditScoreDeclared: "",
    },
  });
  const [values, setValues] = useState<WizardValues>(initialValues);
  const [step, setStep] = useState(1);
  const [visitedStep, setVisitedStep] = useState(1);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState<number[]>([]);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resumeLoadError, setResumeLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const draftId = useRef<string | undefined>(undefined);
  const lock = useRef(false);
  const completed = useRef(false);
  const loadedResume = useRef<string | undefined>(undefined);
  const root = useRef<HTMLDivElement>(null);
  const product = products.find((p) => p.id === values.productId);
  const uploading = jobs.some((j) => j.status === "Uploading");
  const sessionIdentity = useRef(currentUser.id);
  const mounted = useRef(true);
  useEffect(() => {
    sessionIdentity.current = currentUser.id;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const isCurrent = () =>
    mounted.current && sessionIdentity.current === currentUser.id;

  useEffect(() => {
    if (!isOpen) return;
    if (completed.current) {
      setValues(initialValues());
      setDocuments([]);
      setJobs([]);
      setConsent(false);
      setStep(1);
      setVisitedStep(1);
      setErrors({});
      setAttempted([]);
      setError("");
      draftId.current = undefined;
      loadedResume.current = undefined;
      completed.current = false;
    }
    if (!resumeId || loadedResume.current === resumeId) return;
    let cancelled = false;
    draftId.current = resumeId;
    setResumeLoadError(false);
    setBusy(true);
    lock.current = true;
    setError("");
    Promise.all([
      applicationsApi.getById(resumeId),
      documentsApi.list(resumeId),
    ])
      .then(([draft, files]) => {
        if (cancelled) return;
        if (draft.status !== "DRAFT")
          throw new Error(
            "This application has already left draft status. Refresh the dashboard to view it.",
          );
        const p = draft.applicant_personal_snapshot || {};
        const f = draft.applicant_financial_snapshot || {};
        const text = (value: unknown) =>
          value === null || value === undefined ? "" : String(value);
        setValues({
          productId: draft.product_id,
          requestedAmount: text(draft.requested_amount),
          requestedTenorMonths: text(draft.requested_tenor_months),
          purpose: draft.purpose || "",
          personal: {
            fullName: currentUser.fullName || p.fullName || p.full_name || "",
            email: currentUser.email || p.email || "",
            phone: p.phone || p.phone_number || currentUser.phone || "",
            dateOfBirth: p.dateOfBirth || p.date_of_birth || "",
            residentialAddress:
              p.residentialAddress || p.residential_address || "",
            taxId: "",
          },
          financial: {
            employmentType: f.employmentType || f.employment_type || "",
            employerName: f.employerName || f.employer_name || "",
            jobTitle: f.jobTitle || f.job_title || "",
            yearsEmployed: text(f.yearsEmployed ?? f.years_employed),
            grossMonthlyIncome: text(
              f.grossMonthlyIncome ?? f.gross_monthly_income,
            ),
            housingExpense: text(f.housingExpense ?? f.housing_expense),
            existingMonthlyDebt: text(
              f.existingMonthlyDebt ?? f.existing_monthly_debt,
            ),
            creditScoreDeclared: text(
              f.creditScoreDeclared ?? f.credit_score_declared,
            ),
          },
        });
        draftId.current = resumeId;
        loadedResume.current = resumeId;
        setDocuments(files);
        setJobs([]);
        setConsent(p.declarationConsent === true);
        setStep(1);
        setVisitedStep(1);
        setErrors({});
        setAttempted([]);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(message(e));
          setResumeLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
          lock.current = false;
        }
      });
    return () => {
      cancelled = true;
      lock.current = false;
    };
    // Profile is stable for the lifetime of this authenticated wizard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, resumeId, loadAttempt]);

  const focusError = (fields: FieldErrors) =>
    window.setTimeout(() => {
      const first = Object.keys(fields)[0];
      const element =
        root.current?.querySelector<HTMLElement>(`[data-field="${first}"]`) ||
        root.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      element?.focus();
      element?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 0);
  const showRequestError = (failure: unknown) => {
    setError(message(failure));
    if (failure instanceof ApiError && failure.details?.fields) {
      const fields = failure.details.fields as FieldErrors;
      const first = Object.keys(fields)[0] || "";
      setErrors(fields);
      setStep(
        first.startsWith("personal.")
          ? 2
          : first.startsWith("financial")
            ? 3
            : first.startsWith("documents") || first === "consent"
              ? 4
              : 1,
      );
      focusError(fields);
    }
  };
  const validateThrough = (last: number) => {
    for (let index = 1; index <= last; index++) {
      const found = validateWizardStep(
        index,
        values,
        product,
        documents,
        consent,
      );
      if (Object.keys(found).length) {
        setStep(index);
        setAttempted((a) => [...new Set([...a, index])]);
        setErrors(found);
        focusError(found);
        return false;
      }
    }
    setErrors({});
    return true;
  };
  const change = (key: string, value: string) => {
    const next = {
      ...values,
      personal: { ...values.personal },
      financial: { ...values.financial },
    };
    const [group, field] = key.split(".");
    if (group === "personal")
      next.personal[field as keyof WizardValues["personal"]] = value;
    else if (group === "financial")
      next.financial[field as keyof WizardValues["financial"]] = value;
    else
      next[
        group as
          "productId" | "requestedAmount" | "requestedTenorMonths" | "purpose"
      ] = value;
    setValues(next);
    setErrors(
      attempted.includes(step)
        ? validateWizardStep(
            step,
            next,
            products.find((p) => p.id === next.productId),
            documents,
            consent,
          )
        : {},
    );
  };
  const saveDraft = async () => {
    if (!draftId.current) draftId.current = crypto.randomUUID();
    const payload = {
      draft_id: draftId.current,
      product_id: values.productId,
      requested_amount: Number(values.requestedAmount),
      requested_tenor_months: Number(values.requestedTenorMonths),
      purpose: values.purpose.trim(),
    };
    // Reusing this UUID makes creation safe to retry after an interrupted response.
    const draft = await applicationsApi.createDraft(payload);
    if (draft.status !== "DRAFT") {
      if (draft.submitted_at) return draft;
      throw new Error(
        "This application can no longer be edited. Refresh the dashboard.",
      );
    }
    const financial = Object.fromEntries(
      Object.entries(values.financial).map(([key, value]) => [
        key,
        ["employmentType", "employerName", "jobTitle"].includes(key)
          ? value.trim()
          : value.trim() === ""
            ? null
            : Number(value),
      ]),
    );
    const personal: Record<string, unknown> = {
      ...values.personal,
      declarationConsent: consent,
    };
    if (!values.personal.taxId.trim()) delete personal.taxId;
    return applicationsApi.updateDraft(draftId.current, {
      product_id: values.productId,
      requested_amount: Number(values.requestedAmount),
      requested_tenor_months: Number(values.requestedTenorMonths),
      purpose: values.purpose.trim(),
      applicant_personal_snapshot: personal,
      applicant_financial_snapshot: financial,
    });
  };
  const navigate = async (target: number) => {
    if (lock.current || uploading || resumeLoadError) return;
    if (target <= step) {
      setStep(target);
      setErrors({});
      return;
    }
    if (!validateThrough(target - 1)) return;
    if (target !== 4) {
      setStep(target);
      setVisitedStep((previous) => Math.max(previous, target));
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const draft = await saveDraft();
      if (draft.status !== "DRAFT")
        throw new Error(
          "This application has already been submitted. Refresh the dashboard.",
        );
      setDocuments(await documentsApi.list(draft.id));
      setStep(4);
      setVisitedStep(4);
      await refreshFromBackend();
    } catch (e) {
      showRequestError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const submit = async () => {
    if (lock.current || uploading || !validateThrough(4)) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const draft = await saveDraft();
      const id = await submitNewApplication(draft.id);
      if (!isCurrent()) return;
      completed.current = true;
      onSubmitted(id);
    } catch (e) {
      showRequestError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const runUpload = async (job: Job) => {
    setJobs((previous) => [
      ...previous.filter((j) => j.id !== job.id),
      { ...job, status: "Uploading", progress: 0, error: undefined },
    ]);
    try {
      const result = await documentsApi.uploadMultipart(
        draftId.current!,
        job.file,
        job.category,
        (progress) =>
          setJobs((previous) =>
            previous.map((j) => (j.id === job.id ? { ...j, progress } : j)),
          ),
        job.replacement,
      );
      if (!isCurrent()) return;
      setDocuments((previous) => [
        ...previous.filter(
          (d) => d.id !== result.id && d.id !== job.replacement,
        ),
        result,
      ]);
      setJobs((previous) => previous.filter((j) => j.id !== job.id));
      setErrors((previous) => {
        const next = { ...previous };
        delete next[`documents.${job.category}`];
        return next;
      });
    } catch (e) {
      setJobs((previous) =>
        previous.map((j) =>
          j.id === job.id ? { ...j, status: "Failed", error: message(e) } : j,
        ),
      );
    }
  };
  const addFiles = async (
    files: FileList | File[] | null,
    category: string,
    replacement?: string,
  ) => {
    if (!files || busy || uploading || !draftId.current) return;
    const queue = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      category,
      replacement,
      status: "Uploading" as const,
      progress: 0,
    }));
    setJobs((previous) => [...previous, ...queue]);
    for (const job of queue) {
      const invalid = validateFile(job.file);
      if (invalid)
        setJobs((previous) =>
          previous.map((j) =>
            j.id === job.id ? { ...j, status: "Failed", error: invalid } : j,
          ),
        );
      else await runUpload(job);
    }
    await refreshFromBackend();
  };
  const withdraw = async (id: string) => {
    if (lock.current || uploading) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await documentsApi.withdraw(draftId.current!, id);
      setDocuments((previous) => previous.filter((d) => d.id !== id));
      await refreshFromBackend();
    } catch (e) {
      showRequestError(e);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  const input = (
    key: string,
    label: string,
    type = "text",
    required = true,
    helperText?: string,
    readOnly = false,
  ) => {
    const [group, field] = key.split(".");
    const value =
      group === "personal"
        ? values.personal[field as keyof WizardValues["personal"]]
        : group === "financial"
          ? values.financial[field as keyof WizardValues["financial"]]
          : values[
              group as keyof Pick<
                WizardValues,
                "requestedAmount" | "requestedTenorMonths" | "purpose"
              >
            ];
    return (
      <Input
        key={key}
        id={`wizard-${key}`}
        data-field={key}
        label={label}
        type={type}
        required={required}
        readOnly={readOnly}
        value={value}
        onChange={(e) => change(key, e.target.value)}
        error={errors[key]}
        helperText={helperText}
        className="min-h-11 text-base"
        step={type === "number" ? "any" : undefined}
      />
    );
  };
  const select = (
    key: string,
    label: string,
    value: string,
    options: { value: string; label: string }[],
  ) => (
    <div>
      <label
        htmlFor={`wizard-${key}`}
        className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
      >
        {label} <span className="text-orange-500">*</span>
      </label>
      <select
        id={`wizard-${key}`}
        data-field={key}
        required
        value={value}
        onChange={(e) => change(key, e.target.value)}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `error-${key}` : undefined}
        className={`w-full min-h-11 rounded-md px-3 bg-white dark:bg-slate-900 border ${errors[key] ? "border-rose-500" : "border-slate-300 dark:border-slate-700"} focus:ring-orange-500`}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {errors[key] && (
        <p
          id={`error-${key}`}
          role="alert"
          className="text-xs text-rose-500 mt-1"
        >
          {errors[key]}
        </p>
      )}
    </div>
  );
  const requirements = product?.requiredDocuments || [];
  const previousCategories = [...new Set(documents.map((d) => d.document_type))]
    .filter(
      (code) => !requirements.some((r) => r.code === code) && code !== "OTHER",
    )
    .map((code) => ({
      code,
      title: code.replaceAll("_", " "),
      mandatory: false,
    }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeDisabled={busy || uploading}
      maxWidth="wizard"
      title="Multi-Step Loan Application Wizard"
      description="Complete your details and supporting documents before submitting for review."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <Button
            variant="outline"
            onClick={() => (step === 1 ? onClose() : navigate(step - 1))}
            disabled={busy || uploading}
          >
            {step === 1 ? "Close" : "Back"}
          </Button>
          <Button
            onClick={() => (step < 4 ? navigate(step + 1) : submit())}
            isLoading={busy}
            disabled={uploading || resumeLoadError}
          >
            {step < 4 ? "Save & Proceed →" : "Submit Application to CredVidhi"}
          </Button>
        </div>
      }
    >
      <div ref={root} className="space-y-6 text-slate-800 dark:text-slate-200">
        <nav
          aria-label="Application steps"
          className="grid grid-cols-2 sm:grid-cols-4 gap-2"
        >
          {steps.map((label, index) => {
            const number = index + 1;
            const done =
              number !== step &&
              number <= visitedStep &&
              !Object.keys(
                validateWizardStep(number, values, product, documents, consent),
              ).length;
            return (
              <button
                key={label}
                type="button"
                aria-current={step === number ? "step" : undefined}
                onClick={() => navigate(number)}
                disabled={busy || uploading || resumeLoadError}
                className={`flex items-center gap-2 rounded-md p-3 text-sm text-left border ${step === number ? "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400" : "border-slate-200 dark:border-slate-700"}`}
              >
                <span className="shrink-0">
                  {done ? <CheckCircle2 size={18} /> : `${number}.`}
                </span>
                {label}
                <span className="sr-only">
                  {done
                    ? "Completed"
                    : step === number
                      ? "Current step"
                      : "Incomplete"}
                </span>
              </button>
            );
          })}
        </nav>
        {error && (
          <div
            role="alert"
            className="border border-rose-500 rounded-md p-3 text-sm text-rose-500"
          >
            {error}{" "}
            <button
              className="underline"
              onClick={() =>
                resumeLoadError
                  ? setLoadAttempt((previous) => previous + 1)
                  : step === 4
                    ? submit()
                    : navigate(step + 1)
              }
              disabled={busy}
            >
              Retry
            </button>
          </div>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Fields marked <span className="text-orange-500">*</span> are required.{" "}
          {draftId.current
            ? "Your draft is saved. Uploads stay attached when you return."
            : "A draft will be saved when you continue to Documents."}
        </p>
        <fieldset
          disabled={busy || uploading || resumeLoadError}
          className="min-w-0"
        >
          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {select(
                "productId",
                "Loan Product",
                values.productId,
                products
                  .filter((p) => p.isActive)
                  .map((p) => ({ value: p.id, label: p.name })),
              )}
              {input(
                "requestedAmount",
                "Requested Loan Amount (₹)",
                "number",
                true,
                product
                  ? `₹${product.minAmount.toLocaleString("en-IN")}–₹${product.maxAmount.toLocaleString("en-IN")}`
                  : "Select a product to see its limits.",
              )}
              {input(
                "requestedTenorMonths",
                "Loan Tenure (Months)",
                "number",
                true,
                product
                  ? `${product.minTenorMonths}–${product.maxTenorMonths} months`
                  : undefined,
              )}
              {input("purpose", "Loan Purpose")}
            </div>
          )}
          {step === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {input(
                "personal.fullName",
                "Full Legal Name",
                "text",
                true,
                currentUser.fullName
                  ? "From your authenticated profile."
                  : undefined,
                !!currentUser.fullName,
              )}
              {input(
                "personal.email",
                "Email Address",
                "email",
                true,
                currentUser.email
                  ? "From your authenticated profile."
                  : undefined,
                !!currentUser.email,
              )}
              {input("personal.phone", "Phone Number", "tel")}
              {input("personal.dateOfBirth", "Date of Birth", "date")}
              {input("personal.residentialAddress", "Residential Address")}
              {input(
                "personal.taxId",
                "Tax Identifier (Optional)",
                "text",
                false,
                "Optional here; identity documents are checked during verification.",
              )}
            </div>
          )}
          {step === 3 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {select(
                "financial.employmentType",
                "Employment Status",
                values.financial.employmentType,
                [
                  { value: "SALARIED", label: "Salaried" },
                  { value: "SELF_EMPLOYED", label: "Self-Employed" },
                ],
              )}
              {input("financial.employerName", "Employer / Business Name")}
              {input(
                "financial.jobTitle",
                "Job Title",
                "text",
                values.financial.employmentType === "SALARIED",
              )}
              {input(
                "financial.yearsEmployed",
                "Years With Current Employer",
                "number",
                true,
                "Zero is accepted for a newly started role or business.",
              )}
              {input(
                "financial.grossMonthlyIncome",
                "Gross Monthly Income (₹)",
                "number",
              )}
              {input(
                "financial.housingExpense",
                "Monthly Housing Expenses (₹)",
                "number",
                true,
                "Enter 0 if you have no housing expenses.",
              )}
              {input(
                "financial.creditScoreDeclared",
                "Declared Credit Score (Optional)",
                "number",
                false,
                "300–900, if known. This is not a verified credit evaluation.",
              )}
              {input(
                "financial.existingMonthlyDebt",
                "Existing Monthly Debt Commitments (₹)",
                "number",
                true,
                "Enter 0 if you have no existing debt.",
              )}
            </div>
          )}
          {step === 4 && (
            <div className="space-y-5">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Upload PDF, PNG or JPEG files up to 10 MB each. Documents remain
                private to your application and authorized staff.
              </p>
              {[
                ...requirements,
                ...previousCategories,
                ...(!requirements.some((r) => r.code === "OTHER")
                  ? [
                      {
                        code: "OTHER",
                        title: "Additional Supporting Documents",
                        mandatory: false,
                      },
                    ]
                  : []),
              ].map((requirement) => {
                const files = documents.filter(
                  (d) => d.document_type === requirement.code,
                );
                const uploads = jobs.filter(
                  (j) => j.category === requirement.code,
                );
                return (
                  <section
                    key={requirement.code}
                    className={`rounded-lg border p-4 space-y-3 ${errors[`documents.${requirement.code}`] ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <h4 className="font-semibold">{requirement.title}</h4>
                      <span className="text-xs text-slate-500">
                        {requirement.mandatory ? "Required" : "Optional"} ·{" "}
                        {uploads.some((j) => j.status === "Uploading")
                          ? "Uploading"
                          : files.some((f) =>
                                ["PENDING", "VERIFIED"].includes(
                                  f.verification_status,
                                ),
                              )
                            ? "Uploaded"
                            : uploads.length
                              ? "Failed"
                              : "Not Uploaded"}
                      </span>
                    </div>
                    <label
                      data-field={`documents.${requirement.code}`}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.currentTarget.querySelector("input")?.click();
                        }
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        void addFiles(e.dataTransfer.files, requirement.code);
                      }}
                      className="flex flex-col items-center justify-center gap-2 p-4 border border-dashed border-slate-400 dark:border-slate-600 rounded-md cursor-pointer hover:border-orange-500"
                    >
                      <Upload size={20} />
                      <span className="text-sm">
                        Choose files or drag and drop
                      </span>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.png,.jpg,.jpeg"
                        aria-label={`Upload ${requirement.title}`}
                        className="sr-only"
                        onChange={(e) => {
                          void addFiles(e.target.files, requirement.code);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {errors[`documents.${requirement.code}`] && (
                      <p role="alert" className="text-sm text-rose-500">
                        {errors[`documents.${requirement.code}`]}
                      </p>
                    )}
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className="flex flex-wrap items-center gap-3 text-sm border-t border-slate-200 dark:border-slate-700 pt-3"
                      >
                        <span className="min-w-0 flex-1 break-all">
                          {file.original_filename}{" "}
                          <span className="text-slate-500">
                            ({(file.file_size_bytes / 1024).toFixed(1)} KB) ·{" "}
                            {file.verification_status === "PENDING"
                              ? "Uploaded — awaiting verification"
                              : file.verification_status}
                          </span>
                        </span>
                        <label className="cursor-pointer text-orange-500 underline">
                          Replace
                          <input
                            type="file"
                            className="sr-only"
                            aria-label={`Replace ${file.original_filename}`}
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={(e) => {
                              void addFiles(
                                e.target.files,
                                requirement.code,
                                file.id,
                              );
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="text-rose-500 underline"
                          onClick={() => withdraw(file.id)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {uploads.map((job) => (
                      <div key={job.id} className="text-sm space-y-1">
                        <p className="break-all">
                          {job.file.name} · {job.status}{" "}
                          {job.status === "Uploading" ? `${job.progress}%` : ""}
                        </p>
                        {job.status === "Uploading" ? (
                          <progress
                            aria-label={`Uploading ${job.file.name}`}
                            max={100}
                            value={job.progress}
                            className="w-full accent-orange-500"
                          />
                        ) : (
                          <div className="text-rose-500">
                            <p role="alert">{job.error}</p>
                            <button
                              type="button"
                              disabled={uploading || resumeLoadError}
                              className="underline mr-3"
                              onClick={() => {
                                const invalid = validateFile(job.file);
                                if (!invalid) void runUpload(job);
                              }}
                            >
                              Retry upload
                            </button>
                            <button
                              type="button"
                              className="underline"
                              onClick={() =>
                                setJobs((previous) =>
                                  previous.filter((j) => j.id !== job.id),
                                )
                              }
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </section>
                );
              })}
              <label className="flex items-start gap-3 text-sm">
                <input
                  data-field="consent"
                  type="checkbox"
                  checked={consent}
                  required
                  aria-invalid={!!errors.consent}
                  aria-describedby={
                    errors.consent ? "consent-error" : undefined
                  }
                  onChange={(e) => {
                    setConsent(e.target.checked);
                    setErrors((previous) => {
                      const next = { ...previous };
                      delete next.consent;
                      return next;
                    });
                  }}
                  className="mt-1 accent-orange-500"
                />
                <span>
                  I confirm that the information and documents provided are
                  accurate and authorize CredVidhi to review this application.
                </span>
              </label>
              {errors.consent && (
                <p
                  id="consent-error"
                  role="alert"
                  className="text-sm text-rose-500"
                >
                  {errors.consent}
                </p>
              )}
            </div>
          )}
        </fieldset>
      </div>
    </Modal>
  );
}
