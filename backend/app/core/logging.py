"""Structured Logging and Automated PII Masking Filter.

Safeguards borrower sensitive financial data (PAN, Aadhaar, JWT, Passwords)
from leaking into logs or terminal outputs.
"""

import logging
import re
import sys

# Regular expressions for common Indian financial PII
PAN_REGEX = re.compile(r"\b([A-Z]{5})(\d{4}[A-Z])\b", re.IGNORECASE)
AADHAAR_REGEX = re.compile(r"\b(\d{4}[\s-]?\d{4})[\s-]?(\d{4})\b")
BEARER_REGEX = re.compile(r"Bearer\s+([A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_.+/=]*)")
PASSWORD_REGEX = re.compile(
    r'(?i)(["\']?(?:password|token|secret|access_token|refresh_token)["\']?\s*[:=]\s*)(?:["\']([^"\']+)["\']|([^\s,;}{]+))'
)


class PIIMaskingFormatter(logging.Formatter):
    """Custom logging formatter that automatically masks PII in log records."""

    def format(self, record: logging.LogRecord) -> str:
        original = super().format(record)
        return self.mask_sensitive_data(original)

    @classmethod
    def mask_sensitive_data(cls, text: str) -> str:
        """Replace sensitive PII patterns with redacted representations."""
        # Mask PAN: ABCDE1234F -> ******1234F or ***-**-1234F (keep last 4 digits)
        masked = PAN_REGEX.sub(r"******\2", text)
        # Mask Aadhaar: 1234 5678 9012 -> ********9012
        masked = AADHAAR_REGEX.sub(r"********\2", masked)
        # Mask Bearer token
        masked = BEARER_REGEX.sub(r"Bearer [REDACTED_TOKEN]", masked)
        # Mask password or secrets in key-value pairs (quoted and unquoted)
        masked = PASSWORD_REGEX.sub(r"\1[REDACTED]", masked)
        return masked


def configure_logging(level: str = "INFO") -> logging.Logger:
    """Initialize root structured logger with PII masking."""
    logger = logging.getLogger("credvidhi")
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove existing handlers to avoid duplicates
    if logger.hasHandlers():
        logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    formatter = PIIMaskingFormatter(
        fmt="%(asctime)s | %(levelname)-7s | [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.propagate = False

    return logger


# Default logger instance
logger = configure_logging()
