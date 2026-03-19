from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path
from typing import Iterable

import httpx
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent

load_dotenv(BACKEND_DIR / ".env")


logger = logging.getLogger("voxora.backend")
if not logger.handlers:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".mpeg", ".mp4", ".webm"}
PLACEHOLDER_VALUES = {"api_key_here", "gapi_key_here", ""}
SUPPORTED_PROVIDERS = ("openai", "groq")

DEFAULT_OPENAI_TRANSCRIPTION_MODEL = os.getenv("OPENAI_TRANSCRIPTION_MODEL", "whisper-1")
DEFAULT_OPENAI_SUMMARY_MODEL = os.getenv("OPENAI_SUMMARY_MODEL", "gpt-4o-mini")
DEFAULT_GROQ_TRANSCRIPTION_MODEL = os.getenv("GROQ_TRANSCRIPTION_MODEL", "whisper-large-v3")
DEFAULT_GROQ_SUMMARY_MODEL = os.getenv("GROQ_SUMMARY_MODEL", "llama-3.1-8b-instant")
DEFAULT_PROVIDER = os.getenv("DEFAULT_AI_PROVIDER", "auto")
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "25"))
MAX_SUMMARY_CHUNK_CHARS = int(os.getenv("SUMMARY_CHUNK_CHARS", "12000"))
SUMMARY_CHUNK_OVERLAP = int(os.getenv("SUMMARY_CHUNK_OVERLAP", "500"))


class SummarizeTranscriptRequest(BaseModel):
    transcript: str = Field(min_length=1)
    provider: str = Field(default=DEFAULT_PROVIDER)
    summary_model: str | None = None


class ProcessAudioResponse(BaseModel):
    provider: str
    transcription_model: str
    summary_model: str
    filename: str
    transcript: str
    summary: str


def _is_configured(value: str | None) -> bool:
    return bool(value and value.strip() and value.strip() not in PLACEHOLDER_VALUES)


def _get_cors_origins() -> list[str]:
    raw = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3118,http://127.0.0.1:3118",
    ).strip()
    if raw == "*":
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _get_provider_api_key(provider: str) -> str | None:
    env_var = {
        "openai": "OPENAI_API_KEY",
        "groq": "GROQ_API_KEY",
    }.get(provider)
    if not env_var:
        return None

    value = os.getenv(env_var)
    return value if _is_configured(value) else None


def _provider_preference_order() -> list[str]:
    preferred = DEFAULT_PROVIDER.strip().lower()
    if preferred in SUPPORTED_PROVIDERS:
        return [preferred, *[candidate for candidate in SUPPORTED_PROVIDERS if candidate != preferred]]
    return list(SUPPORTED_PROVIDERS)


def _normalize_provider(provider: str) -> str:
    normalized = (provider or DEFAULT_PROVIDER).strip().lower()
    if normalized not in {"auto", *SUPPORTED_PROVIDERS}:
        raise HTTPException(status_code=400, detail="Unsupported provider. Use 'auto', 'openai', or 'groq'.")
    return normalized


def _resolve_provider(provider: str) -> str:
    normalized = _normalize_provider(provider)
    if normalized == "auto":
        for candidate in _provider_preference_order():
            if _get_provider_api_key(candidate):
                return candidate
        raise HTTPException(
            status_code=400,
            detail="No API key configured. Set OPENAI_API_KEY or GROQ_API_KEY on the backend.",
        )

    if not _get_provider_api_key(normalized):
        raise HTTPException(
            status_code=400,
            detail=f"{normalized.capitalize()} API key is not configured on the backend.",
        )

    return normalized


def _default_transcription_model(provider: str) -> str:
    if provider == "openai":
        return DEFAULT_OPENAI_TRANSCRIPTION_MODEL
    return DEFAULT_GROQ_TRANSCRIPTION_MODEL


