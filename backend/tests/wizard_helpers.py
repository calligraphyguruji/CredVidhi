"""Complete real draft inputs through the APIs for lifecycle test prerequisites."""

from httpx import AsyncClient

PERSONAL = {
    "fullName": "Test Borrower",
    "email": "borrower@example.com",
    "phone": "+919123456789",
    "dateOfBirth": "1990-01-01",
    "residentialAddress": "Test borrower address",
    "declarationConsent": True,
}
FINANCIAL = {
    "employmentType": "SALARIED",
    "employerName": "Test Employer",
    "jobTitle": "Engineer",
    "yearsEmployed": 5,
    "grossMonthlyIncome": 95000,
    "existingMonthlyDebt": 0,
    "housingExpense": 0,
    "creditScoreDeclared": None,
}


async def complete_draft(
    client: AsyncClient,
    app_id: str,
    headers: dict,
    categories: list[str],
    personal: dict | None = None,
    financial: dict | None = None,
) -> list[dict]:
    response = await client.put(
        f"/api/v1/applications/{app_id}/draft",
        headers=headers,
        json={
            "purpose": "Borrower supplied loan purpose",
            "applicant_personal_snapshot": {**PERSONAL, **(personal or {})},
            "applicant_financial_snapshot": {**FINANCIAL, **(financial or {})},
        },
    )
    assert response.status_code == 200, response.text
    result = []
    for category in categories:
        uploaded = await client.post(
            f"/api/v1/applications/{app_id}/documents/upload",
            headers=headers,
            data={"document_type": category},
            files={
                "file": (f"{category}.pdf", b"%PDF-1.4\n" + category.encode(), "application/pdf")
            },
        )
        assert uploaded.status_code in (200, 201), uploaded.text
        result.append(uploaded.json()["data"])
    return result
