//! Blocking GitHub transport. Call `sync` from a worker, never the webview thread.
use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::atomic::{AtomicUsize, Ordering},
    time::Duration,
};

const TOO_LARGE: &str =
    "That GitHub repository is too large to open as notes. Use a smaller folder of notes.";
const SKIP: &[&str] = &[
    "node_modules",
    "dist",
    "build",
    "out",
    "target",
    "vendor",
    "__pycache__",
    "venv",
];

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Remote {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub url: String,
    pub owner: String,
    pub repo: String,
    #[serde(rename = "ref", default, skip_serializing_if = "Option::is_none")]
    pub reference: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subpath: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct SyncError {
    pub id: String,
    pub message: String,
}

#[derive(Default, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub files: BTreeMap<String, String>,
    pub github_files: Vec<String>,
    pub github_names: BTreeMap<String, String>,
    pub errors: Vec<SyncError>,
}

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Cache {
    tree_sha: String,
    files: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Deserialize)]
struct Entry {
    path: String,
    #[serde(rename = "type")]
    kind: String,
    sha: String,
}

fn normalize_path(value: &str) -> String {
    value.replace('\\', "/").trim_matches('/').to_owned()
}

fn safe_relative(value: &str) -> bool {
    !value.is_empty()
        && value.split('/').all(|part| {
            !part.is_empty()
                && !part.starts_with('.')
                && !SKIP.contains(&part)
                && !part.contains('\0')
        })
}

fn note_file(value: &str) -> bool {
    value.rsplit_once('.').is_some_and(|(_, ext)| {
        ["md", "txt", "html", "css", "js"].contains(&ext.to_ascii_lowercase().as_str())
    })
}

pub fn validate_remotes(remotes: Vec<Remote>) -> Result<Vec<Remote>, String> {
    let mut seen = BTreeSet::new();
    remotes
        .into_iter()
        .map(|mut remote| {
            remote.owner = remote.owner.trim().to_owned();
            remote.repo = remote.repo.trim().to_owned();
            for value in [&remote.owner, &remote.repo] {
                if value.is_empty()
                    || value == "."
                    || value == ".."
                    || !value
                        .bytes()
                        .all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c))
                {
                    return Err("Use a valid GitHub owner and repository name".to_owned());
                }
            }
            remote.reference = remote.reference.filter(|value| !value.is_empty());
            if remote
                .reference
                .as_ref()
                .is_some_and(|value| value.chars().any(char::is_control))
            {
                return Err("Invalid GitHub branch".to_owned());
            }
            remote.subpath = remote
                .subpath
                .map(|value| normalize_path(&value))
                .filter(|value| !value.is_empty());
            if remote.subpath.as_ref().is_some_and(|value| {
                value.split('/').any(|part| {
                    part.is_empty()
                        || part == "."
                        || part == ".."
                        || part.chars().any(char::is_control)
                })
            }) {
                return Err("Invalid GitHub folder".to_owned());
            }
            if remote.id.is_empty() {
                remote.id = format!(
                    "github:{}/{}@{}:{}",
                    remote.owner,
                    remote.repo,
                    remote.reference.as_deref().unwrap_or(""),
                    remote.subpath.as_deref().unwrap_or("")
                );
            }
            if !seen.insert(remote.id.clone()) {
                return Err("That GitHub repository is already attached".to_owned());
            }
            if remote.url.is_empty() {
                remote.url = format!("https://github.com/{}/{}", remote.owner, remote.repo);
            }
            Ok(remote)
        })
        .collect()
}

pub fn normalize_token(raw: &str) -> String {
    let mut token = raw.trim();
    if let Some((scheme, rest)) = token.split_once(char::is_whitespace) {
        if scheme.eq_ignore_ascii_case("bearer") || scheme.eq_ignore_ascii_case("token") {
            token = rest.trim();
        }
    }
    if token.len() >= 2
        && ((token.starts_with('"') && token.ends_with('"'))
            || (token.starts_with('\'') && token.ends_with('\'')))
    {
        token = &token[1..token.len() - 1];
    }
    token.chars().filter(|c| !c.is_whitespace()).collect()
}

fn encoded(value: &str) -> String {
    let mut out = String::new();
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || b"-._~".contains(&byte) {
            out.push(byte as char);
        } else {
            use std::fmt::Write;
            let _ = write!(out, "%{byte:02X}");
        }
    }
    out
}