def _default_summary_model(provider: str) -> str:
    if provider == "openai":
        return DEFAULT_OPENAI_SUMMARY_MODEL
    return DEFAULT_GROQ_SUMMARY_MODEL


def _resolve_provider_candidates(provider: str) -> list[str]:
    normalized = _normalize_provider(provider)
    if normalized != "auto":
        return [_resolve_provider(normalized)]

    candidates = [candidate for candidate in _provider_preference_order() if _get_provider_api_key(candidate)]
    if not candidates:
        raise HTTPException(
            status_code=400,
            detail="No API key configured. Set OPENAI_API_KEY or GROQ_API_KEY on the backend.",
        )
    return candidates


def _can_auto_fallback(provider: str, *model_overrides: str | None) -> bool:
    return _normalize_provider(provider) == "auto" and all(not override for override in model_overrides)


def _should_try_next_provider(exc: HTTPException) -> bool:
    return exc.status_code >= 500


def _chunk_text(text: str, size: int, overlap: int) -> list[str]:
    cleaned = text.strip()
    if not cleaned:
        return []
    if len(cleaned) <= size:
        return [cleaned]

    chunks: list[str] = []
    start = 0
    step = max(1, size - overlap)
    while start < len(cleaned):
        end = min(len(cleaned), start + size)
        chunks.append(cleaned[start:end])
        if end >= len(cleaned):
            break
        start += step
    return chunks


async def _save_upload_to_temp(upload: UploadFile) -> tuple[Path, int]:
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_AUDIO_EXTENSIONS))}",
        )

    total_size = 0
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    temp_path = Path(temp_file.name)

    try:
        with temp_file:
            while True:
                chunk = await upload.read(1024 * 1024)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > MAX_UPLOAD_MB * 1024 * 1024:
                    raise HTTPException(status_code=413, detail=f"File too large. Max upload size is {MAX_UPLOAD_MB} MB.")
                temp_file.write(chunk)
    except Exception:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)
        raise
    finally:
        await upload.close()

    return temp_path, total_size


async def _request_transcription(
    *,
    file_path: Path,
    filename: str,
    content_type: str | None,
    provider: str,
    model: str,
) -> str:
    api_key = _get_provider_api_key(provider)
    if not api_key:
        raise HTTPException(status_code=400, detail=f"{provider.capitalize()} API key is not configured on the backend.")

    if provider == "openai":
        url = "https://api.openai.com/v1/audio/transcriptions"
    else:
        url = "https://api.groq.com/openai/v1/audio/transcriptions"

    headers = {"Authorization": f"Bearer {api_key}"}

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            with file_path.open("rb") as audio_stream:
                files = {"file": (filename, audio_stream, content_type or "application/octet-stream")}
                data = {"model": model, "response_format": "verbose_json"}
                response = await client.post(url, headers=headers, files=files, data=data)
    except httpx.RequestError as exc:
        logger.exception("Transcription request failed")
        raise HTTPException(status_code=502, detail=f"Could not reach the {provider} transcription API.") from exc

    if response.status_code >= 400:
        logger.error("Transcription API error %s: %s", response.status_code, response.text)
        raise HTTPException(status_code=502, detail=f"{provider.capitalize()} transcription failed: {response.text}")

    payload = response.json()
    transcript = payload.get("text", "").strip()
    if not transcript:
        raise HTTPException(status_code=502, detail="Transcription returned an empty result.")
    return transcript


def _summary_system_prompt() -> str:
    return (
        "You are Voxora, an assistant that summarizes meeting transcripts. "
        "Return concise markdown with these sections in order: "
        "## Overview, ## Key Points, ## Action Items, ## Follow-ups. "
        "Do not invent facts. If a section has nothing meaningful, say 'None noted.'"
    )


