//! Cached, literal substring search. Trigrams select candidates; exact checks
//! preserve punctuation, partial words, and the original app's search semantics.
use regex::Regex;
use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::hash::{Hash, Hasher};
use std::sync::LazyLock;

const MAX_RESULTS: usize = 200;
const SNIPPET_RADIUS: usize = 42;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileHit {
    pub file: String,
    pub route: String,
    pub title: String,
    pub nav_label: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct ContentHit {
    pub file: String,
    pub route: String,
    pub title: String,
    pub snippet: String,
}

#[derive(Debug, Default, Serialize)]
pub struct SearchResults {
    pub files: Vec<FileHit>,
    pub contents: Vec<ContentHit>,
}

struct Note {
    fingerprint: u64,
    hit: FileHit,
    metadata: [String; 4],
    body: String,
    lower_body: String,
}

#[derive(Default)]
pub struct SearchIndex {
    notes: Vec<Note>,
    postings: HashMap<[u8; 3], Vec<usize>>,
}

impl SearchIndex {
    pub fn from_snapshot(snapshot: &BTreeMap<String, String>) -> Self {
        let notes: Vec<_> = snapshot
            .iter()
            .map(|(file, raw)| parse_note(file, raw))
            .collect();
        let mut postings: HashMap<[u8; 3], Vec<usize>> = HashMap::new();
        let mut seen = HashSet::new();
        for (id, note) in notes.iter().enumerate() {
            seen.clear();
            for text in note
                .metadata
                .iter()
                .chain(std::iter::once(&note.lower_body))
            {
                for chunk in text.as_bytes().windows(3) {
                    let gram = [chunk[0], chunk[1], chunk[2]];
                    if seen.insert(gram) {
                        postings.entry(gram).or_default().push(id);
                    }
                }
            }
        }
        Self { notes, postings }
    }

    pub fn rebuild(&mut self, snapshot: &BTreeMap<String, String>) {
        *self = Self::from_snapshot(snapshot);
    }

    /// Refresh changed documents without reparsing/reindexing unchanged bodies.
    /// Structural edits rebuild because posting IDs follow sorted file order.
    pub fn update(&mut self, snapshot: &BTreeMap<String, String>) {
        if self.notes.len() != snapshot.len()
            || self
                .notes
                .iter()
                .zip(snapshot.keys())
                .any(|(note, file)| note.hit.file != *file)
        {
            self.rebuild(snapshot);
            return;
        }
        for (id, (file, raw)) in snapshot.iter().enumerate() {
            if self.notes[id].fingerprint == fingerprint(raw) {
                continue;
            }
            let next = parse_note(file, raw);
            let old_grams = note_grams(&self.notes[id]);
            let new_grams = note_grams(&next);
            for gram in old_grams.difference(&new_grams) {
                let empty = if let Some(posting) = self.postings.get_mut(gram) {
                    if let Ok(position) = posting.binary_search(&id) {
                        posting.remove(position);
                    }
                    posting.is_empty()
                } else {
                    false
                };
                if empty {
                    self.postings.remove(gram);
                }
            }
            for gram in new_grams.difference(&old_grams) {
                let posting = self.postings.entry(*gram).or_default();
                if let Err(position) = posting.binary_search(&id) {
                    posting.insert(position, id);
                }
            }
            self.notes[id] = next;
        }
    }

    pub fn search(&self, query: &str, limit: usize) -> SearchResults {
        let limit = limit.min(MAX_RESULTS);
        let mut results = SearchResults::default();
        if limit == 0 {
            return results;
        }
        // Match JavaScript's minimum length, including a single emoji (two UTF-16 units).
        let search_body = query.trim().encode_utf16().count() >= 2;
        let needle = query.trim().to_lowercase();
        // Any matching note must contain every query trigram. Starting with the
        // rarest posting keeps absent/rare queries independent of corpus size.
        let mut candidates: Option<&Vec<usize>> = None;
        for chunk in needle.as_bytes().windows(3) {
            let Some(posting) = self.postings.get(&[chunk[0], chunk[1], chunk[2]]) else {
                return results;
            };
            if candidates.map_or(true, |current| posting.len() < current.len()) {
                candidates = Some(posting);
            }
        }
        let count = candidates.map_or(self.notes.len(), Vec::len);
        for offset in 0..count {
            let id = candidates.map_or(offset, |posting| posting[offset]);
            let note = &self.notes[id];
            if results.files.len() < limit
                && note.metadata.iter().any(|part| part.contains(&needle))
            {
                results.files.push(note.hit.clone());
            }
            if search_body && results.contents.len() < limit {
                if let Some(at) = note.lower_body.find(&needle) {
                    results.contents.push(ContentHit {
                        file: note.hit.file.clone(),
                        route: note.hit.route.clone(),
                        title: note.hit.nav_label.clone(),
                        snippet: snippet(&note.body, at, needle.len()),
                    });
                }
            }
            if results.files.len() >= limit && (!search_body || results.contents.len() >= limit) {
                break;
            }
        }
        results
    }
}

fn fingerprint(raw: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    raw.hash(&mut hasher);
    hasher.finish()
}

fn note_grams(note: &Note) -> HashSet<[u8; 3]> {
    note.metadata
        .iter()
        .chain(std::iter::once(&note.lower_body))
        .flat_map(|text| {
            text.as_bytes()
                .windows(3)
                .map(|chunk| [chunk[0], chunk[1], chunk[2]])
        })
        .collect()
}

static FRONTMATTER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\A---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)\z").unwrap());
static PAIR: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^([A-Za-z][\w-]*)\s*:\s*(.*)$").unwrap());
static INTEGER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^-?\d+$").unwrap());
static HEADING: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?m)^#\s+(.+)$").unwrap());
static HTML_TITLE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?is)<title[^>]*>(.*?)</title>").unwrap());
static HTML_H1: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?is)<h1[^>]*>(.*?)</h1>").unwrap());
static TAGS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"<[^>]+>").unwrap());