fn cache_file(dir: &Path, key: &str) -> PathBuf {
    dir.join(format!("{:x}.json", Sha256::digest(key.as_bytes())))
}

fn read_cache(path: &Path) -> Option<Cache> {
    serde_json::from_slice(&fs::read(path).ok()?).ok()
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("Invalid cache path")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let mut tmp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    tmp.write_all(bytes).map_err(|e| e.to_string())?;
    tmp.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}

trait Api: Sync {
    fn get(&self, path: &str) -> Result<Value, String>;
}

struct GithubApi {
    client: Client,
    token: String,
}

impl Api for GithubApi {
    fn get(&self, path: &str) -> Result<Value, String> {
        let mut request = self
            .client
            .get(format!("https://api.github.com{path}"))
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28");
        if !self.token.is_empty() {
            request = request.bearer_auth(&self.token);
        }
        let response = request
            .send()
            .map_err(|_| "Could not reach GitHub. Cached notes remain available.".to_owned())?;
        let status = response.status();
        let body: Value = response.json().unwrap_or(Value::Null);
        if status.is_success() {
            return Ok(body);
        }
        let message = match status.as_u16() {
            401 => "GitHub rejected that token. Create a fine-grained token with Contents: Read.",
            404 if self.token.is_empty() => "Repository not found. If it is private, add a token with access to it.",
            404 => "That token cannot read this repository. Grant it access to the repo with Contents: Read, then Sync.",
            403 if body["message"].as_str().unwrap_or("").to_ascii_lowercase().contains("rate limit") => "GitHub rate limit reached. Add a token or wait and try again.",
            403 if ["sso", "saml"].iter().any(|word| body["message"].as_str().unwrap_or("").to_ascii_lowercase().contains(word)) => "GitHub needs SSO authorization for this token.",
            403 => "GitHub denied access to that repository.",
            _ => "Could not load that GitHub repository",
        };
        Err(message.to_owned())
    }
}

fn selected(entries: Vec<Entry>, subpath: &str) -> Result<Vec<Entry>, String> {
    let prefix = format!("{subpath}/");
    let mut result = Vec::new();
    for mut entry in entries {
        if entry.kind != "blob" {
            continue;
        }
        let original = normalize_path(&entry.path);
        let relative = if subpath.is_empty() {
            original.as_str()
        } else if let Some(relative) = original.strip_prefix(&prefix) {
            relative
        } else {
            continue;
        };
        if !safe_relative(relative) || !note_file(relative) || relative.split('/').count() > 24 {
            continue;
        }
        entry.path = relative.to_owned();
        result.push(entry);
        if result.len() > 5000 {
            return Err(TOO_LARGE.to_owned());
        }
    }
    Ok(result)
}

