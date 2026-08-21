from pathlib import Path

from teethsee_ai.config import Settings
from teethsee_ai.service import AiService


def service() -> AiService:
    return AiService(
        Settings(
            model_path=Path("/missing/model.onnx"),
            allowed_origins=frozenset(),
            max_requests_per_minute=20,
            min_confidence=0.60,
        )
    )


def test_health_has_security_headers() -> None:
    response = service().handle("GET", "/health", {}, b"", "local")
    assert response.status == 200
    assert response.payload["status"] == "ok"
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["X-Content-Type-Options"] == "nosniff"


def test_analyze_rejects_non_image() -> None:
    response = service().handle(
        "POST",
        "/v1/analyze",
        {"Content-Type": "image/png"},
        b"not an image",
        "local",
    )
    assert response.status == 415
    assert response.payload["error"]["code"] == "invalid_image_signature"


def test_rejects_untrusted_browser_origin() -> None:
    response = service().handle(
        "GET",
        "/health",
        {"Origin": "https://attacker.example"},
        b"",
        "local",
    )
    assert response.status == 403
    assert response.payload["error"]["code"] == "origin_not_allowed"

