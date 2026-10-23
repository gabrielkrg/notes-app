#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use notes_core::{
    github::{self, Remote, SyncResult},
    search::SearchIndex,
    vault::Vault,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::BTreeMap,
    fs,
    io::Write,
    path::PathBuf,
    sync::{Arc, Mutex, RwLock},
};
use tauri::{Emitter, Manager};

type Result<T> = std::result::Result<T, String>;

#[derive(Default, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct Settings {
    notes_roots: Vec<PathBuf>,
    default_notes_root: Option<PathBuf>,
    github_remotes: Vec<Remote>,
}

struct Token {
    value: String,
    persisted: bool,
}

struct AppState {
    vault: Mutex<Vault>,
    settings: Mutex<Settings>,
    settings_file: PathBuf,
    cache_dir: PathBuf,
    token: Mutex<Token>,
    github: Mutex<Option<SyncResult>>,
    // Serialize snapshot publication so a slow refresh cannot overwrite a newer save.
    snapshot_lock: Mutex<()>,
    snapshot: Mutex<BTreeMap<String, String>>,
    search: RwLock<SearchIndex>,
}

fn credential() -> Result<keyring::Entry> {
    keyring::Entry::new("dev.notes.rust", "github-token").map_err(|e| e.to_string())
}

impl AppState {
    fn new(config: PathBuf, cache_dir: PathBuf) -> Result<Self> {
        fs::create_dir_all(&config).map_err(|e| e.to_string())?;
        let settings_file = config.join("settings.json");
        let mut settings: Settings = if settings_file.exists() {
            serde_json::from_slice(&fs::read(&settings_file).map_err(|e| e.to_string())?)
                .map_err(|e| format!("Could not read settings: {e}"))?
        } else {
            Settings::default()
        };
        // An explicit environment path is useful for portable installs and isolated tests.
        if let Ok(roots) = std::env::var("NOTES_RUST_ROOTS") {
            settings.notes_roots = roots
                .split(',')
                .filter(|s| !s.trim().is_empty())
                .map(|s| PathBuf::from(s.trim()))
                .collect();
        } else if !settings_file.exists() {
            let fallback = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../notes");
            if fallback.is_dir() {
                settings.notes_roots = vec![fallback];
            }
        } else {
            // Unplugged or moved vaults must not prevent opening Settings.
            settings.notes_roots.retain(|root| root.is_dir());
        }
        settings.github_remotes = github::validate_remotes(settings.github_remotes)?;
        let vault = Vault::new(
            settings.notes_roots.clone(),
            settings.default_notes_root.clone(),
        )?;
        let value = credential()
            .and_then(|entry| entry.get_password().map_err(|e| e.to_string()))
            .unwrap_or_default();
        Ok(Self {
            vault: Mutex::new(vault),
            settings: Mutex::new(settings),
            settings_file,
            cache_dir,
            token: Mutex::new(Token {
                value,
                persisted: true,
            }),
            github: Mutex::new(None),
            snapshot_lock: Mutex::new(()),
            snapshot: Mutex::new(BTreeMap::new()),
            search: RwLock::new(SearchIndex::default()),
        })
    }

