"""Unit and integration tests for AI Chatbot customer support endpoint."""

import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.llm_service import LLMService


@pytest.mark.asyncio
async def test_chat_endpoint_fallback_knowledge_base() -> None:
    """Verify that chatbot falls back gracefully to grounded CredVidhi answers when unconfigured."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Ask about interest rates
        resp = await client.post(
            "/api/v1/chat",
            json={"message": "What are your loan interest rates?"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        data = body["data"]
        assert "interest" in data["reply"].lower() or "apr" in data["reply"].lower()
        assert len(data["suggested_questions"]) > 0
        assert data["provider"] in ("credvidhi-knowledge-base", "gemini", "groq")

        # Ask about KYC documents
        resp_doc = await client.post(
            "/api/v1/chat",
            json={"message": "Which documents are required for application?"},
        )
        assert resp_doc.status_code == 200
        doc_data = resp_doc.json()["data"]
        assert "pan" in doc_data["reply"].lower()
        assert "aadhaar" in doc_data["reply"].lower()

        # Ask about EMI calculation
        resp_emi = await client.post(
            "/api/v1/chat",
            json={"message": "How do you calculate monthly EMI and DTI ratio?"},
        )
        assert resp_emi.status_code == 200
        emi_data = resp_emi.json()["data"]
        assert "emi" in emi_data["reply"].lower()


@pytest.mark.asyncio
async def test_chat_endpoint_with_mocked_gemini() -> None:
    """Verify that chat endpoint delegates to Gemini when configured."""
    mock_gemini_service = LLMService(
        provider="gemini",
        model="gemini-2.0-flash",
        api_key="mock-gemini-key",
    )

    mock_llm_response = {
        "id": "chatcmpl-gemini-test",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "Hello! I am your CredVidhi AI assistant powered by Google Gemini. Home Prime loans start at 8.5% p.a.",
                },
                "finish_reason": "stop",
            }
        ],
    }

    with patch("app.api.v1.chat.get_llm_service", return_value=mock_gemini_service):
        with patch.object(
            mock_gemini_service, "chat_completion", new_callable=AsyncMock
        ) as mock_chat:
            mock_chat.return_value = mock_llm_response

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post(
                    "/api/v1/chat",
                    json={
                        "message": "Can I get an education loan?",
                        "history": [
                            {"role": "user", "content": "Hi"},
                            {"role": "assistant", "content": "Welcome to CredVidhi!"},
                        ],
                    },
                )

                assert resp.status_code == 200
                body = resp.json()
                assert body["success"] is True
                data = body["data"]
                assert "powered by Google Gemini" in data["reply"]
                assert data["provider"] == "gemini"
                assert data["model"] == "gemini-2.0-flash"
                assert len(data["suggested_questions"]) > 0
                mock_chat.assert_called_once()

