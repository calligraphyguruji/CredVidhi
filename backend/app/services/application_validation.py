"""Submission contract shared by every route into SUBMITTED."""

from datetime import date
from decimal import Decimal
from typing import Any, Literal

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import LoanApplication
from app.models.document import ApplicationDocument, DocumentType, DocumentVerificationStatus
from app.models.loan_product import LoanProduct

WITHDRAWN_REMARK = "WITHDRAWN_BY_APPLICANT"


class ApplicationValidationError(ValueError):
    def __init__(self, fields: dict[str, str]) -> None:
        super().__init__("Please complete the required application information.")
        self.fields = fields


class PersonalSnapshot(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True, allow_inf_nan=False)
    fullName: str = Field(
        min_length=1, max_length=200, validation_alias=AliasChoices("fullName", "full_name")
    )
    email: EmailStr
    phone: str = Field(max_length=20, validation_alias=AliasChoices("phone", "phone_number"))
    dateOfBirth: date = Field(validation_alias=AliasChoices("dateOfBirth", "date_of_birth"))
    residentialAddress: str = Field(
        min_length=1,
        max_length=1000,
        validation_alias=AliasChoices("residentialAddress", "residential_address"),
    )
    taxId: str | None = None

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, value: str) -> str:
        digits = "".join(c for c in value if c.isdigit())
        if not 8 <= len(digits) <= 15 or any(c not in "+()- .0123456789" for c in value):
            raise ValueError("Enter a valid phone number with 8–15 digits.")
        return value

    @field_validator("dateOfBirth")
    @classmethod
    def past_birth_date(cls, value: date) -> date:
        if value >= date.today():
            raise ValueError("Date of birth must be in the past.")
        return value


class FinancialSnapshot(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True, allow_inf_nan=False)
    employmentType: Literal["SALARIED", "SELF_EMPLOYED"] = Field(
        validation_alias=AliasChoices("employmentType", "employment_type")
    )
    employerName: str = Field(
        min_length=1, max_length=255, validation_alias=AliasChoices("employerName", "employer_name")
    )
    jobTitle: str = Field(
        default="", max_length=255, validation_alias=AliasChoices("jobTitle", "job_title")
    )
    yearsEmployed: Decimal = Field(
        ge=0, validation_alias=AliasChoices("yearsEmployed", "years_employed", "experience_years")
    )
    grossMonthlyIncome: Decimal = Field(
        gt=0, validation_alias=AliasChoices("grossMonthlyIncome", "gross_monthly_income")
    )
    existingMonthlyDebt: Decimal = Field(
        ge=0,
        validation_alias=AliasChoices(
            "existingMonthlyDebt",
            "existing_monthly_debt",
            "existing_monthly_debts",
            "existing_debts",
        ),
    )
    housingExpense: Decimal = Field(
        ge=0, validation_alias=AliasChoices("housingExpense", "housing_expense", "housing_expenses")
    )
    creditScoreDeclared: int | None = Field(
        default=None,
        ge=300,
        le=900,
        validation_alias=AliasChoices(
            "creditScoreDeclared", "credit_score_declared", "bureau_score", "declared_cibil_score"
        ),
    )

    @model_validator(mode="after")
    def employment_fields(self) -> "FinancialSnapshot":
        if self.employmentType == "SALARIED" and not self.jobTitle:
            raise ValueError("Job title is required for salaried applicants.")
        return self


def document_requirements(product: LoanProduct) -> list[dict[str, Any]]:
    """Support existing string checklists and object entries with optional documents."""
    aliases = {
        "GOV_ID": "PAN_CARD",
        "W2_INCOME": "SALARY_SLIP",
        "PAYSLIP": "SALARY_SLIP",
        "BANK_STMT": "BANK_STATEMENT",
    }
    result: dict[str, dict[str, Any]] = {}
    for entry in product.required_documents:
        raw = {"code": entry} if isinstance(entry, str) else entry
        code = str(raw.get("code", "")).upper()
        code = aliases.get(code, code)
        if code not in DocumentType.__members__:
            raise ApplicationValidationError(
                {
                    "documents": "The product has an unsupported document requirement. Please contact support."
                }
            )
        mandatory = raw.get("mandatory", True) is not False
        if code in result:
            mandatory = mandatory or result[code]["mandatory"]
        result[code] = {
            "code": code,
            "title": raw.get("title") or code.replace("_", " ").title(),
            "mandatory": mandatory,
        }
    return list(result.values())


def is_withdrawn(document: ApplicationDocument) -> bool:
    return (
        document.verification_status == DocumentVerificationStatus.REJECTED
        and document.verification_remarks == WITHDRAWN_REMARK
    )


def snapshot_errors(model: type[BaseModel], value: Any, prefix: str) -> dict[str, str]:
    try:
        model.model_validate(value or {})
        return {}
    except ValidationError as exc:
        return {
            f"{prefix}.{'.'.join(map(str, error['loc']))}".rstrip("."): error["msg"].removeprefix(
                "Value error, "
            )
            for error in exc.errors()
        }


async def validate_submission(session: AsyncSession, application: LoanApplication) -> None:
    product = await session.get(LoanProduct, application.product_id)
    errors: dict[str, str] = {}
    if not product or not product.is_active:
        errors["productId"] = "Select an active loan product."
    else:
        if not product.min_amount <= application.requested_amount <= product.max_amount:
            errors["requestedAmount"] = "Requested amount is outside the selected product limits."
        if (
            not product.min_tenor_months
            <= application.requested_tenor_months
            <= product.max_tenor_months
        ):
            errors["requestedTenorMonths"] = "Tenure is outside the selected product limits."
        required = {r["code"] for r in document_requirements(product) if r["mandatory"]}
        documents = (
            (
                await session.execute(
                    select(ApplicationDocument).where(
                        ApplicationDocument.application_id == application.id
                    )
                )
            )
            .scalars()
            .all()
        )
        uploaded = {
            d.document_type.value
            for d in documents
            if not is_withdrawn(d)
            and d.verification_status
            in (DocumentVerificationStatus.PENDING, DocumentVerificationStatus.VERIFIED)
        }
        for code in sorted(required - uploaded):
            errors[f"documents.{code}"] = f"Upload {code.replace('_', ' ').title()}."
    if not application.purpose or not application.purpose.strip():
        errors["purpose"] = "Please enter your loan purpose."
    if (application.applicant_personal_snapshot or {}).get("declarationConsent") is not True:
        errors["consent"] = "Confirm the application declaration before submitting."
    errors.update(
        snapshot_errors(PersonalSnapshot, application.applicant_personal_snapshot, "personal")
    )
    errors.update(
        snapshot_errors(FinancialSnapshot, application.applicant_financial_snapshot, "financial")
    )
    if errors:
        raise ApplicationValidationError(errors)
