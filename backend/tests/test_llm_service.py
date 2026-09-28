"""Unit tests for OpenAI-compatible LLMService provider abstraction."""

import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.services.llm_service import LLMService, get_llm_service


def test_provider_url_resolution() -> None:
    """Verify default base URL resolution per provider."""
    service_groq = LLMService(provider="groq", api_key="dummy-key")
    assert service_groq.base_url == "https://api.groq.com/openai/v1"

    service_openrouter = LLMService(provider="openrouter", api_key="dummy-key")
    assert service_openrouter.base_url == "https://openrouter.ai/api/v1"

    service_gemini = LLMService(provider="gemini", api_key="dummy-key")
    assert service_gemini.base_url == "https://generativelanguage.googleapis.com/v1beta/openai"

    service_nvidia = LLMService(provider="nvidia", api_key="dummy-key")
    assert service_nvidia.base_url == "https://integrate.api.nvidia.com/v1"

    service_cohere = LLMService(provider="cohere", api_key="dummy-key")
    assert service_cohere.base_url == "https://api.cohere.ai/compatibility/v1"

    # Custom base URL override
    service_custom = LLMService(
        provider="custom",
        base_url="https://my-custom-proxy.internal/v1/",
        api_key="dummy-key",
    )
    assert service_custom.base_url == "https://my-custom-proxy.internal/v1"


def test_is_configured_logic() -> None:
    """Verify is_configured behavior for key-requiring and anonymous providers."""
    # Key-requiring provider without key
    unconfigured = LLMService(provider="groq", api_key="")
    assert unconfigured.is_configured is False

    # Key-requiring provider with key
    configured = LLMService(provider="groq", api_key="test-key")
    assert configured.is_configured is True

    # Anonymous providers (OVH, Kilo) should report configured even without key
    ovh_anonymous = LLMService(provider="ovh", api_key="")
    assert ovh_anonymous.is_configured is True


@pytest.mark.asyncio
async def test_chat_completion_success() -> None:
    """Test successful chat completion via mocked httpx.AsyncClient."""
    service = LLMService(provider="groq", model="openai/gpt-oss-120b", api_key="test-key")

    mock_response_data = {
        "id": "chatcmpl-test",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "Eligible for Prime Loan",
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {"total_tokens": 42},
    }

    mock_resp = httpx.Response(
        status_code=200,
        content=json.dumps(mock_response_data).encode("utf-8"),
        request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        result = await service.chat_completion(
            messages=[{"role": "user", "content": "Assess eligibility"}],
            temperature=0.1,
        )

        assert result["id"] == "chatcmpl-test"
        assert result["choices"][0]["message"]["content"] == "Eligible for Prime Loan"
        mock_post.assert_called_once()


@pytest.mark.asyncio
async def test_generate_text_helper() -> None:
    """Test generate_text helper extraction."""
    service = LLMService(provider="groq", model="openai/gpt-oss-120b", api_key="test-key")

    mock_response_data = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "Low Risk Tier Recommended",
                }
            }
        ]
    }

    mock_resp = httpx.Response(
        status_code=200,
        content=json.dumps(mock_response_data).encode("utf-8"),
        request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        answer = await service.generate_text(
            prompt="Analyze borrower DTI",
            system_prompt="You are a senior credit underwriting analyst.",
        )

        assert answer == "Low Risk Tier Recommended"


@pytest.mark.asyncio
async def test_chat_completion_http_error() -> None:
    """Test that HTTP errors from provider raise exceptions."""
    service = LLMService(provider="groq", model="openai/gpt-oss-120b", api_key="test-key")

    mock_resp = httpx.Response(
        status_code=429,
        content=b'{"error": {"message": "Rate limit exceeded"}}',
        request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        with pytest.raises(httpx.HTTPStatusError):
            await service.chat_completion(messages=[{"role": "user", "content": "Hello"}])


def test_singleton_accessor() -> None:
    """Verify get_llm_service singleton pattern."""
    s1 = get_llm_service()
    s2 = get_llm_service()
    assert s1 is s2


@pytest.mark.asyncio
async def test_unconfigured_provider_raises() -> None:
    """Test that calling chat_completion without an API key raises ValueError."""
    unconfigured = LLMService(provider="groq", api_key="")
    with pytest.raises(ValueError, match="is not configured"):
        await unconfigured.chat_completion(messages=[{"role": "user", "content": "Hi"}])


@pytest.mark.asyncio
async def test_generate_text_none_content() -> None:
    """Test that None message content evaluates to empty string rather than 'None'."""
    service = LLMService(provider="groq", api_key="test-key")
    mock_response_data = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": None,
                }
            }
        ]
    }
    mock_resp = httpx.Response(
        status_code=200,
        content=json.dumps(mock_response_data).encode("utf-8"),
        request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"),
    )
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        result = await service.generate_text(prompt="test")
        assert result == ""
