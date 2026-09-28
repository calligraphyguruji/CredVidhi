"""LLM Provider Service Module for CredVidhi.

Supports OpenAI-compatible free-tier providers (Groq, OpenRouter, Gemini, Mistral, NVIDIA NIM, etc.)
with dynamic switching via environment variables.
"""

from typing import Any, Dict, List, Optional

import httpx

from app.config import get_settings
from app.core.logging import logger

PROVIDER_BASE_URLS: Dict[str, str] = {
    "groq": "https://api.groq.com/openai/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
    "mistral": "https://api.mistral.ai/v1",
    "nvidia": "https://integrate.api.nvidia.com/v1",
    "cohere": "https://api.cohere.ai/compatibility/v1",
    "kilo": "https://api.kilo.ai/api/gateway",
    "ovh": "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1",
}


class LLMService:
    """Lightweight, async OpenAI-compatible LLM service abstraction."""

    def __init__(
        self,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> None:
        settings = get_settings()
        self.provider = (provider or settings.LLM_PROVIDER).lower()
        self.model = model or settings.LLM_MODEL
        self.api_key = api_key if api_key is not None else settings.LLM_API_KEY
        self.timeout = timeout if timeout is not None else settings.LLM_TIMEOUT_SECONDS

        # Resolve Base URL: custom URL takes precedence, then provider mapping, fallback to Groq
        if base_url:
            self.base_url = base_url.rstrip("/")
        elif settings.LLM_BASE_URL:
            self.base_url = settings.LLM_BASE_URL.rstrip("/")
        else:
            self.base_url = PROVIDER_BASE_URLS.get(
                self.provider, PROVIDER_BASE_URLS["groq"]
            ).rstrip("/")

    @property
    def is_configured(self) -> bool:
        """Check if provider API key or anonymous access is configured."""
        if self.provider in ("ovh", "kilo") and not self.api_key:
            return True
        return bool(self.api_key)

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        *,
        temperature: float = 0.2,
        max_tokens: Optional[int] = None,
        response_format: Optional[Dict[str, Any]] = None,
        extra_headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Execute chat completion request against active provider endpoint."""
        if not self.is_configured:
            raise ValueError(
                f"LLM provider '{self.provider}' is not configured. "
                f"Please set LLM_API_KEY in backend/.env"
            )

        url = f"{self.base_url}/chat/completions"
        headers: Dict[str, str] = {
            "Content-Type": "application/json",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        # OpenRouter optional identification headers
        if self.provider == "openrouter":
            headers["HTTP-Referer"] = "https://credvidhi.in"
            headers["X-Title"] = "CredVidhi Underwriting"

        if extra_headers:
            headers.update(extra_headers)

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        if response_format is not None:
            payload["response_format"] = response_format

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                data: Dict[str, Any] = response.json()
                return data
            except httpx.HTTPStatusError as exc:
                err_text = exc.response.text[:500] if exc.response.text else "No response body"
                logger.error(
                    f"LLM API HTTP error [{exc.response.status_code}] from {self.provider} ({self.model}): {err_text}"
                )
                raise
            except Exception as exc:
                logger.error(f"LLM request error for {self.provider} ({self.model}): {str(exc)}")
                raise

    async def generate_text(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: Optional[int] = None,
    ) -> str:
        """Helper to get a direct string answer from the LLM."""
        messages: List[Dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        data = await self.chat_completion(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        try:
            content = data["choices"][0]["message"].get("content")
            if content is None:
                return ""
            return str(content)
        except (KeyError, IndexError) as err:
            raise ValueError(f"Malformed LLM response structure: {data}") from err


_llm_service: Optional[LLMService] = None


def get_llm_service() -> LLMService:
    """Return singleton LLMService instance configured from settings."""
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