    fn save_settings(&self, settings: &Settings) -> Result<()> {
        let parent = self.settings_file.parent().ok_or("Invalid settings path")?;
        let mut tmp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
        tmp.write_all(&serde_json::to_vec_pretty(settings).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
        tmp.as_file().sync_all().map_err(|e| e.to_string())?;
        tmp.persist(&self.settings_file)
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    fn list_notes(&self, refresh_github: bool) -> Result<Value> {
        let _serial = self.snapshot_lock.lock().map_err(|e| e.to_string())?;
        let mut files = self.vault.lock().map_err(|e| e.to_string())?.snapshot()?;
        let remotes = self
            .settings
            .lock()
            .map_err(|e| e.to_string())?
            .github_remotes
            .clone();
        let mut remote = self.github.lock().map_err(|e| e.to_string())?;
        if refresh_github || remote.is_none() {
            let token = self.token.lock().map_err(|e| e.to_string())?.value.clone();
            let mut labels = Vec::new();
            for root in self.vault.lock().map_err(|e| e.to_string())?.roots() {
                let path = PathBuf::from(root);
                let base = path.file_name().unwrap_or_default().to_string_lossy();
                let mut label = base.to_string();
                let mut n = 2;
                while labels.contains(&label) {
                    label = format!("{base}-{n}");
                    n += 1;
                }
                labels.push(label);
            }
            *remote = Some(github::sync(&remotes, &token, &self.cache_dir, &labels));
        }
        let remote = remote.as_ref().ok_or("GitHub snapshot unavailable")?;
        for (file, raw) in &remote.files {
            files.entry(file.clone()).or_insert_with(|| raw.clone());
        }
        let mut previous = self.snapshot.lock().map_err(|e| e.to_string())?;
        if *previous != files {
            self.search
                .write()
                .map_err(|e| e.to_string())?
                .update(&files);
            *previous = files.clone();
        }
        Ok(
            json!({"files": files, "githubFiles": remote.github_files, "githubNames": remote.github_names}),
        )
    }

    fn dispatch(&self, operation: &str, args: Value) -> Result<Value> {
        let text = |key: &str| {
            args.get(key)
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_owned()
        };
        match operation {
            "open_url" => {
                let url = reqwest::Url::parse(&text("url")).map_err(|_| "Invalid URL")?;
                if !matches!(url.scheme(), "https" | "http" | "mailto") {
                    return Err("Unsupported URL".into());
                }
                open::that(url.as_str()).map_err(|e| e.to_string())?;
                Ok(Value::Null)
            }
            "platform" => Ok(json!(match std::env::consts::OS {
                "macos" => "darwin",
                "windows" => "win32",
                other => other,
            })),
            "list_notes" => self.list_notes(args["refreshGithub"].as_bool().unwrap_or(false)),
            "search_notes" => Ok(json!(self
                .search
                .read()
                .map_err(|e| e.to_string())?
                .search(&text("query"), 30))),
            "get_notes_root" => Ok(json!(self
                .vault
                .lock()
                .map_err(|e| e.to_string())?
                .roots()
                .first()
                .cloned()
                .unwrap_or_default())),
            "get_notes_roots" => Ok(json!(self.vault.lock().map_err(|e| e.to_string())?.roots())),
            "get_default_notes_root" => Ok(json!(self
                .vault
                .lock()
                .map_err(|e| e.to_string())?
                .default_root())),
            "set_notes_root" | "set_notes_roots" | "set_default_notes_root" => {
                let _serial = self.snapshot_lock.lock().map_err(|e| e.to_string())?;
                let mut vault = self.vault.lock().map_err(|e| e.to_string())?;
                let mut settings = self.settings.lock().map_err(|e| e.to_string())?;
                let old_roots = vault.roots().into_iter().map(PathBuf::from).collect();
                let old_default = vault.default_root();
                let result = if operation == "set_default_notes_root" {
                    json!(vault.set_default_root(&text("dir"))?)
                } else {
                    let dirs = if operation == "set_notes_root" {
                        vec![PathBuf::from(text("dir"))]
                    } else {
                        serde_json::from_value::<Vec<PathBuf>>(args["dirs"].clone())
                            .map_err(|e| e.to_string())?
                    };
                    let roots = vault.set_roots(dirs)?;
                    if operation == "set_notes_root" {
                        json!(roots.first().cloned().unwrap_or_default())
                    } else {
                        json!(roots)
                    }
                };
                let mut next = settings.clone();
                next.notes_roots = vault.roots().into_iter().map(PathBuf::from).collect();
                next.default_notes_root = if vault.default_root().is_empty() {
                    None
                } else {
                    Some(PathBuf::from(vault.default_root()))
                };
                if let Err(error) = self.save_settings(&next) {
                    *vault = Vault::new(
                        old_roots,
                        if old_default.is_empty() {
                            None
                        } else {
                            Some(PathBuf::from(old_default))
                        },
                    )?;
                    return Err(error);
                }
                *settings = next;
                *self.github.lock().map_err(|e| e.to_string())? = None;
                // Never expose detached folders through a stale search index.
                *self.search.write().map_err(|e| e.to_string())? = SearchIndex::default();
                self.snapshot.lock().map_err(|e| e.to_string())?.clear();
                Ok(result)
            }
            "pick_notes_folder" => Ok(json!(rfd::FileDialog::new()
                .set_title("Choose notes folder")
                .pick_folder()
                .map(|p| p.to_string_lossy().into_owned()))),
            "get_github_remotes" => Ok(json!(
                self.settings
                    .lock()
                    .map_err(|e| e.to_string())?
                    .github_remotes
            )),
            "set_github_remotes" => {
                let _serial = self.snapshot_lock.lock().map_err(|e| e.to_string())?;
                let remotes = github::validate_remotes(
                    serde_json::from_value(args["remotes"].clone()).map_err(|e| e.to_string())?,
                )?;
                let mut settings = self.settings.lock().map_err(|e| e.to_string())?;
                let mut next = settings.clone();
                next.github_remotes = remotes.clone();
                self.save_settings(&next)?;
                *settings = next;
                *self.github.lock().map_err(|e| e.to_string())? = None;
                Ok(json!(remotes))
            }
            "get_github_sync_errors" => Ok(json!(self
                .github
                .lock()
                .map_err(|e| e.to_string())?
                .as_ref()
                .map(|g| g.errors.clone())
                .unwrap_or_default())),
            "has_github_token" => Ok(json!(!self
                .token
                .lock()
                .map_err(|e| e.to_string())?
                .value
                .is_empty())),
            "github_token_persisted" => Ok(json!(
                self.token.lock().map_err(|e| e.to_string())?.persisted
            )),
            "set_github_token" | "clear_github_token" => {
                let value = if operation == "clear_github_token" {
                    String::new()
                } else {
                    github::normalize_token(&text("token"))
                };
                let mut token = self.token.lock().map_err(|e| e.to_string())?;
                let entry = credential();
                let persisted = if value.is_empty() {
                    match entry.and_then(|e| match e.delete_credential() {
                        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
                        Err(e) => Err(e.to_string()),
                    }) {
                        Ok(()) => true,
                        Err(error) => return Err(format!("Could not clear saved token: {error}")),
                    }
                } else {
                    entry
                        .and_then(|e| e.set_password(&value).map_err(|e| e.to_string()))
                        .is_ok()
                };
                *token = Token { value, persisted };
                drop(token);
                *self.github.lock().map_err(|e| e.to_string())? = None;
                Ok(json!({"persisted": persisted}))
            }
            "open_note" | "open_in_browser" => {
                let file = self
                    .vault
                    .lock()
                    .map_err(|e| e.to_string())?
                    .resolve(&text("file"))?;
                if !file.is_file() {
                    return Err("Note not found".into());
                }
                open_file(&file, operation == "open_note")?;
                Ok(Value::Null)
            }
            "read_asset" => Ok(json!(self
                .vault
                .lock()
                .map_err(|e| e.to_string())?
                .read_asset(&text("file"))?)),
            "write_note" | "create_note" | "create_folder" | "delete_note" | "delete_folder"
            | "rename_note" | "rename_folder" => {
                let _serial = self.snapshot_lock.lock().map_err(|e| e.to_string())?;
                let mut vault = self.vault.lock().map_err(|e| e.to_string())?;
                let result = match operation {
                    "write_note" => {
                        vault.write(&text("file"), &text("content"))?;
                        json!({"file":text("file")})
                    }
                    "create_note" | "create_folder" => json!(vault.create(
                        &text("parent"),
                        &text("name"),
                        &text("type"),
                        operation == "create_folder"
                    )?),
                    "delete_note" => {
                        vault.delete_note(&text("file"))?;
                        json!({"file":text("file")})
                    }
                    "delete_folder" => {
                        let names: Vec<String> = serde_json::from_value(
                            args.get("expectedNames").cloned().unwrap_or(json!([])),
                        )
                        .map_err(|e| e.to_string())?;
                        vault.delete_folder(&text("path"), &text("confirmName"), &names)?;
                        json!({"path":text("path")})
                    }
                    "rename_note" => {
                        json!({"file":vault.rename_note(&text("file"), &text("name"))?})
                    }
                    _ => json!({"path":vault.rename_folder(&text("path"), &text("name"))?}),
                };
                let mut files = vault.snapshot()?;
                if let Some(remote) = self.github.lock().map_err(|e| e.to_string())?.as_ref() {
                    for (file, raw) in &remote.files {
                        files.entry(file.clone()).or_insert_with(|| raw.clone());
                    }
                }
                self.search
                    .write()
                    .map_err(|e| e.to_string())?
                    .update(&files);
                *self.snapshot.lock().map_err(|e| e.to_string())? = files;
                Ok(result)
            }
            _ => Err(format!("Unknown operation: {operation}")),
        }
    }
}

fn open_file(file: &std::path::Path, choose: bool) -> Result<()> {
    #[cfg(target_os = "linux")]
    if choose {
        let uri = reqwest::Url::from_file_path(file)
            .map_err(|_| "Invalid file path")?
            .to_string();
        for executable in ["kioclient", "kioclient5"] {
            if std::process::Command::new(executable)
                .args(["openWith", &uri])
                .spawn()
                .is_ok()
            {
                return Ok(());
            }
        }
        if let Ok(status) = std::process::Command::new("gdbus")
            .args([
                "call",
                "--session",
                "--dest",
                "org.freedesktop.portal.Desktop",
                "--object-path",
                "/org/freedesktop/portal/desktop",
                "--method",
                "org.freedesktop.portal.OpenURI.OpenURI",
                "",
                &uri,
                "{'ask': <true>}",
            ])
            .status()
        {
            if status.success() {
                return Ok(());
            }
        }
    }
    #[cfg(target_os = "windows")]
    if choose {
        std::process::Command::new("rundll32.exe")
            .arg("shell32.dll,OpenAs_RunDLL")
            .arg(file)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    let _ = choose;
    open::that(file).map_err(|e| e.to_string())
}

#[tauri::command]
async fn notes_command(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, Arc<AppState>>,
    operation: String,
    args: Value,
) -> Result<Value> {
    if window.label() != "main" {
        return Err("Untrusted window".into());
    }
    match operation.as_str() {
        "window_minimize" => {
            window.minimize().map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "window_toggle_maximize" => {
            if window.is_maximized().map_err(|e| e.to_string())? {
                window.unmaximize()
            } else {
                window.maximize()
            }
            .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "window_close" => {
            window.close().map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "window_is_maximized" => Ok(json!(window.is_maximized().map_err(|e| e.to_string())?)),
        "set_title_bar_overlay" => {
            if let Some(color) = args["overlay"]["color"].as_str().filter(|s| {
                s.len() == 7 && s.starts_with('#') && s[1..].bytes().all(|b| b.is_ascii_hexdigit())
            }) {
                let rgb = u32::from_str_radix(&color[1..], 16).map_err(|e| e.to_string())?;
                window
                    .set_background_color(Some(tauri::window::Color(
                        (rgb >> 16) as u8,
                        (rgb >> 8) as u8,
                        rgb as u8,
                        255,
                    )))
                    .map_err(|e| e.to_string())?;
            }
            Ok(Value::Null)
        }
        _ => {
            let state = state.inner().clone();
            tauri::async_runtime::spawn_blocking(move || state.dispatch(&operation, args))
                .await
                .map_err(|e| e.to_string())?
        }
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let config = std::env::var_os("NOTES_RUST_CONFIG_DIR")
                .map(PathBuf::from)
                .unwrap_or(app.path().app_config_dir()?);
            let state = AppState::new(config, app.path().app_cache_dir()?)
                .map_err(std::io::Error::other)?;
            app.manage(Arc::new(state));
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Resized(_) = event {
                let _ = window.emit(
                    "window-maximize-changed",
                    window.is_maximized().unwrap_or(false),
                );
            }
        })
        .invoke_handler(tauri::generate_handler![notes_command])
        .run(tauri::generate_context!())
        .expect("Could not start Notes Rust");
}
