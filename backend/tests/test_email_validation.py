"""Tests for fake/disposable email rejection on registration."""

import pytest

from app.core.email_validation import validate_email_not_disposable


class TestDisposableEmailBlocking:
    """Layer 1: Disposable domain blocklist (pure local, no network)."""

    def test_rejects_mailinator(self):
        with pytest.raises(ValueError, match="disposable"):
            validate_email_not_disposable("test@mailinator.com")

    def test_rejects_guerrillamail(self):
        with pytest.raises(ValueError, match="disposable"):
            validate_email_not_disposable("test@guerrillamail.com")

    def test_rejects_10minutemail(self):
        with pytest.raises(ValueError, match="disposable"):
            validate_email_not_disposable("test@10minutemail.com")

    def test_rejects_tempmail(self):
        with pytest.raises(ValueError, match="disposable"):
            validate_email_not_disposable("test@temp-mail.org")

    def test_rejects_yopmail(self):
        with pytest.raises(ValueError, match="disposable"):
            validate_email_not_disposable("test@yopmail.com")

    def test_rejects_throwaway(self):
        """throwaway.email is caught by DNS MX layer if not in disposable list."""
        with pytest.raises(ValueError):
            validate_email_not_disposable("test@throwaway.email")


class TestDNSDeliverability:
    """Layer 2: DNS MX record validation."""

    def test_rejects_nonexistent_domain(self):
        from unittest.mock import patch
        from email_validator import EmailNotValidError

        with patch("app.core.email_validation.validate_email", side_effect=EmailNotValidError("Domain not found")):
            with pytest.raises(ValueError, match="does not appear to accept mail"):
                validate_email_not_disposable("test@thisisnotarealdomainxyz999888777.com")


class TestLegitimateEmailsAccepted:
    """Ensure real email providers are never blocked."""

    def test_accepts_gmail(self):
        from unittest.mock import MagicMock, patch

        with patch("app.core.email_validation.validate_email") as mock_val:
            mock_val.return_value = MagicMock(normalized="test@gmail.com")
            result = validate_email_not_disposable("test@gmail.com")
            assert "gmail.com" in result

    def test_accepts_outlook(self):
        from unittest.mock import MagicMock, patch

        with patch("app.core.email_validation.validate_email") as mock_val:
            mock_val.return_value = MagicMock(normalized="test@outlook.com")
            result = validate_email_not_disposable("test@outlook.com")
            assert "outlook.com" in result

    def test_accepts_yahoo(self):
        from unittest.mock import MagicMock, patch

        with patch("app.core.email_validation.validate_email") as mock_val:
            mock_val.return_value = MagicMock(normalized="test@yahoo.com")
            result = validate_email_not_disposable("test@yahoo.com")
            assert "yahoo.com" in result

    def test_normalizes_email(self):
        """email-validator normalizes casing and whitespace."""
        from unittest.mock import MagicMock, patch

        with patch("app.core.email_validation.validate_email") as mock_val:
            mock_val.return_value = MagicMock(normalized="Test@gmail.com")
            result = validate_email_not_disposable("Test@Gmail.COM")
            assert result == "Test@gmail.com"
