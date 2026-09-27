"""PII Masking and Sanitization Utilities.

Guarantees regulatory privacy compliance (e.g. RBI/DPDP guidelines)
by masking sensitive identity and financial identifiers before they
reach client responses, error messages, or logs.
"""

import re
from typing import Any, Dict, List, Optional, Union


def mask_pan(pan: Optional[str]) -> Optional[str]:
    """Mask Permanent Account Number (PAN).

    Standard PAN format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).
    Masks all but the 4 digits: '***-**-1234'.
    """
    if not pan:
        return None
    cleaned = pan.strip().upper()
    if len(cleaned) == 10 and cleaned[:5].isalpha() and cleaned[5:9].isdigit():
        return f"***-**-{cleaned[5:9]}"
    if len(cleaned) < 4:
        return "***"
    return f"***-**-{cleaned[-4:]}"


def mask_aadhaar(aadhaar: Optional[str]) -> Optional[str]:
    """Mask 12-digit Aadhaar national identifier.

    Standard Aadhaar format: 12 digits (e.g. 123456789012 or 1234 5678 9012).
    Masks first 8 digits: 'XXXX-XXXX-9012'.
    """
    if not aadhaar:
        return None
    digits = re.sub(r"\D", "", aadhaar)
    if len(digits) < 4:
        return "XXXX-XXXX-XXXX"
    return f"XXXX-XXXX-{digits[-4:]}"


def mask_phone(phone: Optional[str]) -> Optional[str]:
    """Mask telephone number, preserving only country prefix hint and last 4 digits."""
    if not phone:
        return None
    cleaned = phone.strip()
    if len(cleaned) <= 4:
        return "****"
    return f"{'*' * (len(cleaned) - 4)}{cleaned[-4:]}"


def mask_email(email: Optional[str]) -> Optional[str]:
    """Mask email address, preserving initial character and domain."""
    if not email or "@" not in email:
        return None
    parts = email.strip().split("@")
    user, domain = parts[0], parts[1]
    if len(user) <= 2:
        masked_user = f"{user[0]}*" if user else "*"
    else:
        masked_user = f"{user[0]}{'*' * (len(user) - 2)}{user[-1]}"
    return f"{masked_user}@{domain}"


def sanitize_pii_dict(data: Union[Dict[str, Any], List[Any], Any]) -> Any:
    """Recursively traverse a dictionary or list and mask known PII keys."""
    if isinstance(data, dict):
        sanitized: Dict[str, Any] = {}
        for key, value in data.items():
            k_lower = key.lower()
            if any(p in k_lower for p in ["pan", "tax_id", "taxid"]):
                sanitized[key] = mask_pan(str(value)) if value is not None else None
            elif any(p in k_lower for p in ["aadhaar", "ssn", "national_id"]):
                sanitized[key] = mask_aadhaar(str(value)) if value is not None else None
            elif any(p in k_lower for p in ["password", "secret", "token", "auth"]):
                sanitized[key] = "[REDACTED]"
            elif isinstance(value, (dict, list)):
                sanitized[key] = sanitize_pii_dict(value)
            else:
                sanitized[key] = value
        return sanitized
    elif isinstance(data, list):
        return [sanitize_pii_dict(item) for item in data]
    return data
