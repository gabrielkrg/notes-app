#!/usr/bin/env python3
"""Exercise the real Rust IPC and rendered WebKit UI using an isolated notes folder.

Build a debug executable first: npm run build -- --debug --no-bundle
Install tauri-driver, then: python3 tests/desktop_smoke.py
No Python packages needed. Linux needs WebKitWebDriver and a display.
"""
import argparse
import base64
import json
import os
from pathlib import Path
import shutil
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
    parser.add_argument("--binary", default="src-tauri/target/debug/notes-rust")
    parser.add_argument("--driver", default=shutil.which("tauri-driver") or "tauri-driver")
    parser.add_argument("--screenshot", help="Optional PNG of the tested notes window")
    options = parser.parse_args()
    binary = str(Path(options.binary).resolve())
    if not Path(binary).is_file():
        parser.error(f"Build the desktop executable first: {binary}")
    port, native_port = free_port(), free_port()
    base = f"http://127.0.0.1:{port}"

    def request(method, path, body=None):
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(base + path, data, {"Content-Type": "application/json"}, method=method)
        try:
            with urllib.request.urlopen(req, timeout=45) as response:
                result = json.load(response)
        except urllib.error.HTTPError as error:
            raise AssertionError(error.read().decode()) from error
        if isinstance(result.get("value"), dict) and "error" in result["value"]:
            raise AssertionError(result["value"])
        return result.get("value")

    with tempfile.TemporaryDirectory(prefix="notes-rust-smoke-") as temp:
        folder = Path(temp)
        notes = folder / "vault"
        notes.mkdir()
        (notes / "welcome.md").write_text("---\ntitle: Welcome\nnav: Start\n---\n\n# Welcome\n\nRust native needle\n\n- [ ] A task\n")
        (notes / "second.md").write_text("# Second\n\n[Welcome](welcome.md)\n")
        (notes / "demo.html").write_text("<html><head><title>Sandbox</title></head><body><output id='result'>pending</output><script>document.getElementById('result').textContent='script works';parent.postMessage({type:'smoke-sandbox',bridge:typeof window.__TAURI__},'*')</script></body></html>")
        environment = dict(os.environ, NOTES_RUST_ROOTS=str(notes), NOTES_RUST_CONFIG_DIR=str(folder / "config"), TAURI_WEBVIEW_AUTOMATION="true")
        environment.update(XDG_DATA_HOME=str(folder / "data"), XDG_CACHE_HOME=str(folder / "cache"))
        environment.setdefault("WEBKIT_DISABLE_DMABUF_RENDERER", "1")
        with (folder / "driver.log").open("w+") as log:
            driver = subprocess.Popen([options.driver, "--port", str(port), "--native-port", str(native_port)], env=environment, stdout=log, stderr=log)
            session = None
            try:
                for _ in range(100):
                    try:
                        with socket.create_connection(("127.0.0.1", port), timeout=0.1), socket.create_connection(("127.0.0.1", native_port), timeout=0.1):
                            break
                    except OSError:
                        if driver.poll() is not None:
                            raise RuntimeError("tauri-driver exited")
                        time.sleep(0.05)
                result = request("POST", "/session", {"capabilities": {"alwaysMatch": {"tauri:options": {"application": binary}}}})
                session = result["sessionId"]
                prefix = f"/session/{session}"
                request("POST", prefix + "/timeouts", {"script": 30000})

                def run(script):
                    wrapped = "const done=arguments[arguments.length-1]; Promise.resolve().then(async()=>{" + script + "}).then(result=>done({ok:true,result})).catch(error=>done({ok:false,error:String(error),stack:error.stack}));"
                    result = request("POST", prefix + "/execute/async", {"script": wrapped, "args": []})
                    assert result["ok"], result
                    return result.get("result")

                run("""
                  for(let i=0;i<200 && !window.desktop;i++) await new Promise(r=>setTimeout(r,25));
                  if(!window.desktop) throw Error('Rust bridge did not initialize');
                  const wait = async (test) => {for(let i=0;i<200;i++){if(test())return;await new Promise(r=>setTimeout(r,25))}throw Error('UI did not load: '+document.body.innerText)};
                  await wait(()=>document.body.innerText.includes('Welcome')||document.body.innerText.includes('Start'));
                  window.smokeWait=wait;
                  return {platform:window.desktop.platform, roots:await window.desktop.getNotesRoots()};
                """)
                print("PASS: native webview, Rust bridge, note loading")

                result = run("""
                  const api=window.desktop, assert=(value,message)=>{if(!value)throw Error(message)};
                  let snapshot=await api.listNotes(); assert(Object.keys(snapshot.files).length===3,'snapshot');
                  assert((await api.searchNotes('needle')).contents.length===1,'native body search');
                  assert((await api.searchNotes('Start')).files.length===1,'native metadata search');
                  for(const type of ['markdown','text','html','css','js']) {
                    const note=await api.createNote({name:'Smoke '+type,type});
                    await api.writeNote(note.file,'replacement zygomatic '+type);
                    assert((await api.searchNotes('zygomatic')).contents.some(hit=>hit.file===note.file),'immediate search after write');
                    const renamed=await api.renameNote({file:note.file,name:'Renamed '+type});
                    await api.deleteNote(renamed.file);
                    assert(!(await api.searchNotes('zygomatic')).contents.some(hit=>hit.file===renamed.file),'no stale hits after delete');
                  }
                  const folder=await api.createFolder({name:'Smoke folder'});
                  const dir=folder.file.replace('/index.md','');
                  const renamed=await api.renameFolder({path:dir,name:'Renamed folder'});
                  let rejected=false; try {await api.deleteFolder({path:renamed.path,confirmName:'wrong'})}catch{rejected=true}
                  assert(rejected,'folder delete confirmation');
                  await api.deleteFolder({path:renamed.path,confirmName:'renamed-folder'});
                  rejected=false;try{await api.writeNote('vault/../../escape.md','bad')}catch{rejected=true}
                  assert(rejected,'path traversal');
                  assert((await api.getGithubSyncErrors()).length===0,'GitHub empty errors');
                  return 'five file types, CRUD, search invalidation, delete confirmation, containment';
                """)
                print("PASS:", result)

                run("""
                  location.hash='#/vault/welcome';
                  await smokeWait(()=>document.querySelector('.typeset-docs')?.textContent.includes('Rust native needle'));
                  document.querySelector('button[aria-label="Search notes"]').click();
                  await smokeWait(()=>document.querySelector('[cmdk-input]'));
                  const input=document.querySelector('[cmdk-input]');
                  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'needle');
                  input.dispatchEvent(new Event('input',{bubbles:true}));
                  await smokeWait(()=>Array.from(document.querySelectorAll('[cmdk-item]')).some(el=>el.textContent.includes('Rust native needle')));
                  document.querySelector('[cmdk-item]').click();
                  await smokeWait(()=>!document.querySelector('[cmdk-input]'));
                  const bookmark=document.querySelector('button[aria-label="Bookmark"]');
                  if(!bookmark)throw Error('Bookmark button absent'); bookmark.click();
                  await smokeWait(()=>document.querySelector('button[aria-label="Remove bookmark"]'));
                  const task=document.querySelector('button[role="checkbox"]');
                  if(!task)throw Error('Markdown task absent'); task.click();
                  for(let i=0;i<200;i++){
                    if((await window.desktop.listNotes()).files['vault/welcome.md'].includes('[x]'))break;
                    if(i===199)throw Error('Task toggle was not saved'); await new Promise(r=>setTimeout(r,25));
                  }
                  Array.from(document.querySelectorAll('button')).find(el=>/^Edit/.test(el.textContent.trim())).click();
                  await smokeWait(()=>document.querySelector('[aria-label="Note editor"]'));
                  const editor=document.querySelector('[aria-label="Note editor"]');
                  editor.innerHTML='<h1>Welcome</h1><p>Rust native needle updated through UI</p>';
                  editor.dispatchEvent(new Event('input',{bubbles:true}));
                  await smokeWait(()=>Array.from(document.querySelectorAll('button')).some(el=>el.textContent.trim()==='Save'&&!el.disabled));
                  Array.from(document.querySelectorAll('button')).find(el=>el.textContent.trim()==='Save').click();
                  await smokeWait(()=>Array.from(document.querySelectorAll('button')).some(el=>el.textContent.trim()==='Save'&&el.disabled));
                  if(!(await window.desktop.listNotes()).files['vault/welcome.md'].includes('updated through UI'))throw Error('UI edit was not saved');
                  Array.from(document.querySelectorAll('button')).find(el=>/^Cancel/.test(el.textContent.trim())).click();
                  await smokeWait(()=>!document.querySelector('[aria-label="Note editor"]'));
                  window.dispatchEvent(new KeyboardEvent('keydown',{key:'f',ctrlKey:true,bubbles:true}));
                  await smokeWait(()=>document.querySelector('[aria-label="Find in note"]'));
                  const find=document.querySelector('[aria-label="Find in note"]');
                  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(find,'needle');
                  find.dispatchEvent(new Event('input',{bubbles:true}));
                  await smokeWait(()=>document.body.textContent.includes('1/1'));
                  find.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
                  location.hash='#/graph';
                  await smokeWait(()=>document.querySelector('svg[aria-label="Note link graph"] line'));
                  return true;
                """)
                print("PASS: Markdown, search dialog, navigation, bookmark, task toggle, visual edit/save, find, graph")

                result = run("""
                  window.sandboxMessage=null;
                  window.addEventListener('message',event=>{if(event.data?.type==='smoke-sandbox')window.sandboxMessage=event.data});
                  location.hash='#/vault/demo';
                  await smokeWait(()=>document.querySelector('iframe'));
                  await smokeWait(()=>window.sandboxMessage);
                  if(sandboxMessage.bridge!=='undefined')throw Error('Sandbox can access Rust bridge');
                  return sandboxMessage;
                """)
                print("PASS: HTML scripts execute inside sandbox without Rust bridge", result)
                run("location.hash='#/vault/welcome';await smokeWait(()=>document.querySelector('.typeset-docs')?.textContent.includes('Rust native needle'));return true;")
                if options.screenshot:
                    png = request("GET", prefix + "/screenshot")
                    Path(options.screenshot).write_bytes(base64.b64decode(png))
                request("DELETE", prefix)
                session = None
            except Exception:
                log.flush()
                print((folder / "driver.log").read_text()[-6000:])
                raise
            finally:
                if session:
                    try:
                        request("DELETE", f"/session/{session}")
                    except Exception:
                        pass
                driver.terminate()
                try:
                    driver.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    driver.kill()


if __name__ == "__main__":
    main()