fn fetch_remote(
    api: &impl Api,
    remote: &Remote,
    dir: &Path,
    cached: Option<&Cache>,
) -> Result<Cache, String> {
    let base = format!(
        "/repos/{}/{}",
        encoded(&remote.owner),
        encoded(&remote.repo)
    );
    let reference = match &remote.reference {
        Some(value) => value.clone(),
        None => api.get(&base)?["default_branch"]
            .as_str()
            .unwrap_or("main")
            .to_owned(),
    };
    let commit = api.get(&format!("{base}/commits/{}", encoded(&reference)))?;
    let sha = commit["commit"]["tree"]["sha"]
        .as_str()
        .filter(|s| !s.is_empty())
        .ok_or("Could not read that GitHub branch")?
        .to_owned();
    if let Some(cache) = cached.filter(|cache| cache.tree_sha == sha) {
        return Ok(Cache {
            tree_sha: sha,
            files: cache.files.clone(),
        });
    }
    let tree = api.get(&format!("{base}/git/trees/{}?recursive=1", encoded(&sha)))?;
    if tree["truncated"].as_bool().unwrap_or(false) {
        return Err(TOO_LARGE.to_owned());
    }
    let entries: Vec<Entry> = serde_json::from_value(tree["tree"].clone())
        .map_err(|_| "Could not read the GitHub repository tree".to_owned())?;
    let entries = selected(entries, remote.subpath.as_deref().unwrap_or(""))?;
    let next = AtomicUsize::new(0);
    let results = std::thread::scope(|scope| {
        let workers: Vec<_> = (0..entries.len().min(8))
            .map(|_| {
                let next = &next;
                let entries = &entries;
                let base = &base;
                scope.spawn(move || -> Result<Vec<(String, String)>, String> {
                    let mut out = Vec::new();
                    loop {
                        let index = next.fetch_add(1, Ordering::Relaxed);
                        let Some(entry) = entries.get(index) else {
                            break;
                        };
                        let blob_path =
                            cache_file(&dir.join("blobs"), &format!("{base}:{}", entry.sha));
                        let text = match fs::read_to_string(&blob_path) {
                            Ok(text) => text,
                            Err(_) => {
                                let blob =
                                    api.get(&format!("{base}/git/blobs/{}", encoded(&entry.sha)))?;
                                let content = blob["content"]
                                    .as_str()
                                    .ok_or("Could not read a GitHub note")?;
                                let text = if blob["encoding"].as_str().unwrap_or("base64")
                                    == "base64"
                                {
                                    let clean: String =
                                        content.chars().filter(|c| !c.is_whitespace()).collect();
                                    let bytes = STANDARD
                                        .decode(clean)
                                        .map_err(|_| "Invalid GitHub note encoding")?;
                                    String::from_utf8_lossy(&bytes).into_owned()
                                } else {
                                    content.to_owned()
                                };
                                // The complete remote cache below reports persistence failures to the UI.
                                let _ = atomic_write(&blob_path, text.as_bytes());
                                text
                            }
                        };
                        out.push((entry.path.clone(), text));
                    }
                    Ok(out)
                })
            })
            .collect();
        workers
            .into_iter()
            .map(|worker| {
                worker
                    .join()
                    .unwrap_or_else(|_| Err("GitHub sync worker failed".to_owned()))
            })
            .collect::<Result<Vec<_>, _>>()
    })?;
    Ok(Cache {
        tree_sha: sha,
        files: results.into_iter().flatten().collect(),
    })
}

fn label(remote: &Remote, used: &mut BTreeSet<String>) -> String {
    let leaf = remote
        .subpath
        .as_deref()
        .unwrap_or("")
        .rsplit('/')
        .next()
        .unwrap_or("");
    let base = if !leaf.is_empty() && leaf != remote.repo {
        format!("{}-{leaf}", remote.repo)
    } else {
        remote.repo.clone()
    };
    if used.insert(base.clone()) {
        return base;
    }
    let fallback = if remote.owner != base {
        format!("{}-{base}", remote.owner)
    } else {
        base
    };
    if used.insert(fallback.clone()) {
        return fallback;
    }
    for n in 2.. {
        let candidate = format!("{fallback}-{n}");
        if used.insert(candidate.clone()) {
            return candidate;
        }
    }
    unreachable!()
}

fn sync_with(
    api: &impl Api,
    remotes: &[Remote],
    cache_dir: &Path,
    used_labels: &[String],
) -> SyncResult {
    let mut result = SyncResult::default();
    let mut used: BTreeSet<String> = used_labels
        .iter()
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
        .collect();
    for remote in remotes {
        // Include the actual location, not a user-supplied ID, in cache identity.
        let key = serde_json::to_string(&(
            &remote.owner,
            &remote.repo,
            &remote.reference,
            &remote.subpath,
        ))
        .unwrap_or_default();
        let path = cache_file(cache_dir, &key);
        let cached = read_cache(&path);
        let loaded = match fetch_remote(api, remote, cache_dir, cached.as_ref()) {
            Ok(loaded) => {
                if cached
                    .as_ref()
                    .map_or(true, |cache| cache.tree_sha != loaded.tree_sha)
                {
                    if let Err(message) = serde_json::to_vec(&loaded)
                        .map_err(|e| e.to_string())
                        .and_then(|bytes| atomic_write(&path, &bytes))
                    {
                        result.errors.push(SyncError { id: remote.id.clone(), message: format!("Notes loaded, but their offline cache could not be saved: {message}") });
                    }
                }
                loaded
            }
            Err(message) => {
                result.errors.push(SyncError {
                    id: remote.id.clone(),
                    message,
                });
                cached.unwrap_or_default()
            }
        };
        // Reserve a stable label even when an offline remote has no cached notes.
        let root = label(remote, &mut used);
        let display = format!(
            "{}/{}{}",
            remote.owner,
            remote.repo,
            remote
                .subpath
                .as_ref()
                .map(|s| format!("/{s}"))
                .unwrap_or_default()
        );
        result.github_names.insert(root.clone(), display);
        for (relative, content) in loaded.files {
            if safe_relative(&relative) && note_file(&relative) {
                result.files.insert(format!("{root}/{relative}"), content);
            }
        }
    }
    result.github_files = result.files.keys().cloned().collect();
    result
}