async def _request_chat_completion(
    *,
    provider: str,
    model: str,
    messages: Iterable[dict[str, str]],
    max_tokens: int,
) -> str:
    api_key = _get_provider_api_key(provider)
    if not api_key:
        raise HTTPException(status_code=400, detail=f"{provider.capitalize()} API key is not configured on the backend.")

    if provider == "openai":
        url = "https://api.openai.com/v1/chat/completions"
    else:
        url = "https://api.groq.com/openai/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "temperature": 0.2,
        "messages": list(messages),
        "max_tokens": max_tokens,
    }

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(url, headers=headers, json=payload)
    except httpx.RequestError as exc:
        logger.exception("Summary request failed")
        raise HTTPException(status_code=502, detail=f"Could not reach the {provider} summary API.") from exc

    if response.status_code >= 400:
        logger.error("Summary API error %s: %s", response.status_code, response.text)
        raise HTTPException(status_code=502, detail=f"{provider.capitalize()} summary failed: {response.text}")

    payload = response.json()
    try:
        message = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        logger.error("Unexpected summary response: %s", payload)
        raise HTTPException(status_code=502, detail="Summary API returned an invalid response.") from exc

    content = message.strip() if isinstance(message, str) else ""
    if not content:
        raise HTTPException(status_code=502, detail="Summary API returned an empty result.")
    return content


async def _build_summary(transcript: str, provider: str, summary_model: str) -> str:
    chunks = _chunk_text(transcript, MAX_SUMMARY_CHUNK_CHARS, SUMMARY_CHUNK_OVERLAP)
    if not chunks:
        raise HTTPException(status_code=400, detail="Transcript is empty.")

    if len(chunks) == 1:
        return await _request_chat_completion(
            provider=provider,
            model=summary_model,
            max_tokens=700,
            messages=[
                {"role": "system", "content": _summary_system_prompt()},
                {"role": "user", "content": chunks[0]},
            ],
        )

    chunk_summaries: list[str] = []
    for index, chunk in enumerate(chunks, start=1):
        chunk_summary = await _request_chat_completion(
            provider=provider,
            model=summary_model,
            max_tokens=400,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are summarizing one section of a longer meeting transcript. "
                        "Return short markdown notes with headings: Overview, Key Points, Action Items, Follow-ups."
                    ),
                },
                {"role": "user", "content": f"Chunk {index} of {len(chunks)}:\n\n{chunk}"},
            ],
        )
        chunk_summaries.append(f"Chunk {index}\n{chunk_summary}")

    return await _request_chat_completion(
        provider=provider,
        model=summary_model,
        max_tokens=900,
        messages=[
            {"role": "system", "content": _summary_system_prompt()},
            {
                "role": "user",
                "content": "Combine these chunk summaries into one final meeting summary:\n\n" + "\n\n".join(chunk_summaries),
            },
        ],
    )