fn parse_note(file: &str, raw: &str) -> Note {
    let ext = file.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
    let uses_meta = !matches!(ext.as_str(), "html" | "css" | "js");
    let mut title_meta = String::new();
    let mut nav_meta = String::new();
    let mut body = raw;
    if uses_meta {
        if let Some(captures) = FRONTMATTER.captures(raw) {
            body = captures.get(2).unwrap().as_str();
            for line in captures[1].lines() {
                let Some(pair) = PAIR.captures(line) else {
                    continue;
                };
                let value = pair[2].trim();
                let value = if value.len() >= 2
                    && ((value.starts_with('"') && value.ends_with('"'))
                        || (value.starts_with('\'') && value.ends_with('\'')))
                {
                    &value[1..value.len() - 1]
                } else {
                    value
                };
                // The source parser converts even quoted integers to numbers;
                // numeric frontmatter is not a string title/nav label.
                let value = if INTEGER.is_match(value) { "" } else { value };
                match &pair[1] {
                    "title" => title_meta = value.to_owned(),
                    "nav" => nav_meta = value.to_owned(),
                    _ => {}
                }
            }
        }
    }
    let basename = file.rsplit('/').next().unwrap_or(file);
    let fallback = if uses_meta {
        basename.to_owned()
    } else {
        label_from_file(basename)
    };
    let title = if ext == "html" {
        [&*HTML_TITLE, &*HTML_H1]
            .into_iter()
            .find_map(|re| {
                let captures = re.captures(raw)?;
                let text = TAGS.replace_all(&captures[1], "").trim().to_owned();
                (!text.is_empty()).then_some(text)
            })
            .unwrap_or(fallback)
    } else if !title_meta.is_empty() {
        title_meta.clone()
    } else {
        HEADING
            .captures(body)
            .map(|captures| captures[1].trim().to_owned())
            .unwrap_or(fallback)
    };
    let nav_label = if !nav_meta.is_empty() {
        nav_meta
    } else if !title_meta.is_empty() {
        title_meta
    } else {
        title.clone()
    };
    let mut route = file.to_owned();
    if matches!(ext.as_str(), "md" | "txt" | "html" | "css" | "js") {
        route.truncate(route.len() - ext.len() - 1);
    }
    if route.to_ascii_lowercase().ends_with("/index") {
        route.truncate(route.len() - 6);
    }
    Note {
        fingerprint: fingerprint(raw),
        metadata: [
            title.to_lowercase(),
            nav_label.to_lowercase(),
            route.to_lowercase(),
            file.to_lowercase(),
        ],
        hit: FileHit {
            file: file.to_owned(),
            route,
            title,
            nav_label,
        },
        body: body.to_owned(),
        lower_body: body.to_lowercase(),
    }
}

fn label_from_file(file: &str) -> String {
    let stem = file.rsplit_once('.').map_or(file, |(stem, _)| stem);
    let mut start = true;
    stem.chars()
        .map(|ch| {
            let ch = if matches!(ch, '-' | '_') { ' ' } else { ch };
            let result = if start && ch.is_ascii_alphanumeric() {
                ch.to_ascii_uppercase()
            } else {
                ch
            };
            start = !ch.is_ascii_alphanumeric() && ch != '_';
            result
        })
        .collect()
}

