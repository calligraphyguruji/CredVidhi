"""Email validation utilities — disposable domain blocking + DNS deliverability."""

import logging
import os

from disposable_email import is_disposable
from email_validator import EmailNotValidError, caching_resolver, validate_email

logger = logging.getLogger(__name__)

# RFC 2606 reserved domains & TLDs — always valid in test environments
_TEST_DOMAINS = frozenset({"example.com", "example.org", "example.net", "test.com"})
_TEST_TLDS = frozenset({".example", ".test", ".invalid", ".localhost"})

# Bounded caching resolver to prevent async event loop starvation
_resolver = caching_resolver(timeout=3.0)


def _is_test_environment() -> bool:
    return os.environ.get("ENVIRONMENT", "").lower() == "test"


def _is_test_domain(domain: str) -> bool:
    """Return True if the domain or its suffix is a reserved test domain."""
    return (
        domain in _TEST_DOMAINS
        or any(domain.endswith(f".{d}") for d in _TEST_DOMAINS)
        or any(domain.endswith(tld) for tld in _TEST_TLDS)
    )


def validate_email_not_disposable(email: str) -> str:
    """Validate email is not from a disposable domain and has valid MX records.

    Returns the normalized email on success.
    Raises ValueError with a user-facing message on failure.

    In test environments, DNS deliverability checks are skipped for
    RFC 2606 reserved domains (example.com, test.com, etc.).
    """
    domain = email.split("@")[-1].lower()

    # Skip disposable & DNS checks for reserved test domains in test environment
    if _is_test_environment() and _is_test_domain(domain):
        return email.lower()

    # Layer 1: Disposable domain blocklist (O(1) frozenset lookup, no network)
    if is_disposable(email):
        raise ValueError("Temporary or disposable email addresses are not accepted.")

    # Layer 2: DNS MX deliverability check with bounded caching resolver
    try:
        result = validate_email(email, check_deliverability=True, dns_resolver=_resolver)
        return result.normalized
    except EmailNotValidError as exc:
        logger.info("Email validation failed for domain: %s", domain)
        raise ValueError(
            "This email domain does not appear to accept mail. Please use a valid email address."
        ) from exc
