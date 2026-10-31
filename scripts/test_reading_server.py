"""Exercise the HTTP stream without downloading or loading a speech model."""

import base64
import http.client
import json
import threading
import unittest
from http.server import ThreadingHTTPServer

from reading_server import allowed_origin, make_handler


class FakeAudio:
    def detach(self): return self
    def cpu(self): return self
    def clamp(self, *_): return self
    def mul(self, *_): return self
    def numpy(self): return self
    def astype(self, _): return self
    def tobytes(self): return b"\x00\x00\xff\x7f"


class FakeModel:
    sample_rate = 24000

    def generate_audio_stream(self, voice, text, **kwargs):
        if text == "fail":
            raise RuntimeError("fake failure")
        assert kwargs["copy_state"] is True
        yield FakeAudio()


class ReadingServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(FakeModel(), None))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, body, origin="http://localhost:5173", method="POST"):
        connection = http.client.HTTPConnection(*self.server.server_address)
        connection.request(method, "/speech", json.dumps(body), {
            "Content-Type": "application/json", "Origin": origin,
        })
        response = connection.getresponse()
        status, headers, data = response.status, dict(response.getheaders()), response.read()
        connection.close()
        return status, headers, data

    def test_stream_and_errors(self):
        status, headers, data = self.request({"text": "Hello"})
        self.assertEqual(status, 200)
        self.assertEqual(headers["Access-Control-Allow-Origin"], "http://localhost:5173")
        frames = [json.loads(line) for line in data.splitlines()]
        self.assertEqual(frames[0], {"sampleRate": 24000})
        self.assertEqual(base64.b64decode(frames[1]["audio"]), b"\x00\x00\xff\x7f")
        self.assertEqual(frames[-1], {"done": True})
        self.assertIn("error", json.loads(self.request({"text": "fail"})[2].splitlines()[-1]))
        self.assertEqual(self.request({"text": "Try again"})[0], 200)

    def test_validation_and_preflight(self):
        for body in ({"text": ""}, {"text": 5}, [], {"text": "a" * 100_001}):
            self.assertEqual(self.request(body)[0], 400)
        self.assertEqual(self.request({"text": "hello"}, "https://untrusted.example")[0], 403)
        self.assertEqual(self.request({}, method="OPTIONS")[0], 204)
        self.assertTrue(allowed_origin("tauri://localhost"))
        self.assertTrue(allowed_origin("http://tauri.localhost"))
        self.assertFalse(allowed_origin("http://localhost.evil.example"))


if __name__ == "__main__":
    unittest.main()