fn snippet(body: &str, lower_start: usize, lower_len: usize) -> String {
    if body.is_ascii() {
        let from = lower_start.saturating_sub(SNIPPET_RADIUS);
        let to = (lower_start + lower_len + SNIPPET_RADIUS).min(body.len());
        return compact_snippet(&body[from..to], from > 0, to < body.len());
    }
    // Lowercasing can expand characters (İ -> i + combining dot). Convert
    // lowercase byte offsets back to original character positions before slicing.
    let mut lower_offset = 0;
    let mut start = 0;
    let mut end = body.len();
    for (byte, ch) in body.char_indices() {
        let width: usize = ch.to_lowercase().map(char::len_utf8).sum();
        if lower_offset <= lower_start && lower_start < lower_offset + width {
            start = byte;
        }
        lower_offset += width;
        if lower_offset >= lower_start + lower_len {
            end = byte + ch.len_utf8();
            break;
        }
    }
    let from = body[..start]
        .char_indices()
        .rev()
        .nth(SNIPPET_RADIUS - 1)
        .map_or(0, |(byte, _)| byte);
    let to = body[end..]
        .char_indices()
        .nth(SNIPPET_RADIUS)
        .map_or(body.len(), |(byte, _)| end + byte);
    compact_snippet(&body[from..to], from > 0, to < body.len())
}

