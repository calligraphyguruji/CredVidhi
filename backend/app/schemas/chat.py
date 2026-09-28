"""Pydantic schemas for AI Chat & Customer Support."""

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class ChatMessageSchema(BaseModel):
    """Single chat turn schema."""

    role: Literal["user", "assistant", "system"] = Field(
        ..., description="Message author role: user, assistant, or system"
    )
    content: str = Field(..., description="Text content of the message")


class ChatRequestSchema(BaseModel):
    """Incoming user query schema."""

    message: str = Field(..., min_length=1, max_length=4000, description="User question or prompt")
    history: Optional[List[ChatMessageSchema]] = Field(
        default=None, description="Previous conversation turns"
    )
    context: Optional[Dict[str, Any]] = Field(
        default=None, description="Client context such as page or loan reference"
    )


class ChatResponseSchema(BaseModel):
    """Outgoing chat response schema."""

    reply: str = Field(..., description="Assistant response text")
    suggested_questions: List[str] = Field(
        default_factory=list, description="Follow-up prompt suggestions"
    )
    provider: str = Field(..., description="LLM provider or engine that generated the reply")
    model: str = Field(..., description="Model name or fallback indicator")
