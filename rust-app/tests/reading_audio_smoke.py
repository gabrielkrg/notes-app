#!/usr/bin/env python3
"""Check real read-aloud playback in an AppImage. Requires tauri-driver and the local voice service.

python3 tests/reading_audio_smoke.py --binary /path/to/Notes.AppImage --driver /path/to/tauri-driver
An isolated D-Bus session keeps the test separate from an already-running Notes app.
"""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", required=True)
    parser.add_argument("--driver", default="tauri-driver")
    args = parser.parse_args()
    port, native_port = free_port(), free_port()
    base = f"http://127.0.0.1:{port}"

    def request(method, path, body=None):
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(base + path, data, {"Content-Type": "application/json"}, method=method)
        try:
            with urllib.request.urlopen(req, timeout=45) as response:
                result = json.load(response)["value"]
        except urllib.error.HTTPError as error:
            raise AssertionError(error.read().decode()) from error
        assert not (isinstance(result, dict) and "error" in result), result
        return result

    with tempfile.TemporaryDirectory(prefix="notes-audio-smoke-") as temp:
        folder = Path(temp)
        notes = folder / "vault"
        notes.mkdir()
        (notes / "welcome.md").write_text("# Local audio check\n\n" + "Reading stays on this computer. " * 300)
        env = dict(os.environ, NOTES_RUST_ROOTS=str(notes), NOTES_RUST_CONFIG_DIR=str(folder / "config"),
                   XDG_DATA_HOME=str(folder / "data"), XDG_CACHE_HOME=str(folder / "cache"),
                   TAURI_WEBVIEW_AUTOMATION="true", WEBKIT_DISABLE_DMABUF_RENDERER="1")
        with (folder / "driver.log").open("w+") as log:
            driver = subprocess.Popen(["dbus-run-session", "--", args.driver, "--port", str(port),
                                       "--native-port", str(native_port)], env=env, stdout=log, stderr=log)
            session = None
            try:
                for _ in range(100):
                    try:
                        with socket.create_connection(("127.0.0.1", native_port), timeout=.1):
                            break
                    except OSError:
                        if driver.poll() is not None:
                            raise RuntimeError("WebDriver exited")
                        time.sleep(.05)
                result = request("POST", "/session", {"capabilities": {"alwaysMatch": {
                    "tauri:options": {"application": str(Path(args.binary).resolve())}}}})
                session = result["sessionId"]
                prefix = f"/session/{session}"

                def run(script):
                    return request("POST", prefix + "/execute/sync", {"script": script, "args": []})

                def wait(script):
                    for _ in range(200):
                        if run(script):
                            return
                        time.sleep(.1)
                    raise AssertionError(run("return document.body.innerText"))

                def click():
                    element = request("POST", prefix + "/element", {
                        "using": "css selector", "value": '[role="group"][aria-label="Read aloud"] button'})
                    request("POST", prefix + "/element/" + next(iter(element.values())) + "/click", {})

                wait("return !!window.desktop")
                run("location.hash='#/vault/welcome'; const Native=window.AudioContext; window.audioChecks=[];"
                    "window.AudioContext=class extends Native {constructor(...args){super(...args);audioChecks.push(this)}};")
                wait("return !!document.querySelector('[role=group][aria-label=\"Read aloud\"] button')")
                click()
                wait("return !!document.querySelector('[role=alert]') || document.querySelector('[role=group][aria-label=\"Read aloud\"] button')?.textContent==='Pause'")
                assert run("return document.querySelector('[role=alert]')?.textContent") is None, run("return document.querySelector('[role=alert]')?.textContent")
                assert run("return audioChecks.at(-1).state") == "running"
                assert run("return audioChecks.at(-1).currentTime") > 0
                assert run("return getComputedStyle(document.querySelector('[role=group][aria-label=\"Read aloud\"]')).position") == "fixed"
                run("document.querySelector('[data-note-content]').scrollTop=1000")
                wait("return document.querySelector('[data-note-content]').scrollTop>0")
                assert run("const r=document.querySelector('[role=group][aria-label=\"Read aloud\"]').getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight")
                click()
                wait("return audioChecks.at(-1).state==='suspended'")
                assert run("return getComputedStyle(document.querySelector('[role=group][aria-label=\"Read aloud\"]')).position") == "fixed"
                click()
                wait("return audioChecks.at(-1).state==='running'")
                run("document.querySelector('[role=group][aria-label=\"Read aloud\"] button:nth-child(2)').click()")
                wait("return audioChecks.at(-1).state==='closed'")
                assert run("return getComputedStyle(document.querySelector('[role=group][aria-label=\"Read aloud\"]')).position") != "fixed"
                print("PASS: packaged WebKit streams local audio; controls float while scrolling and paused, and return inline on stop.")
            except Exception:
                log.flush()
                log.seek(0)
                print(log.read()[-6000:])
                raise
            finally:
                if session:
                    request("DELETE", f"/session/{session}")
                driver.terminate()
                driver.wait(timeout=10)


if __name__ == "__main__":
    main()