pub fn sync(
    remotes: &[Remote],
    token: &str,
    cache_dir: &Path,
    used_labels: &[String],
) -> SyncResult {
    match Client::builder()
        .user_agent("notes-desk-rust")
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30))
        .build()
    {
        Ok(client) => sync_with(
            &GithubApi {
                client,
                token: normalize_token(token),
            },
            remotes,
            cache_dir,
            used_labels,
        ),
        Err(_) => {
            struct Offline;
            impl Api for Offline {
                fn get(&self, _: &str) -> Result<Value, String> {
                    Err("Could not initialize GitHub networking".to_owned())
                }
            }
            sync_with(&Offline, remotes, cache_dir, used_labels)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Mutex;

    struct Mock {
        tree: &'static str,
        offline: bool,
        calls: Mutex<Vec<String>>,
    }
    impl Api for Mock {
        fn get(&self, path: &str) -> Result<Value, String> {
            self.calls.lock().unwrap().push(path.to_owned());
            if self.offline {
                return Err("Offline".to_owned());
            }
            if path.contains("/commits/") {
                return Ok(json!({"commit":{"tree":{"sha":self.tree}}}));
            }
            if path.contains("/git/trees/") {
                return Ok(
                    json!({"tree":[{"path":"docs/note.md","type":"blob","sha":"same-blob"},{"path":"docs/.secret.md","type":"blob","sha":"secret"},{"path":"docs/node_modules/no.md","type":"blob","sha":"skip"}]}),
                );
            }
            if path.contains("/git/blobs/") {
                return Ok(json!({"content":"aGVsbG8=", "encoding":"base64"}));
            }
            Err(format!("Unexpected request: {path}"))
        }
    }
    fn remote() -> Remote {
        validate_remotes(vec![Remote {
            id: "".into(),
            url: "".into(),
            owner: "owner".into(),
            repo: "notes".into(),
            reference: Some("main".into()),
            subpath: Some("docs".into()),
        }])
        .unwrap()
        .remove(0)
    }
    #[test]
    fn cache_reuses_trees_and_blobs_and_survives_offline() {
        let dir = std::env::temp_dir().join(format!(
            "notes-github-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let remotes = [remote()];
        let api = Mock {
            tree: "tree1",
            offline: false,
            calls: Mutex::new(Vec::new()),
        };
        let first = sync_with(&api, &remotes, &dir, &["notes-docs".into()]);
        assert_eq!(
            first.files.get("owner-notes-docs/note.md").unwrap(),
            "hello"
        );
        assert!(first.errors.is_empty());
        assert_eq!(first.files.len(), 1);
        api.calls.lock().unwrap().clear();
        sync_with(&api, &remotes, &dir, &[]);
        assert_eq!(api.calls.lock().unwrap().len(), 1);
        let changed = Mock {
            tree: "tree2",
            offline: false,
            calls: Mutex::new(Vec::new()),
        };
        sync_with(&changed, &remotes, &dir, &[]);
        assert!(!changed
            .calls
            .lock()
            .unwrap()
            .iter()
            .any(|p| p.contains("/git/blobs/")));
        let offline = Mock {
            tree: "",
            offline: true,
            calls: Mutex::new(Vec::new()),
        };
        let fallback = sync_with(&offline, &remotes, &dir, &[]);
        assert_eq!(fallback.files.get("notes-docs/note.md").unwrap(), "hello");
        assert_eq!(fallback.errors[0].message, "Offline");
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn validates_paths_and_normalizes_tokens() {
        let mut bad = remote();
        bad.subpath = Some("../outside".into());
        assert!(validate_remotes(vec![bad]).is_err());
        assert_eq!(normalize_token(" Bearer \"ghp_ abc\" "), "ghp_abc");
        assert_eq!(encoded("branch/name"), "branch%2Fname");
    }
    #[test]
    fn enforces_file_limit() {
        let entries = (0..5001)
            .map(|n| Entry {
                path: format!("{n}.md"),
                kind: "blob".into(),
                sha: "x".into(),
            })
            .collect();
        assert_eq!(selected(entries, "").unwrap_err(), TOO_LARGE);
    }
}
