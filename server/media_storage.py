"""Optional multi-provider S3-compatible media storage.

Configure MEDIA_STORAGE_PROVIDERS as a JSON array of objects:
[{"id":"r2","endpoint_url":"https://...","bucket":"...","access_key":"...","secret_key":"...","region":"auto"}]

Uploads are distributed deterministically across configured providers and fall back
to the remaining providers if one rejects an upload. No credentials are stored in
the repository. With no providers configured, the existing local upload behavior
is preserved.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from functools import lru_cache
from typing import Any

PROVIDER_ID_RE = re.compile(r"^[a-z0-9_-]{1,24}$")


def configured_providers() -> list[dict[str, str]]:
    raw = os.environ.get("MEDIA_STORAGE_PROVIDERS", "").strip()
    if not raw:
        return []
    try:
        values = json.loads(raw)
    except (TypeError, ValueError) as exc:
        raise RuntimeError("MEDIA_STORAGE_PROVIDERS must be valid JSON") from exc
    if not isinstance(values, list):
        raise RuntimeError("MEDIA_STORAGE_PROVIDERS must be a JSON array")

    providers: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in values:
        if not isinstance(item, dict):
            continue
        provider_id = str(item.get("id", "")).strip().lower()
        required = ("endpoint_url", "bucket", "access_key", "secret_key")
        if not PROVIDER_ID_RE.fullmatch(provider_id) or provider_id in seen:
            continue
        if any(not str(item.get(key, "")).strip() for key in required):
            continue
        providers.append({
            "id": provider_id,
            "endpoint_url": str(item["endpoint_url"]).strip(),
            "bucket": str(item["bucket"]).strip(),
            "access_key": str(item["access_key"]).strip(),
            "secret_key": str(item["secret_key"]).strip(),
            "region": str(item.get("region") or "us-east-1").strip(),
            "addressing_style": str(
                item.get("addressing_style") or ("path" if provider_id == "blomp" else "auto")
            ).strip().lower(),
        })
        seen.add(provider_id)
    return providers


@lru_cache(maxsize=32)
def _client(provider_id: str):
    import boto3
    from botocore.config import Config

    provider = next((p for p in configured_providers() if p["id"] == provider_id), None)
    if provider is None:
        raise RuntimeError(f"Storage provider '{provider_id}' is not configured")
    return boto3.client(
        "s3",
        endpoint_url=provider["endpoint_url"],
        aws_access_key_id=provider["access_key"],
        aws_secret_access_key=provider["secret_key"],
        region_name=provider["region"],
        config=Config(
            signature_version="s3v4",
            retries={"max_attempts": 2},
            s3={"addressing_style": provider["addressing_style"]},
        ),
    )


def _provider_order(object_key: str, providers: list[dict[str, str]]) -> list[dict[str, str]]:
    if not providers:
        return []
    digest = hashlib.sha256(object_key.encode("utf-8")).digest()
    start = int.from_bytes(digest[:4], "big") % len(providers)
    return providers[start:] + providers[:start]


def upload_media_file(local_path: str, kind: str, filename: str) -> str | None:
    """Upload to configured providers; return an internal URL or None for local storage."""
    providers = configured_providers()
    if not providers:
        return None
    object_key = f"{kind}/{filename}"
    errors: list[str] = []
    for provider in _provider_order(object_key, providers):
        try:
            _client(provider["id"]).upload_file(
                local_path,
                provider["bucket"],
                object_key,
                ExtraArgs={"ContentType": _content_type(filename)},
            )
            return f"/uploads/{kind}/{provider['id']}__{filename}"
        except Exception as exc:  # try the next free provider rather than failing immediately
            errors.append(f"{provider['id']}: {type(exc).__name__}")
    raise RuntimeError("All configured media storage providers rejected the upload (" + ", ".join(errors) + ")")


def _content_type(filename: str) -> str:
    extension = filename.rsplit(".", 1)[-1].lower()
    return {
        "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
        "webp": "image/webp", "gif": "image/gif", "mp4": "video/mp4",
        "mov": "video/quicktime", "webm": "video/webm", "mp3": "audio/mpeg",
        "m4a": "audio/mp4", "pdf": "application/pdf",
    }.get(extension, "application/octet-stream")


def _remote_parts(filename: str) -> tuple[str, str] | None:
    if "__" not in filename:
        return None
    provider_id, object_filename = filename.split("__", 1)
    if not PROVIDER_ID_RE.fullmatch(provider_id) or not object_filename or "/" in object_filename or "\\" in object_filename:
        return None
    return provider_id, object_filename


def is_remote_media_filename(filename: str) -> bool:
    return _remote_parts(filename) is not None


def presigned_media_url(kind: str, filename: str, expires_in: int = 3600) -> str | None:
    parts = _remote_parts(filename)
    if not parts:
        return None
    provider_id, object_filename = parts
    provider = next((p for p in configured_providers() if p["id"] == provider_id), None)
    if provider is None:
        raise RuntimeError(f"Storage provider '{provider_id}' is not configured")
    return _client(provider_id).generate_presigned_url(
        "get_object",
        Params={"Bucket": provider["bucket"], "Key": f"{kind}/{object_filename}"},
        ExpiresIn=expires_in,
    )


def delete_remote_media(kind: str, filename: str) -> bool:
    parts = _remote_parts(filename)
    if not parts:
        return False
    provider_id, object_filename = parts
    provider = next((p for p in configured_providers() if p["id"] == provider_id), None)
    if provider is None:
        return False
    _client(provider_id).delete_object(
        Bucket=provider["bucket"],
        Key=f"{kind}/{object_filename}",
    )
    return True
