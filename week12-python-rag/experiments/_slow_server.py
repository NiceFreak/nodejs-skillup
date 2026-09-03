"""本地可控慢速 HTTP server（C-1/C-2/C-3 共享脚手架，白名单）。

语义：accept 一个连接 -> 读完整个请求 -> 可选 hold 一段时长（期间不读不写，
让客户端挂在「读响应」上，从而可控触发 httpx 的 read timeout）-> 发送
OpenAI chat.completion 格式响应（DeepSeekClient.chat 需 json.loads 成功）。

观察辅助：
- hold 期间以小块间隔探测 FIN（客户端主动关闭连接），记录时间戳——
  用于回答 C-1/C-2 的「超时/取消后连接是否被客户端关闭、何时关闭」。
- 若 hold 结束尝试发送时客户端已关闭，send 抛 OSError，同样记录。

运行：不单独执行，被 c1/c2/c3 脚本 import。
"""

import json
import socket
import threading
import time

_HEADER_END = b"\r\n\r\n"


def _openai_response_body(content: str = "ok") -> bytes:
    payload = json.dumps(
        {
            "id": "chatcmpl-slow",
            "object": "chat.completion",
            "created": 0,
            "model": "slow-model",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": content},
                    "finish_reason": "stop",
                }
            ],
        }
    ).encode("utf-8")
    head = (
        b"HTTP/1.1 200 OK\r\n"
        b"Content-Type: application/json\r\n"
        + f"Content-Length: {len(payload)}\r\n".encode("ascii")
        + b"Connection: close\r\n\r\n"
    )
    return head + payload


def _read_request(conn: socket.socket) -> bytes:
    """读到请求头结束并读完 body（按 Content-Length），返回原始请求字节。"""
    data = b""
    while _HEADER_END not in data:
        chunk = conn.recv(4096)
        if not chunk:
            break
        data += chunk
    head, _, _ = data.partition(_HEADER_END)
    length = 0
    for line in head.split(b"\r\n"):
        if line.lower().startswith(b"content-length:"):
            length = int(line.split(b":", 1)[1].strip())
            break
    while len(data) < len(head) + len(_HEADER_END) + length:
        chunk = conn.recv(4096)
        if not chunk:
            break
        data += chunk
    return data


class HoldServer:
    """单连接慢速 server。构造即启动线程；port 从 bind 后读取。

    events 以 (monotonic 秒, 描述) 追加，供实验脚本打印客观事实。
    """

    def __init__(self, hold_seconds: float = 3.0, respond: bool = True) -> None:
        self.hold_seconds = hold_seconds
        self.respond = respond
        self.events: list[tuple[float, str]] = []

        self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._sock.bind(("127.0.0.1", 0))
        self._sock.listen(1)
        self._sock.settimeout(10.0)
        self.port = self._sock.getsockname()[1]

        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def _mark(self, label: str) -> None:
        self.events.append((time.monotonic(), label))

    def _run(self) -> None:
        try:
            conn, _ = self._sock.accept()
        except OSError as exc:  # server 被外部关闭
            self._mark(f"accept failed: {exc!r}")
            return
        with conn:
            conn.settimeout(0.05)
            self._mark("accepted")
            try:
                req = _read_request(conn)
                self._mark(f"request received ({len(req)} bytes)")
            except OSError as exc:
                self._mark(f"request read failed: {exc!r}")
                return

            deadline = time.monotonic() + self.hold_seconds
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                try:
                    chunk = conn.recv(4096)
                except socket.timeout:
                    continue
                except OSError as exc:
                    self._mark(f"recv failed during hold: {exc!r}")
                    return
                if chunk == b"":
                    self._mark(f"FIN observed at hold+{self.hold_seconds - max(remaining, 0):.3f}s")
                    return
                self._mark(f"unexpected {len(chunk)} bytes during hold")

            if not self.respond:
                return
            try:
                conn.sendall(_openai_response_body())
                self._mark("response sent")
            except OSError as exc:
                self._mark(f"send failed (client closed?): {exc!r}")

    def close(self) -> None:
        try:
            self._sock.close()
        except OSError:
            pass