fn compact_snippet(text: &str, before: bool, after: bool) -> String {
    let compact = text.split_whitespace().collect::<Vec<_>>().join(" ");
    format!(
        "{}{}{}",
        if before { "…" } else { "" },
        compact,
        if after { "…" } else { "" }
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn index(files: &[(&str, &str)]) -> SearchIndex {
        SearchIndex::from_snapshot(
            &files
                .iter()
                .map(|(file, raw)| (file.to_string(), raw.to_string()))
                .collect(),
        )
    }

    #[test]
    fn metadata_frontmatter_routes_and_html_match_source() {
        let index = index(&[
            (
                "topic/index.md",
                "---\ntitle: Heading\nnav: Custom Label\n---\n\n# Another\nBody needle.",
            ),
            (
                "web-page.html",
                "<title><b>HTML Name</b></title><h1>Other</h1>",
            ),
            ("plain.txt", "---\ntitle: 123\n---\ntext"),
        ]);
        let result = index.search(" custom ", 30);
        assert_eq!(result.files.len(), 1);
        assert_eq!(result.files[0].route, "topic");
        assert_eq!(result.files[0].title, "Heading");
        assert!(result.contents.is_empty());
        assert_eq!(index.search("needle", 30).contents[0].title, "Custom Label");
        assert_eq!(index.search("HTML Name", 30).files[0].title, "HTML Name");
        assert_eq!(index.search("plain", 30).files[0].title, "plain.txt");
        assert!(index.search("title:", 30).contents.is_empty());
    }

    #[test]
    fn substring_limits_short_queries_and_unicode_snippets() {
        let index = index(&[
            (
                "a.md",
                "# Alpha\nπππ İSTANBUL café 東京 😀 phrase. a-b-c abcd",
            ),
            ("b.md", "# Beta\nphrase"),
            ("c.md", "# Gamma\nabc x bcd"),
        ]);
        assert!(index.search("a", 30).contents.is_empty());
        assert_eq!(index.search("PH", 30).contents.len(), 2);
        assert_eq!(index.search("東京", 30).contents.len(), 1);
        assert_eq!(index.search("😀", 30).contents.len(), 1);
        assert!(index.search("İ", 30).contents.is_empty());
        assert!(index.search("i\u{307}stan", 30).contents[0]
            .snippet
            .contains("İSTANBUL"));
        assert_eq!(index.search("abcd", 30).contents.len(), 1);
        assert_eq!(index.search("phrase", 1).contents.len(), 1);
        assert!(index.search("phrase", 0).contents.is_empty());
        assert_eq!(index.search("", 1).files.len(), 1);
        assert!(index.search("completely absent", 30).contents.is_empty());
    }

    #[test]
    fn indexed_results_equal_brute_force_and_rebuild_drops_stale_notes() {
        let snapshot: BTreeMap<_, _> = (0..200)
            .map(|id| {
                (
                    format!("{id:03}.md"),
                    format!(
                        "# Note {id}\nSome words {} punctuation:a-b and café 東京.",
                        id % 17
                    ),
                )
            })
            .collect();
        let mut index = SearchIndex::from_snapshot(&snapshot);
        for query in [
            "words",
            "16",
            "a-b",
            "afé",
            "東京",
            "nomatch",
            "Note 19",
            "punctuation:",
        ] {
            let expected: Vec<_> = index
                .notes
                .iter()
                .filter(|note| note.lower_body.contains(&query.to_lowercase()))
                .take(30)
                .map(|note| note.hit.file.clone())
                .collect();
            let actual: Vec<_> = index
                .search(query, 30)
                .contents
                .into_iter()
                .map(|hit| hit.file)
                .collect();
            assert_eq!(actual, expected, "query {query}");
        }
        index.rebuild(&BTreeMap::new());
        assert!(index.search("words", 30).contents.is_empty());
    }

    #[test]
    fn snippets_map_expanding_lowercase_offsets_and_clip_unicode_safely() {
        let body = format!("{} İSTANBUL {}", "界😀".repeat(60), "é".repeat(100));
        let needle = "i\u{307}stanbul";
        let lower = body.to_lowercase();
        let found = snippet(&body, lower.find(needle).unwrap(), needle.len());
        assert!(found.starts_with('…'));
        assert!(found.ends_with('…'));
        assert!(found.contains("İSTANBUL"));
        assert!(found.chars().count() <= 2 * SNIPPET_RADIUS + 10);
    }

    #[test]
    fn incremental_update_refreshes_only_changed_notes_and_maintains_sorted_postings() {
        let mut snapshot: BTreeMap<String, String> = [
            ("a.md".into(), "# Unchanged\nshared".into()),
            ("b.md".into(), "# Before\nold-needle shared".into()),
            ("c.md".into(), "# Last\nnew-needle shared".into()),
        ]
        .into_iter()
        .collect();
        let mut index = SearchIndex::from_snapshot(&snapshot);
        let untouched_body = index.notes[0].body.as_ptr();
        snapshot.insert("b.md".into(), "# After\nnew-needle shared".into());
        index.update(&snapshot);
        assert_eq!(index.notes[0].body.as_ptr(), untouched_body);
        assert!(index.search("old-needle", 30).contents.is_empty());
        assert!(index.search("Before", 30).files.is_empty());
        assert_eq!(index.search("After", 30).files[0].file, "b.md");
        let files: Vec<_> = index
            .search("new-needle", 30)
            .contents
            .into_iter()
            .map(|hit| hit.file)
            .collect();
        assert_eq!(files, ["b.md", "c.md"]);
        assert!(index
            .postings
            .values()
            .all(|posting| posting.windows(2).all(|pair| pair[0] < pair[1])));
        snapshot.remove("a.md");
        snapshot.insert("d.md".into(), "# Added\nnew-needle".into());
        index.update(&snapshot);
        assert_eq!(index.search("new-needle", 30).contents.len(), 3);
        assert!(index.search("Unchanged", 30).files.is_empty());
    }

    #[test]
    #[ignore = "release benchmark: cargo test --release search_benchmark -- --ignored --nocapture"]
    fn search_benchmark() {
        use std::time::Instant;
        let snapshot: BTreeMap<_, _> = (0..5_000).map(|id| (format!("section/note-{id:05}.md"), format!("---\ntitle: Note {id}\n---\n# Notes\n{}\nUnique needle-{id:05} café 東京.", "Common documentation about performance, databases, Rust, and note taking. ".repeat(60)))).collect();
        let start = Instant::now();
        let mut index = SearchIndex::from_snapshot(&snapshot);
        println!(
            "5000 notes / {} body bytes; rebuild {:?}",
            snapshot.values().map(String::len).sum::<usize>(),
            start.elapsed()
        );
        let mut changed = snapshot.clone();
        let mut update_timings = Vec::new();
        for iteration in 0..30 {
            changed
                .get_mut("section/note-02500.md")
                .unwrap()
                .push_str(&format!("\nedit-{iteration}"));
            let start = Instant::now();
            index.update(&changed);
            update_timings.push(start.elapsed());
        }
        update_timings.sort_unstable();
        println!(
            "single note incremental update: p50 {:?}, p95 {:?}",
            update_timings[15], update_timings[28]
        );
        for query in [
            "needle-04999",
            "documentation",
            "absent-query",
            "東京",
            "zz",
            "da",
        ] {
            let mut timings = Vec::new();
            for _ in 0..150 {
                let start = Instant::now();
                std::hint::black_box(index.search(std::hint::black_box(query), 30));
                timings.push(start.elapsed());
            }
            timings.sort_unstable();
            println!(
                "query {query:?}: p50 {:?}, p95 {:?}",
                timings[75], timings[142]
            );
        }
    }
}