def create_app() -> FastAPI:
    app = FastAPI(
        title="Voxora Web API",
        version="1.0.0",
        description="Upload-first transcription and meeting summarization API for Voxora Web.",
    )

    cors_origins = _get_cors_origins()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_, exc: HTTPException) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.get("/")
    async def root() -> dict[str, str]:
        return {"service": "voxora-web-api", "status": "ok"}

    @app.get("/health")
    async def health() -> dict[str, object]:
        return {
            "status": "ok",
            "service": "voxora-web-api",
            "providers": {
                "openai": bool(_get_provider_api_key("openai")),
                "groq": bool(_get_provider_api_key("groq")),
            },
        }

    @app.post("/api/transcribe-audio")
    async def transcribe_audio(
        file: UploadFile = File(...),
        provider: str = Form(DEFAULT_PROVIDER),
        model: str | None = Form(None),
    ) -> dict[str, str]:
        temp_path, _ = await _save_upload_to_temp(file)
        provider_candidates = _resolve_provider_candidates(provider)
        allow_fallback = _can_auto_fallback(provider, model)

        try:
            last_error: HTTPException | None = None
            for index, resolved_provider in enumerate(provider_candidates):
                transcription_model = model or _default_transcription_model(resolved_provider)
                try:
                    transcript = await _request_transcription(
                        file_path=temp_path,
                        filename=file.filename or temp_path.name,
                        content_type=file.content_type,
                        provider=resolved_provider,
                        model=transcription_model,
                    )
                    return {
                        "provider": resolved_provider,
                        "model": transcription_model,
                        "text": transcript,
                    }
                except HTTPException as exc:
                    last_error = exc
                    should_retry = allow_fallback and index < len(provider_candidates) - 1 and _should_try_next_provider(exc)
                    if not should_retry:
                        raise
                    logger.warning("Auto provider fallback after %s transcription failure", resolved_provider)
            if last_error:
                raise last_error
            raise HTTPException(status_code=500, detail="Unable to process transcription request.")
        finally:
            temp_path.unlink(missing_ok=True)

    @app.post("/api/summarize-transcript")
    async def summarize_transcript(payload: SummarizeTranscriptRequest) -> dict[str, str]:
        provider_candidates = _resolve_provider_candidates(payload.provider)
        allow_fallback = _can_auto_fallback(payload.provider, payload.summary_model)
        last_error: HTTPException | None = None

        for index, resolved_provider in enumerate(provider_candidates):
            summary_model = payload.summary_model or _default_summary_model(resolved_provider)
            try:
                summary = await _build_summary(payload.transcript, resolved_provider, summary_model)
                return {
                    "provider": resolved_provider,
                    "summary_model": summary_model,
                    "summary": summary,
                }
            except HTTPException as exc:
                last_error = exc
                should_retry = allow_fallback and index < len(provider_candidates) - 1 and _should_try_next_provider(exc)
                if not should_retry:
                    raise
                logger.warning("Auto provider fallback after %s summary failure", resolved_provider)

        if last_error:
            raise last_error
        raise HTTPException(status_code=500, detail="Unable to process summary request.")

    @app.post("/api/process-audio", response_model=ProcessAudioResponse)
    async def process_audio(
        file: UploadFile = File(...),
        provider: str = Form(DEFAULT_PROVIDER),
        transcription_model: str | None = Form(None),
        summary_model: str | None = Form(None),
    ) -> ProcessAudioResponse:
        temp_path, file_size = await _save_upload_to_temp(file)
        provider_candidates = _resolve_provider_candidates(provider)
        allow_fallback = _can_auto_fallback(provider, transcription_model, summary_model)

        logger.info(
            "Processing upload filename=%s size_bytes=%s provider=%s",
            file.filename,
            file_size,
            provider,
        )

        try:
            last_error: HTTPException | None = None
            for index, resolved_provider in enumerate(provider_candidates):
                selected_transcription_model = transcription_model or _default_transcription_model(resolved_provider)
                selected_summary_model = summary_model or _default_summary_model(resolved_provider)
                try:
                    transcript = await _request_transcription(
                        file_path=temp_path,
                        filename=file.filename or temp_path.name,
                        content_type=file.content_type,
                        provider=resolved_provider,
                        model=selected_transcription_model,
                    )
                    summary = await _build_summary(transcript, resolved_provider, selected_summary_model)
                    return ProcessAudioResponse(
                        provider=resolved_provider,
                        transcription_model=selected_transcription_model,
                        summary_model=selected_summary_model,
                        filename=file.filename or temp_path.name,
                        transcript=transcript,
                        summary=summary,
                    )
                except HTTPException as exc:
                    last_error = exc
                    should_retry = allow_fallback and index < len(provider_candidates) - 1 and _should_try_next_provider(exc)
                    if not should_retry:
                        raise
                    logger.warning("Auto provider fallback after %s process-audio failure", resolved_provider)
            if last_error:
                raise last_error
            raise HTTPException(status_code=500, detail="Unable to process audio request.")
        finally:
            temp_path.unlink(missing_ok=True)

    return app


app = create_app()


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.getenv("PORT", "5167")), reload=True)
