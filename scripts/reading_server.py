"""Local-only Pocket TTS audio stream. See README.md for setup."""

import argparse
import base64
import json
import os
from pathlib import Path
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

PORT = 49325
ROOT = Path(__file__).resolve().parents[1]


def allowed_origin(origin):
    parsed = urlparse(origin or "")
    return (parsed.scheme in ("http", "https") and parsed.hostname in
            ("localhost", "127.0.0.1", "tauri.localhost")) or origin == "tauri://localhost"


def make_handler(model, voice):
    # ponytail: one CPU model serializes readers; separate workers if concurrency is needed.
    lock = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def end_headers(self):
            origin = self.headers.get("Origin")
            if allowed_origin(origin):
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

        def do_OPTIONS(self):
            if not allowed_origin(self.headers.get("Origin")):
                self.send_error(403)
                return
            self.send_response(204)
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

        def do_POST(self):
            if self.path != "/speech":
                self.send_error(404)
                return
            if not allowed_origin(self.headers.get("Origin")):
                self.send_error(403)
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 1_000_000:
                    raise ValueError("Invalid request size")
                if self.headers.get_content_type() != "application/json":
                    raise ValueError("Expected JSON")
                self.connection.settimeout(30)
                data = json.loads(self.rfile.read(length))
                text = data.get("text") if isinstance(data, dict) else None
                if not isinstance(text, str) or not text.strip() or len(text) > 100_000:
                    raise ValueError("Use between 1 and 100,000 characters")
            except (ValueError, OSError) as error:
                self.send_error(400, str(error))
                return
            if not lock.acquire(blocking=False):
                self.send_error(409, "The local voice is already reading. Stop it and retry.")
                return
            stop = threading.Event()
            try:
                self.send_response(200)
                self.send_header("Content-Type", "application/x-ndjson")
                self.end_headers()
                self.emit({"sampleRate": model.sample_rate})
                for audio in model.generate_audio_stream(voice, text, copy_state=True, stop=stop):
                    pcm = audio.detach().cpu().clamp(-1, 1).mul(32767).numpy().astype("<i2")
                    self.emit({"audio": base64.b64encode(pcm.tobytes()).decode("ascii")})
                self.emit({"done": True})
            except (BrokenPipeError, ConnectionResetError, TimeoutError):
                pass
            except Exception:
                self.log_error("Speech generation failed")
                try:
                    self.emit({"error": "Local speech generation failed. Check the voice service and retry."})
                except OSError:
                    pass
            finally:
                stop.set()
                lock.release()

        def emit(self, message):
            self.wfile.write((json.dumps(message) + "\n").encode())
            self.wfile.flush()

        def log_message(self, format, *args):
            # Do not log note contents or request bodies.
            pass

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true", help="Download English model and voice, then exit")
    args = parser.parse_args()
    os.environ["HF_HOME"] = str(ROOT / ".reading-models")
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    os.environ["DO_NOT_TRACK"] = "1"
    os.environ["HF_HUB_OFFLINE"] = "0" if args.download else "1"
    try:
        from pocket_tts import TTSModel
        print("Loading local English voice…", flush=True)
        model = TTSModel.load_model(language="english_18m_2026-10")
        voice = model.get_state_for_audio_prompt("alba")
    except Exception as error:
        raise SystemExit(f"Could not load Pocket TTS: {error}\nSee README.md → Read aloud for setup.") from error
    if args.download:
        print("English voice cached. Reading can now run offline.")
        return
    server = ThreadingHTTPServer(("127.0.0.1", PORT), make_handler(model, voice))
    print(f"Local voice ready at http://127.0.0.1:{PORT} (offline)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
