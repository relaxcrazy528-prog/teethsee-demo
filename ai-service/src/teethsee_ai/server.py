from __future__ import annotations

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ipaddress
import json
from typing import ClassVar

from .config import load_settings
from .images import MAX_IMAGE_BYTES
from .service import AiService, ServiceResponse


class AiRequestHandler(BaseHTTPRequestHandler):
    service: ClassVar[AiService]
    server_version = "teethsee-ai/0.1"
    sys_version = ""

    def log_message(self, format_string: str, *args: object) -> None:
        return

    def _send(self, response: ServiceResponse) -> None:
        encoded = b"" if response.payload is None else json.dumps(
            response.payload, ensure_ascii=False, separators=(",", ":")
        ).encode("utf-8")
        self.send_response(response.status)
        for name, value in response.headers.items():
            self.send_header(name, value)
        if encoded:
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        if encoded:
            self.wfile.write(encoded)

    def _read_body(self) -> bytes | None:
        raw_length = self.headers.get("Content-Length")
        if raw_length is None:
            self._send(self.service._response(411, {"error": {"code": "length_required", "message": "缺少请求长度"}}))
            return None
        try:
            length = int(raw_length)
        except ValueError:
            self._send(self.service._response(400, {"error": {"code": "invalid_content_length", "message": "请求长度不正确"}}))
            return None
        if length < 0 or length > MAX_IMAGE_BYTES:
            self._send(self.service._response(413, {"error": {"code": "image_too_large", "message": "图片不能超过 8MB"}}))
            return None
        body = self.rfile.read(length)
        if len(body) != length:
            self._send(self.service._response(400, {"error": {"code": "incomplete_request", "message": "图片数据不完整"}}))
            return None
        return body

    def _handle(self) -> None:
        body = b""
        if self.command == "POST":
            maybe_body = self._read_body()
            if maybe_body is None:
                return
            body = maybe_body
        headers = {name: value for name, value in self.headers.items()}
        client_key = self.client_address[0] if self.client_address else "unknown"
        self._send(self.service.handle(self.command, self.path, headers, body, client_key))

    do_GET = _handle
    do_POST = _handle
    do_OPTIONS = _handle


def _loopback_host(value: str) -> str:
    if value == "localhost":
        return value
    try:
        if ipaddress.ip_address(value).is_loopback:
            return value
    except ValueError:
        pass
    raise argparse.ArgumentTypeError("研发服务只允许监听本机回环地址")


def main() -> int:
    parser = argparse.ArgumentParser(description="启动 teethsee 本地 AI 服务")
    parser.add_argument("--host", type=_loopback_host, default="127.0.0.1")
    parser.add_argument("--port", type=int, choices=range(1024, 65536), default=8788)
    args = parser.parse_args()
    AiRequestHandler.service = AiService(load_settings())
    server = ThreadingHTTPServer((args.host, args.port), AiRequestHandler)
    print(f"teethsee AI 服务已启动：http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
