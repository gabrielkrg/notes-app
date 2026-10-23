use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    fs,
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    time::SystemTime,
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedNote {
    pub file: String,
    pub raw: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    pub file: String,
    pub data_url: String,
}
struct Cached {
    len: u64,
    modified: Option<SystemTime>,
    changed: Option<SystemTime>,
    raw: String,
}
pub struct Vault {
    roots: Vec<PathBuf>,
    labels: Vec<String>,
    default: Option<PathBuf>,
    cache: HashMap<PathBuf, Cached>,
}
type Result<T> = std::result::Result<T, String>;
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
fn extension(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|v| v.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
}
fn note(path: &str) -> bool {
    matches!(
        extension(path).as_str(),
        "md" | "txt" | "html" | "css" | "js"
    )
}
fn slug(name: &str) -> Result<String> {
    let mut out = String::new();
    let mut separator = false;
    for c in name.trim().to_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            if separator && !out.is_empty() {
                out.push('-');
            }
            out.push(c);
            separator = false;
        } else {
            separator = true;
        }
    }
    if out.is_empty() {
        Err("Name must contain letters or numbers".into())
    } else {
        Ok(out)
    }
}
fn yaml(s: &str) -> String {
    if s.contains([':', '#', '\n', '\r']) || s.trim() != s {
        serde_json::to_string(s).unwrap()
    } else {
        s.into()
    }
}
fn starter(kind: &str, title: &str) -> Result<String> {
    Ok(match kind {
    ""|"markdown"=>format!("---\ntitle: {}\nnav: {}\n---\n\n# {title}\n\n",yaml(title),yaml(title)),
    "text"=>format!("{title}\n\n"), "html"=>format!("<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <title>{title}</title>\n  </head>\n  <body>\n    <h1>{title}</h1>\n  </body>\n</html>\n"),
    "css"=>format!("/* {title} */\n"),"js"=>format!("// {title}\n"),_=>return Err("Unknown note type".into()) })
}
fn retitle(raw: &str, title: &str) -> String {
    let title = title.trim();
    let title = if title.is_empty() { "Untitled" } else { title };
    let mut prefix = String::new();
    let mut body = raw;
    if raw.starts_with("---\n") || raw.starts_with("---\r\n") {
        let delimiters = regex::Regex::new(r"(?m)^---\r?$").unwrap();
        if let Some(end) = delimiters.find_iter(raw).nth(1) {
            let mut front = raw[..end.start()].to_owned();
            for key in ["title", "nav"] {
                let re = regex::Regex::new(&format!(r"(?m)^{key}:.*$")).unwrap();
                let line = format!("{key}: {}", yaml(title));
                if re.is_match(&front) {
                    front = re.replace(&front, regex::NoExpand(&line)).into_owned();
                } else {
                    front.push_str(&format!("{line}\n"));
                }
            }
            prefix = format!("{front}{}", &raw[end.start()..end.end()]);
            body = &raw[end.end()..];
        };
    }
    let heading = regex::Regex::new(r"(?m)^#\s+[^\r\n]+$").unwrap();
    format!(
        "{prefix}{}",
        heading.replace(body, regex::NoExpand(&format!("# {title}")))
    )
}
/// Reject links in every existing component, including ancestors of attached roots.
fn no_symlinks(path: &Path) -> Result<()> {
    let mut cursor = PathBuf::new();
    for c in path.components() {
        cursor.push(c);
        match fs::symlink_metadata(&cursor) {
            Ok(m) if m.file_type().is_symlink() => {
                return Err("Symbolic links are not allowed in notes paths".into())
            }
            Ok(_) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(err(e)),
        }
    }
    Ok(())
}
fn absolute(path: &Path) -> Result<PathBuf> {
    let path = if path.is_absolute() {
        path.to_owned()
    } else {
        std::env::current_dir().map_err(err)?.join(path)
    };
    let mut out = PathBuf::new();
    for c in path.components() {
        match c {
            Component::CurDir => {}
            Component::ParentDir => {
                out.pop();
            }
            other => out.push(other),
        }
    }
    Ok(out)
}
fn atomic_write(path: &Path, raw: &str, overwrite: bool) -> Result<()> {
    let parent = path.parent().ok_or("Missing parent")?;
    no_symlinks(parent)?;
    fs::create_dir_all(parent).map_err(err)?;
    no_symlinks(path)?;
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(err)?;
    if let Ok(metadata) = fs::metadata(path) {
        temp.as_file()
            .set_permissions(metadata.permissions())
            .map_err(err)?;
    }
    temp.write_all(raw.as_bytes()).map_err(err)?;
    temp.as_file().sync_all().map_err(err)?;
    if overwrite {
        temp.persist(path).map_err(err)?;
    } else {
        temp.persist_noclobber(path).map_err(err)?;
    }
    Ok(())
}
impl Vault {
    pub fn new(roots: Vec<PathBuf>, default_root: Option<PathBuf>) -> Result<Self> {
        let mut vault = Self {
            roots: vec![],
            labels: vec![],
            default: None,
            cache: HashMap::new(),
        };
        vault.set_roots(roots)?;
        if let Some(root) = default_root {
            if let Ok(root) = absolute(&root) {
                if vault.roots.contains(&root) {
                    vault.default = Some(root);
                }
            }
        }
        Ok(vault)
    }
    pub fn roots(&self) -> Vec<String> {
        self.roots
            .iter()
            .map(|p| p.to_string_lossy().into_owned())
            .collect()
    }
    pub fn default_root(&self) -> String {
        self.default
            .as_ref()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_default()
    }
    pub fn set_default_root(&mut self, root: &str) -> Result<String> {
        let root = absolute(Path::new(root))?;
        if !self.roots.contains(&root) {
            return Err("Choose one of the attached notes folders".into());
        }
        self.default = Some(root);
        Ok(self.default_root())
    }
    pub fn set_roots(&mut self, roots: Vec<PathBuf>) -> Result<Vec<String>> {
        let mut accepted = vec![];
        let mut labels = vec![];
        let mut used = HashSet::new();
        for root in roots {
            let root = absolute(&root)?;
            no_symlinks(&root)?;
            if !root.is_dir() {
                return Err("Notes folder not found".into());
            }
            let home = std::env::var_os("HOME")
                .or_else(|| std::env::var_os("USERPROFILE"))
                .map(PathBuf::from);
            let broad = root.parent().is_none()
                || home.as_ref() == Some(&root)
                || home
                    .as_ref()
                    .and_then(|p| p.parent())
                    .map(|p| {
                        p == root
                            && matches!(
                                p.file_name()
                                    .and_then(|n| n.to_str())
                                    .unwrap_or("")
                                    .to_ascii_lowercase()
                                    .as_str(),
                                "home" | "users"
                            )
                    })
                    .unwrap_or(false);
            if broad {
                return Err(
                    "Choose a notes folder, not your home directory or an entire drive".into(),
                );
            }
            if accepted.contains(&root) {
                continue;
            }
            let mut paths = vec![];
            walk(&root, 0, &mut 0, &mut paths)?;
            let base = root.file_name().and_then(|n| n.to_str()).unwrap_or("notes");
            let mut label = base.to_owned();
            let mut n = 2;
            while used.contains(&label) {
                label = format!("{base}-{n}");
                n += 1;
            }
            used.insert(label.clone());
            labels.push(label);
            accepted.push(root);
        }
        self.default = self.default.take().filter(|p| accepted.contains(p));
        if accepted.len() == 1 {
            self.default = Some(accepted[0].clone());
        }
        self.roots = accepted;
        self.labels = labels;
        self.cache.clear();
        Ok(self.roots())
    }
    pub fn resolve(&self, file: &str) -> Result<PathBuf> {
        let normalized = file.replace('\\', "/");
        if normalized.starts_with('/')
            || normalized
                .split('/')
                .any(|p| p == ".." || p == "." || p.contains(':') || p.contains('\0'))
        {
            return Err("Path must stay inside the notes folder".into());
        }
        let mut parts = normalized.split('/');
        let label = parts.next().unwrap_or("");
        let index = self
            .labels
            .iter()
            .position(|s| s == label)
            .ok_or("Choose a notes folder first")?;
        let root = &self.roots[index];
        let mut path = root.clone();
        for part in parts {
            if !part.is_empty() {
                path.push(part);
            }
        }
        if !path.starts_with(root) {
            return Err("Path must stay inside the notes folder".into());
        }
        no_symlinks(&path)?;
        Ok(path)
    }
    pub fn snapshot(&mut self) -> Result<BTreeMap<String, String>> {
        let mut out = BTreeMap::new();
        let mut live = HashSet::new();
        for (root, label) in self.roots.iter().zip(&self.labels) {
            no_symlinks(root)?;
            let mut paths = vec![];
            walk(root, 0, &mut 0, &mut paths)?;
            for path in paths {
                let m = fs::metadata(&path).map_err(err)?;
                let modified = m.modified().ok();
                let changed = changed(&m);
                let stale = self
                    .cache
                    .get(&path)
                    .map(|c| c.len != m.len() || c.modified != modified || c.changed != changed)
                    .unwrap_or(true);
                if stale {
                    no_symlinks(&path)?;
                    let raw = String::from_utf8_lossy(&fs::read(&path).map_err(err)?).into_owned();
                    self.cache.insert(
                        path.clone(),
                        Cached {
                            len: m.len(),
                            modified,
                            changed,
                            raw,
                        },
                    );
                }
                let relative = path
                    .strip_prefix(root)
                    .map_err(err)?
                    .to_string_lossy()
                    .replace('\\', "/");
                out.insert(format!("{label}/{relative}"), self.cache[&path].raw.clone());
                live.insert(path);
            }
        }
        self.cache.retain(|p, _| live.contains(p));
        Ok(out)
    }
    pub fn write(&mut self, file: &str, content: &str) -> Result<()> {
        if !note(file) {
            return Err("Only markdown, text, HTML, CSS, and JS files can be saved".into());
        }
        let path = self.resolve(file)?;
        atomic_write(&path, content, true)?;
        self.cache.remove(&path);
        Ok(())
    }
    pub fn create(
        &mut self,
        parent: &str,
        name: &str,
        note_type: &str,
        folder: bool,
    ) -> Result<CreatedNote> {
        let kind = if folder {
            "markdown"
        } else if note_type.is_empty() {
            "markdown"
        } else {
            note_type
        };
        let ext = match kind {
            "markdown" => "md",
            "text" => "txt",
            "html" => "html",
            "css" => "css",
            "js" => "js",
            _ => return Err("Unknown note type".into()),
        };
        let parent = if parent.trim().is_empty() {
            let root = self.default.as_ref().ok_or("Choose a notes folder first")?;
            self.labels[self.roots.iter().position(|p| p == root).unwrap()].clone()
        } else {
            parent.trim().trim_end_matches('/').to_owned()
        };
        self.resolve(&parent)?;
        let make = |title: &str| -> Result<String> {
            let slug = slug(title)?;
            Ok(if folder {
                format!("{parent}/{slug}/index.md")
            } else {
                format!("{parent}/{slug}.{ext}")
            })
        };
        let mut title = name.trim().to_owned();
        if title.is_empty() {
            if folder {
                return Err("Name must contain letters or numbers".into());
            }
            for n in 1..10000 {
                let candidate = if n == 1 {
                    "Untitled".into()
                } else {
                    format!("Untitled {n}")
                };
                if !self.resolve(&make(&candidate)?)?.exists() {
                    title = candidate;
                    break;
                }
            }
            if title.is_empty() {
                return Err("Could not find an unused Untitled name".into());
            }
        }
        let file = make(&title)?;
        let path = self.resolve(&file)?;
        if path.exists() {
            return Err("A note with that name already exists".into());
        }
        let raw = starter(kind, &title)?;
        atomic_write(&path, &raw, false)?;
        Ok(CreatedNote { file, raw })
    }
    pub fn delete_note(&mut self, file: &str) -> Result<()> {
        if !note(file) {
            return Err("Only note files can be deleted".into());
        }
        let path = self.resolve(file)?;
        if !path.is_file() {
            return Err("Note not found".into());
        }
        fs::remove_file(&path).map_err(err)?;
        self.cache.remove(&path);
        Ok(())
    }
    pub fn delete_folder(
        &mut self,
        path: &str,
        confirm_name: &str,
        expected_names: &[String],
    ) -> Result<()> {
        let abs = self.resolve(path)?;
        if self.roots.contains(&abs) {
            return Err("Remove this folder in Settings instead".into());
        }
        let base = abs.file_name().and_then(|s| s.to_str()).unwrap_or("");
        let confirm = confirm_name.trim();
        let accepted = if expected_names.is_empty() {
            confirm == base
        } else {
            expected_names.iter().any(|n| n.trim() == confirm)
        };
        if confirm.is_empty() || !accepted {
            return Err("Type the folder name to confirm".into());
        }
        if !abs.is_dir() {
            return Err("Folder not found".into());
        }
        fs::remove_dir_all(&abs).map_err(err)?;
        self.cache.retain(|p, _| !p.starts_with(&abs));
        Ok(())
    }
    pub fn rename_note(&mut self, file: &str, name: &str) -> Result<String> {
        if !note(file) {
            return Err("Only note files can be renamed".into());
        }
        let from = self.resolve(file)?;
        if !from.is_file() {
            return Err("Note not found".into());
        }
        let normalized = file.replace('\\', "/");
        let parent = normalized.rsplit_once('/').ok_or("Invalid note path")?.0;
        let dest = format!("{parent}/{}.{}", slug(name)?, extension(file));
        let target = self.resolve(&dest)?;
        if from != target && target.exists() {
            return Err("A note with that name already exists".into());
        }
        let mut raw = fs::read_to_string(&from).map_err(err)?;
        if extension(file) == "md" {
            raw = retitle(&raw, name);
        }
        atomic_write(&target, &raw, from == target)?;
        if from != target {
            fs::remove_file(&from).map_err(err)?;
        }
        self.cache.remove(&from);
        self.cache.remove(&target);
        Ok(dest)
    }
    pub fn rename_folder(&mut self, path: &str, name: &str) -> Result<String> {
        let from = self.resolve(path)?;
        if self.roots.contains(&from) {
            return Err("Rename this folder in Settings instead".into());
        }
        if !from.is_dir() {
            return Err("Folder not found".into());
        }
        let normalized = path.replace('\\', "/");
        let parent = normalized
            .trim_end_matches('/')
            .rsplit_once('/')
            .ok_or("Invalid folder path")?
            .0;
        let dest = format!("{parent}/{}", slug(name)?);
        let target = self.resolve(&dest)?;
        if from != target && target.exists() {
            return Err("A folder with that name already exists".into());
        }
        let index = from.join("index.md");
        no_symlinks(&index)?;
        let raw = if index.is_file() {
            Some(retitle(&fs::read_to_string(&index).map_err(err)?, name))
        } else {
            None
        };
        if from != target {
            fs::rename(&from, &target).map_err(err)?;
        }
        if let Some(raw) = raw {
            if let Err(error) = atomic_write(&target.join("index.md"), &raw, true) {
                if from != target {
                    let _ = fs::rename(&target, &from);
                }
                return Err(error);
            }
        }
        self.cache
            .retain(|p, _| !p.starts_with(&from) && !p.starts_with(&target));
        Ok(dest)
    }
    pub fn read_asset(&self, file: &str) -> Result<Asset> {
        let mime = match extension(file).as_str() {
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "svg" => "image/svg+xml",
            "webp" => "image/webp",
            "ico" => "image/x-icon",
            _ => return Err("Only image assets can be read".into()),
        };
        let path = self.resolve(file)?;
        let handle = fs::File::open(&path).map_err(err)?;
        if !handle.metadata().map_err(err)?.is_file() {
            return Err("Asset not found".into());
        }
        let mut bytes = vec![];
        handle
            .take(5 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map_err(err)?;
        if bytes.len() > 5 * 1024 * 1024 {
            return Err("Image is larger than 5 MB".into());
        }
        Ok(Asset {
            file: file.replace('\\', "/"),
            data_url: format!("data:{mime};base64,{}", STANDARD.encode(bytes)),
        })
    }
}
#[cfg(unix)]
fn changed(m: &fs::Metadata) -> Option<SystemTime> {
    use std::os::unix::fs::MetadataExt;
    SystemTime::UNIX_EPOCH.checked_add(std::time::Duration::new(
        m.ctime().max(0) as u64,
        m.ctime_nsec().max(0) as u32,
    ))
}
#[cfg(not(unix))]
fn changed(m: &fs::Metadata) -> Option<SystemTime> {
    m.created().ok()
}
fn walk(dir: &Path, depth: usize, dirs: &mut usize, out: &mut Vec<PathBuf>) -> Result<()> {
    if depth > 24 {
        return Ok(());
    }
    *dirs += 1;
    if *dirs > 20_000 {
        return Err("That folder is too large to open as notes".into());
    }
    for entry in fs::read_dir(dir).map_err(err)? {
        let entry = entry.map_err(err)?;
        let name = entry.file_name();
        let name = name.to_string_lossy();
        let kind = entry.file_type().map_err(err)?;
        if name.starts_with('.') || kind.is_symlink() {
            continue;
        }
        if kind.is_dir() {
            if !matches!(
                name.as_ref(),
                "node_modules"
                    | "dist"
                    | "build"
                    | "out"
                    | "target"
                    | "vendor"
                    | "__pycache__"
                    | "venv"
            ) {
                walk(&entry.path(), depth + 1, dirs, out)?;
            }
        } else if kind.is_file() && note(&name) {
            out.push(entry.path());
            if out.len() > 5000 {
                return Err("That folder is too large to open as notes".into());
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> (tempfile::TempDir, Vault, String) {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("notes");
        fs::create_dir(&root).unwrap();
        let vault = Vault::new(vec![root], None).unwrap();
        (temp, vault, "notes".into())
    }
    #[test]
    fn full_local_roundtrip() {
        let (_temp, mut vault, label) = fixture();
        for kind in ["markdown", "text", "html", "css", "js"] {
            let created = vault.create("", kind, kind, false).unwrap();
            assert!(vault.snapshot().unwrap().contains_key(&created.file));
            vault.write(&created.file, "updated").unwrap();
            assert_eq!(vault.snapshot().unwrap()[&created.file], "updated");
            let renamed = vault
                .rename_note(&created.file, &format!("new {kind}"))
                .unwrap();
            vault.delete_note(&renamed).unwrap();
        }
        let folder = vault.create("", "My Folder", "", true).unwrap();
        assert_eq!(folder.file, format!("{label}/my-folder/index.md"));
        let renamed = vault.rename_folder("notes/my-folder", "Renamed").unwrap();
        assert!(vault.snapshot().unwrap()["notes/renamed/index.md"].contains("title: Renamed"));
        assert!(vault.delete_folder(&renamed, "wrong", &[]).is_err());
        vault
            .delete_folder(&renamed, "Renamed", &["Renamed".into()])
            .unwrap();
        assert!(vault.snapshot().unwrap().is_empty());
    }
    #[test]
    fn safety_and_hidden_files() {
        let (temp, mut vault, _) = fixture();
        assert!(vault.resolve("notes/../escape.md").is_err());
        assert!(vault.resolve("/notes/file.md").is_err());
        assert!(vault.resolve("notes/C:/file.md").is_err());
        assert!(vault.delete_folder("notes", "notes", &[]).is_err());
        assert!(vault.rename_folder("notes", "new").is_err());
        fs::write(temp.path().join("notes/.hidden.md"), "secret").unwrap();
        fs::create_dir(temp.path().join("notes/node_modules")).unwrap();
        fs::write(temp.path().join("notes/node_modules/a.md"), "dependency").unwrap();
        assert!(vault.snapshot().unwrap().is_empty());
        assert!(Vault::new(vec![PathBuf::from("/")], None).is_err());
    }
    #[test]
    fn duplicate_labels_and_metadata_refresh() {
        let temp = tempfile::tempdir().unwrap();
        let a = temp.path().join("a/notes");
        let b = temp.path().join("b/notes");
        fs::create_dir_all(&a).unwrap();
        fs::create_dir_all(&b).unwrap();
        fs::write(a.join("a.md"), "a").unwrap();
        fs::write(b.join("a.md"), "b").unwrap();
        let mut vault = Vault::new(vec![a.clone(), b], None).unwrap();
        assert_eq!(vault.default_root(), "");
        assert!(vault.create("", "No default", "", false).is_err());
        assert_eq!(vault.snapshot().unwrap()["notes-2/a.md"], "b");
        fs::write(a.join("a.md"), "external change").unwrap();
        assert_eq!(vault.snapshot().unwrap()["notes/a.md"], "external change");
    }
    #[test]
    fn untitled_assets_and_retitle() {
        let (temp, mut vault, _) = fixture();
        assert_eq!(
            vault.create("", "", "", false).unwrap().file,
            "notes/untitled.md"
        );
        assert_eq!(
            vault.create("", "", "", false).unwrap().file,
            "notes/untitled-2.md"
        );
        fs::write(temp.path().join("notes/pic.png"), [1, 2, 3]).unwrap();
        assert_eq!(
            vault.read_asset("notes/pic.png").unwrap().data_url,
            "data:image/png;base64,AQID"
        );
        assert!(vault.read_asset("notes/untitled.md").is_err());
        let raw = retitle("---\nother: kept\n---\n\n# Old\n\n# Second\n", "New: title");
        assert!(raw.contains("title: \"New: title\""));
        assert!(raw.contains("# Second"));
    }
    #[cfg(unix)]
    #[test]
    fn rejects_symlink_escape_and_symlink_ancestors() {
        use std::os::unix::fs::symlink;
        let (temp, mut vault, _) = fixture();
        let outside = temp.path().join("outside");
        fs::create_dir(&outside).unwrap();
        fs::write(outside.join("secret.md"), "secret").unwrap();
        symlink(&outside, temp.path().join("notes/link")).unwrap();
        assert!(vault.resolve("notes/link/secret.md").is_err());
        assert!(vault.write("notes/link/new.md", "bad").is_err());
        assert!(vault.snapshot().unwrap().is_empty());
        symlink(temp.path().join("notes"), temp.path().join("alias")).unwrap();
        assert!(Vault::new(vec![temp.path().join("alias")], None).is_err());
        assert!(Vault::new(vec![temp.path().join("alias/link")], None).is_err());
    }
}
