from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Lock
import time
from urllib.parse import urlsplit

from . import __version__
from .config import Settings
from .images import ImageValidationError, assess_quality, validate_and_decode_image
from .model import ModelLoadError, OralDiseaseClassifier
from .report import build_report


SECURITY_HEADERS = {
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
}


@dataclass(frozen=True)
class ServiceResponse:
    status: int
    payload: dict[str, object] | None
    headers: dict[str, str]


class RateLimiter:
    def __init__(self, per_minute: int) -> None:
        self.per_minute = per_minute
        self._requests: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, client_key: str, now: float | None = None) -> int | None:
        current = time.monotonic() if now is None else now
        with self._lock:
            history = self._requests[client_key]
            while history and current - history[0] >= 60:
                history.popleft()
            if len(history) >= self.per_minute:
                return max(1, int(60 - (current - history[0])))
            history.append(current)
            return None


class AiService:
    def __init__(self, settings: Settings, classifier: OralDiseaseClassifier | None = None) -> None:
        self.settings = settings
        self.classifier = classifier or OralDiseaseClassifier(settings.model_path)
        self.rate_limiter = RateLimiter(settings.max_requests_per_minute)

    def _response(
        self,
        status: int,
        payload: dict[str, object] | None,
        origin: str | None = None,
        extras: dict[str, str] | None = None,
    ) -> ServiceResponse:
        headers = dict(SECURITY_HEADERS)
        if origin and origin in self.settings.allowed_origins:
            headers["Access-Control-Allow-Origin"] = origin
            headers["Vary"] = "Origin"
        if extras:
            headers.update(extras)
        return ServiceResponse(status, payload, headers)

    def handle(
        self,
        method: str,
        target: str,
        headers: dict[str, str],
        body: bytes,
        client_key: str,
    ) -> ServiceResponse:
        normalized_headers = {name.lower(): value for name, value in headers.items()}
        origin = normalized_headers.get("origin")
        if origin and origin not in self.settings.allowed_origins:
            return self._response(403, {"error": {"code": "origin_not_allowed", "message": "请求来源不受信任"}})

        path = urlsplit(target).path
        upper_method = method.upper()
        if upper_method == "OPTIONS":
            if not origin:
                return self._response(400, {"error": {"code": "origin_required", "message": "缺少网页来源"}})
            return self._response(
                204,
                None,
                origin,
                {
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Max-Age": "600",
                },
            )
        if upper_method == "GET" and path == "/health":
            return self._response(200, {"status": "ok", "version": __version__}, origin)
        if upper_method == "GET" and path == "/ready":
            try:
                self.classifier.load()
            except ModelLoadError:
                return self._response(
                    503,
                    {"status": "model_unavailable", "model": self.classifier.model_file_status()},
                    origin,
                )
            return self._response(200, {"status": "ready", "model": self.classifier.model_file_status()}, origin)
        if upper_method == "POST" and path == "/v1/analyze":
            retry_after = self.rate_limiter.check(client_key)
            if retry_after is not None:
                return self._response(
                    429,
                    {"error": {"code": "rate_limited", "message": "请求过于频繁，请稍后再试"}},
                    origin,
                    {"Retry-After": str(retry_after)},
                )
            try:
                image = validate_and_decode_image(body, normalized_headers.get("content-type", ""))
                quality = assess_quality(image)
                predictions = self.classifier.predict(image)
                report = build_report(predictions, quality, self.settings.min_confidence)
                return self._response(200, {"report": report}, origin)
            except ImageValidationError as exc:
                return self._response(
                    exc.status_code,
                    {"error": {"code": exc.code, "message": exc.message}},
                    origin,
                )
            except ModelLoadError:
                return self._response(
                    503,
                    {"error": {"code": "model_unavailable", "message": "AI 模型暂时不可用"}},
                    origin,
                )
        return self._response(404, {"error": {"code": "not_found", "message": "接口不存在"}}, origin)
