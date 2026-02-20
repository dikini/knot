//! Link graph engine for bidirectional note linking.
//!
//! Maintains an in-memory directed graph of note links using petgraph,
//! and persists links/headings to the database.
//!
//! Also provides force-directed graph layout (Fruchterman-Reingold)
//! for visualization.
//!
//! SPEC: COMP-GRAPH-001 FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12

use std::collections::{HashMap, HashSet};

use petgraph::graph::{DiGraph, NodeIndex};
use petgraph::visit::EdgeRef;
use serde::{Deserialize, Serialize};

use crate::db::Database;
use crate::error::Result;
use crate::markdown::{Heading, Link, LinkKind};

// --- Graph layout types ---

/// A node in the graph layout with computed position.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    /// Note path (unique identifier).
    pub id: String,
    /// Display label (filename without extension).
    pub label: String,
    /// X coordinate.
    pub x: f64,
    /// Y coordinate.
    pub y: f64,
}

/// An edge in the graph layout.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    /// Source note path.
    pub source: String,
    /// Target note path.
    pub target: String,
}

/// Complete graph layout data for visualization.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphLayout {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

/// A link record as stored in the database, with source context.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteLink {
    /// Path of the note containing the link.
    pub source_path: String,
    /// Path or title of the link target.
    pub target: String,
    /// Display text of the link.
    pub display: String,
    /// The kind of link (wiki or markdown).
    pub link_type: LinkKind,
}

/// In-memory directed graph of note relationships.
pub struct LinkGraph {
    graph: DiGraph<String, LinkKind>,
    /// Map from note path to node index.
    node_map: HashMap<String, NodeIndex>,
}

impl Default for LinkGraph {
    fn default() -> Self {
        Self::new()
    }
}

impl LinkGraph {
    fn normalize_alias(value: &str) -> String {
        value
            .trim()
            .replace('\\', "/")
            .trim_start_matches("./")
            .to_lowercase()
    }

    fn strip_md(value: &str) -> &str {
        value.strip_suffix(".md").unwrap_or(value)
    }

    fn path_without_fragment(value: &str) -> &str {
        value.split('#').next().unwrap_or(value)
    }

    fn note_aliases(path: &str, title: Option<&str>) -> HashSet<String> {
        let mut aliases = HashSet::new();
        let normalized_path = Self::normalize_alias(path);
        aliases.insert(normalized_path.clone());

        aliases.insert(Self::normalize_alias(Self::strip_md(&normalized_path)));

        let filename = normalized_path.rsplit('/').next().unwrap_or(&normalized_path);
        aliases.insert(Self::normalize_alias(Self::strip_md(filename)));

        if let Some(title) = title {
            let title = title.trim();
            if !title.is_empty() {
                aliases.insert(Self::normalize_alias(title));
            }
        }

        aliases
    }

    fn target_aliases(target_path: &str) -> Vec<String> {
        let base = Self::normalize_alias(Self::path_without_fragment(target_path));
        if base.is_empty() {
            return Vec::new();
        }

        let mut aliases = Vec::new();
        aliases.push(base.clone());
        aliases.push(Self::normalize_alias(Self::strip_md(&base)));

        if !base.ends_with(".md") {
            aliases.push(format!("{base}.md"));
        }

        let filename = base.rsplit('/').next().unwrap_or(&base);
        aliases.push(Self::normalize_alias(Self::strip_md(filename)));

        let mut dedup = HashSet::new();
        aliases
            .into_iter()
            .filter(|alias| !alias.is_empty() && dedup.insert(alias.clone()))
            .collect()
    }

    pub fn new() -> Self {
        Self {
            graph: DiGraph::new(),
            node_map: HashMap::new(),
        }
    }

    /// SPEC: COMP-GRAPH-001 FR-1
    /// SPEC: COMP-GRAPH-CONSISTENCY-001 FR-1, FR-2
    /// TRACE: BUG-graph-consistency-selection-001
    /// Build the graph from all links in the database.
    pub fn build_from_db(db: &Database) -> Result<Self> {
        let mut lg = Self::new();

        let mut id_to_path = HashMap::<String, String>::new();
        let mut alias_counts = HashMap::<String, usize>::new();
        let mut alias_to_path = HashMap::<String, String>::new();

        let mut note_stmt = db
            .conn()
            .prepare("SELECT id, path, title FROM notes ORDER BY path")?;
        let note_rows = note_stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        })?;
        for note in note_rows {
            let (id, path, title) = note?;
            lg.ensure_node(&path);
            id_to_path.insert(id, path.clone());

            for alias in Self::note_aliases(&path, title.as_deref()) {
                *alias_counts.entry(alias).or_insert(0) += 1;
            }
        }

        for path in id_to_path.values() {
            for alias in Self::note_aliases(path, None) {
                if alias_counts.get(&alias).copied().unwrap_or(0) == 1 {
                    alias_to_path.entry(alias).or_insert_with(|| path.clone());
                }
            }
        }

        let mut title_stmt = db.conn().prepare("SELECT path, title FROM notes")?;
        let title_rows = title_stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
        })?;
        for row in title_rows {
            let (path, title) = row?;
            for alias in Self::note_aliases(&path, title.as_deref()) {
                if alias_counts.get(&alias).copied().unwrap_or(0) == 1 {
                    alias_to_path.entry(alias).or_insert_with(|| path.clone());
                }
            }
        }

        let mut stmt = db.conn().prepare(
            "SELECT src.path, l.target_note_id, l.target_path, l.link_type
             FROM links l
             JOIN notes src ON src.id = l.source_note_id
             WHERE l.target_path IS NOT NULL",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, String>(3)?,
            ))
        })?;

        for row in rows {
            let (source, target_note_id, target_path, kind) = row?;
            let link_kind = if kind == "wiki" {
                LinkKind::Wiki
            } else {
                LinkKind::Markdown
            };

            let resolved_target = target_note_id
                .as_deref()
                .and_then(|id| id_to_path.get(id))
                .cloned()
                .or_else(|| {
                    target_path.as_deref().and_then(|target| {
                        Self::target_aliases(target)
                            .into_iter()
                            .find_map(|alias| alias_to_path.get(&alias).cloned())
                    })
                });

            if let Some(target) = resolved_target {
                lg.add_edge(&source, &target, link_kind);
            }
        }

        Ok(lg)
    }

    /// Ensure a node exists for the given path, return its index.
    pub fn ensure_node(&mut self, path: &str) -> NodeIndex {
        if let Some(&idx) = self.node_map.get(path) {
            idx
        } else {
            let idx = self.graph.add_node(path.to_string());
            self.node_map.insert(path.to_string(), idx);
            idx
        }
    }

    /// Add a directed edge from source to target.
    fn add_edge(&mut self, source: &str, target: &str, kind: LinkKind) {
        let src = self.ensure_node(source);
        let tgt = self.ensure_node(target);
        self.graph.add_edge(src, tgt, kind);
    }

    /// Remove all outgoing edges from a node (used before re-parsing).
    fn remove_outgoing(&mut self, path: &str) {
        if let Some(&idx) = self.node_map.get(path) {
            let edges: Vec<_> = self.graph.edges(idx).map(|e| e.id()).collect();
            for edge in edges {
                self.graph.remove_edge(edge);
            }
        }
    }

    /// SPEC: COMP-GRAPH-001 FR-2
    /// Update the graph for a single note: remove old edges, add new ones.
    pub fn update_note(&mut self, source_path: &str, links: &[Link]) {
        self.remove_outgoing(source_path);
        for link in links {
            self.add_edge(source_path, &link.target, link.link_type.clone());
        }
    }

    /// SPEC: COMP-GRAPH-001 FR-3
    /// Remove a note and all its edges from the graph.
    pub fn remove_note(&mut self, path: &str) {
        if let Some(idx) = self.node_map.remove(path) {
            self.graph.remove_node(idx);
            // petgraph may swap indices on removal, rebuild map
            self.rebuild_node_map();
        }
    }

    /// Rebuild node_map from graph (needed after node removal due to index swaps).
    fn rebuild_node_map(&mut self) {
        self.node_map.clear();
        for idx in self.graph.node_indices() {
            if let Some(path) = self.graph.node_weight(idx) {
                self.node_map.insert(path.clone(), idx);
            }
        }
    }

    /// SPEC: COMP-GRAPH-001 FR-4
    /// Get all notes that link TO the given path (backlinks).
    pub fn get_backlinks(&self, path: &str) -> Vec<String> {
        let Some(&idx) = self.node_map.get(path) else {
            return Vec::new();
        };

        self.graph
            .neighbors_directed(idx, petgraph::Direction::Incoming)
            .filter_map(|n| self.graph.node_weight(n).cloned())
            .collect()
    }

    /// SPEC: COMP-GRAPH-001 FR-5
    /// Get all notes that the given path links TO (forward links).
    pub fn get_forward_links(&self, path: &str) -> Vec<String> {
        let Some(&idx) = self.node_map.get(path) else {
            return Vec::new();
        };

        self.graph
            .neighbors_directed(idx, petgraph::Direction::Outgoing)
            .filter_map(|n| self.graph.node_weight(n).cloned())
            .collect()
    }

    /// Get all note paths in the graph.
    pub fn all_nodes(&self) -> Vec<String> {
        self.graph
            .node_indices()
            .filter_map(|idx| self.graph.node_weight(idx).cloned())
            .collect()
    }

    /// Get the total number of nodes.
    pub fn node_count(&self) -> usize {
        self.graph.node_count()
    }

    /// Get the total number of edges.
    pub fn edge_count(&self) -> usize {
        self.graph.edge_count()
    }

    /// SPEC: COMP-GRAPH-001 FR-6
    /// Compute a force-directed layout using the Fruchterman-Reingold algorithm.
    ///
    /// Returns a `GraphLayout` with node positions in a coordinate space
    /// of approximately `width` x `height` pixels.
    pub fn compute_layout(&self, width: f64, height: f64) -> GraphLayout {
        let n = self.graph.node_count();
        if n == 0 {
            return GraphLayout {
                nodes: Vec::new(),
                edges: Vec::new(),
            };
        }

        let area = width * height;
        let k = (area / n as f64).sqrt(); // ideal distance between nodes

        // Collect node indices for stable iteration
        let indices: Vec<NodeIndex> = self.graph.node_indices().collect();

        // Initialize positions: spread nodes in a circle to avoid overlap
        let mut pos: Vec<[f64; 2]> = indices
            .iter()
            .enumerate()
            .map(|(i, _)| {
                let angle = 2.0 * std::f64::consts::PI * i as f64 / n as f64;
                let radius = k * (n as f64).sqrt() * 0.3;
                [
                    width / 2.0 + radius * angle.cos(),
                    height / 2.0 + radius * angle.sin(),
                ]
            })
            .collect();

        let iterations = 100;
        let mut temperature = width / 8.0;
        let cooling = temperature / iterations as f64;

        for _iter in 0..iterations {
            // Displacement accumulator
            let mut disp = vec![[0.0f64; 2]; n];

            // Repulsive forces between all pairs
            for i in 0..n {
                for j in (i + 1)..n {
                    let dx = pos[i][0] - pos[j][0];
                    let dy = pos[i][1] - pos[j][1];
                    let dist = (dx * dx + dy * dy).sqrt().max(0.01);
                    let force = (k * k) / dist; // repulsive force magnitude
                    let fx = (dx / dist) * force;
                    let fy = (dy / dist) * force;
                    disp[i][0] += fx;
                    disp[i][1] += fy;
                    disp[j][0] -= fx;
                    disp[j][1] -= fy;
                }
            }

            // Attractive forces along edges
            for edge in self.graph.edge_indices() {
                if let Some((src, tgt)) = self.graph.edge_endpoints(edge) {
                    let si = indices.iter().position(|&idx| idx == src);
                    let ti = indices.iter().position(|&idx| idx == tgt);
                    if let (Some(si), Some(ti)) = (si, ti) {
                        let dx = pos[si][0] - pos[ti][0];
                        let dy = pos[si][1] - pos[ti][1];
                        let dist = (dx * dx + dy * dy).sqrt().max(0.01);
                        let force = (dist * dist) / k; // attractive force
                        let fx = (dx / dist) * force;
                        let fy = (dy / dist) * force;
                        disp[si][0] -= fx;
                        disp[si][1] -= fy;
                        disp[ti][0] += fx;
                        disp[ti][1] += fy;
                    }
                }
            }

            // Apply displacements with temperature limiting
            for i in 0..n {
                let dx = disp[i][0];
                let dy = disp[i][1];
                let dist = (dx * dx + dy * dy).sqrt().max(0.01);
                let capped = dist.min(temperature);
                pos[i][0] += (dx / dist) * capped;
                pos[i][1] += (dy / dist) * capped;

                // Keep within bounds (with padding)
                let pad = 30.0;
                pos[i][0] = pos[i][0].clamp(pad, width - pad);
                pos[i][1] = pos[i][1].clamp(pad, height - pad);
            }

            temperature -= cooling;
            if temperature < 0.5 {
                break;
            }
        }

        // Build output
        let nodes: Vec<GraphNode> = indices
            .iter()
            .enumerate()
            .filter_map(|(i, &idx)| {
                let path = self.graph.node_weight(idx)?;
                let label = path
                    .rsplit('/')
                    .next()
                    .unwrap_or(path)
                    .trim_end_matches(".md")
                    .to_string();
                Some(GraphNode {
                    id: path.clone(),
                    label,
                    x: pos[i][0],
                    y: pos[i][1],
                })
            })
            .collect();

        let edges: Vec<GraphEdge> = self
            .graph
            .edge_indices()
            .filter_map(|edge| {
                let (src, tgt) = self.graph.edge_endpoints(edge)?;
                let source = self.graph.node_weight(src)?.clone();
                let target = self.graph.node_weight(tgt)?.clone();
                Some(GraphEdge { source, target })
            })
            .collect();

        GraphLayout { nodes, edges }
    }

    /// Build the graph from a vault database.
    pub fn from_vault(db: &Database) -> Result<Self> {
        Self::build_from_db(db)
    }

    /// Alias for compute_layout.
    pub fn layout(&self, width: f64, height: f64) -> GraphLayout {
        self.compute_layout(width, height)
    }

    /// SPEC: COMP-GRAPH-001 FR-7
    /// Get neighbors of a node up to a certain depth.
    pub fn neighbors(&self, path: &str, depth: usize) -> Vec<String> {
        if depth == 0 {
            return vec![];
        }

        let Some(&start_idx) = self.node_map.get(path) else {
            return vec![];
        };

        let mut visited = std::collections::HashSet::new();
        let mut current_level = vec![start_idx];
        let mut all_neighbors = vec![];

        for _ in 0..depth {
            let mut next_level = vec![];
            for idx in current_level {
                for neighbor in self.graph.neighbors(idx) {
                    if visited.insert(neighbor) && neighbor != start_idx {
                        if let Some(path) = self.graph.node_weight(neighbor) {
                            all_neighbors.push(path.clone());
                        }
                        next_level.push(neighbor);
                    }
                }
            }
            current_level = next_level;
        }

        all_neighbors
    }

    /// Get backlinks with context snippets.
    pub fn backlinks(&self, path: &str) -> Vec<(String, String)> {
        let sources = self.get_backlinks(path);
        sources.into_iter()
            .map(|source| (source.clone(), format!("Linked from {}", source)))
            .collect()
    }

    /// Get forward links with context.
    pub fn forward_links(&self, path: &str) -> Vec<(String, String)> {
        let targets = self.get_forward_links(path);
        targets.into_iter()
            .map(|target| (target.clone(), format!("Links to {}", target)))
            .collect()
    }
}

/// SPEC: COMP-GRAPH-001 FR-8
/// Persist links for a note to the database.
/// Deletes existing links for the source note, then inserts new ones.
pub fn save_links(db: &Database, note_id: &str, links: &[Link]) -> Result<()> {
    // Delete existing links for this source note
    db.conn()
        .execute("DELETE FROM links WHERE source_note_id = ?1", [note_id])?;

    let mut stmt = db.conn().prepare(
        "INSERT INTO links (source_note_id, target_path, link_text, link_type)
         VALUES (?1, ?2, ?3, ?4)",
    )?;

    for link in links {
        let kind = match link.link_type {
            LinkKind::Wiki => "wiki",
            LinkKind::Markdown => "markdown",
        };
        stmt.execute(rusqlite::params![note_id, link.target, link.display, kind])?;
    }

    // Try to resolve target_note_id for links that point to existing notes
    db.conn().execute(
        "UPDATE links SET target_note_id = (
            SELECT id FROM notes WHERE path = links.target_path
        )
        WHERE source_note_id = ?1 AND target_note_id IS NULL",
        [note_id],
    )?;

    Ok(())
}

/// SPEC: COMP-GRAPH-001 FR-9
/// Persist headings for a note to the database.
/// Deletes existing headings for the note, then inserts new ones.
pub fn save_headings(db: &Database, note_id: &str, headings: &[Heading]) -> Result<()> {
    db.conn()
        .execute("DELETE FROM headings WHERE note_id = ?1", [note_id])?;

    let mut stmt = db.conn().prepare(
        "INSERT INTO headings (note_id, level, text, anchor, position)
         VALUES (?1, ?2, ?3, ?4, ?5)",
    )?;

    for (i, heading) in headings.iter().enumerate() {
        stmt.execute(rusqlite::params![
            note_id,
            heading.level,
            heading.text,
            heading.anchor,
            i as i64
        ])?;
    }

    Ok(())
}

/// SPEC: COMP-GRAPH-001 FR-10
/// Load backlinks for a note path from the database.
pub fn load_backlinks(db: &Database, note_path: &str) -> Result<Vec<NoteLink>> {
    let mut stmt = db.conn().prepare(
        "SELECT n.path, l.target_path, l.link_text, l.link_type
         FROM links l
         JOIN notes n ON n.id = l.source_note_id
         WHERE l.target_path = ?1
         ORDER BY n.path",
    )?;

    let links = stmt
        .query_map([note_path], |row| {
            let kind: String = row.get(3)?;
            Ok(NoteLink {
                source_path: row.get(0)?,
                target: row.get(1)?,
                display: row.get(2)?,
                link_type: if kind == "wiki" {
                    LinkKind::Wiki
                } else {
                    LinkKind::Markdown
                },
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(links)
}

/// SPEC: COMP-GRAPH-001 FR-11
/// Load forward links for a note path from the database.
pub fn load_forward_links(db: &Database, note_path: &str) -> Result<Vec<NoteLink>> {
    let mut stmt = db.conn().prepare(
        "SELECT n.path, l.target_path, l.link_text, l.link_type
         FROM links l
         JOIN notes n ON n.id = l.source_note_id
         WHERE n.path = ?1
         ORDER BY l.target_path",
    )?;

    let links = stmt
        .query_map([note_path], |row| {
            let kind: String = row.get(3)?;
            Ok(NoteLink {
                source_path: row.get(0)?,
                target: row.get(1)?,
                display: row.get(2)?,
                link_type: if kind == "wiki" {
                    LinkKind::Wiki
                } else {
                    LinkKind::Markdown
                },
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(links)
}

/// SPEC: COMP-GRAPH-001 FR-12
/// Load headings for a note from the database.
pub fn load_headings(db: &Database, note_path: &str) -> Result<Vec<Heading>> {
    let mut stmt = db.conn().prepare(
        "SELECT h.level, h.text, h.anchor
         FROM headings h
         JOIN notes n ON n.id = h.note_id
         WHERE n.path = ?1
         ORDER BY h.position",
    )?;

    let headings = stmt
        .query_map([note_path], |row| {
            Ok(Heading {
                level: row.get(0)?,
                text: row.get(1)?,
                anchor: row.get(2)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(headings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn graph_add_and_query() {
        let mut g = LinkGraph::new();
        g.update_note(
            "a.md",
            &[
                Link {
                    target: "b.md".into(),
                    display: "B".into(),
                    link_type: LinkKind::Wiki,
                },
                Link {
                    target: "c.md".into(),
                    display: "C".into(),
                    link_type: LinkKind::Markdown,
                },
            ],
        );
        g.update_note(
            "b.md",
            &[Link {
                target: "a.md".into(),
                display: "A".into(),
                link_type: LinkKind::Wiki,
            }],
        );

        assert_eq!(g.node_count(), 3); // a, b, c
        assert_eq!(g.edge_count(), 3); // a->b, a->c, b->a

        let mut backlinks = g.get_backlinks("a.md");
        backlinks.sort();
        assert_eq!(backlinks, vec!["b.md"]);

        let mut forward = g.get_forward_links("a.md");
        forward.sort();
        assert_eq!(forward, vec!["b.md", "c.md"]);
    }

    #[test]
    fn graph_update_replaces_links() {
        let mut g = LinkGraph::new();
        g.update_note(
            "a.md",
            &[Link {
                target: "b.md".into(),
                display: "B".into(),
                link_type: LinkKind::Wiki,
            }],
        );
        assert_eq!(g.get_forward_links("a.md"), vec!["b.md"]);

        // Update: now a links to c instead of b
        g.update_note(
            "a.md",
            &[Link {
                target: "c.md".into(),
                display: "C".into(),
                link_type: LinkKind::Wiki,
            }],
        );
        assert_eq!(g.get_forward_links("a.md"), vec!["c.md"]);
        // b should no longer have backlinks from a
        assert!(g.get_backlinks("b.md").is_empty());
    }

    #[test]
    fn graph_remove_note() {
        let mut g = LinkGraph::new();
        g.update_note(
            "a.md",
            &[Link {
                target: "b.md".into(),
                display: "B".into(),
                link_type: LinkKind::Wiki,
            }],
        );
        g.update_note(
            "b.md",
            &[Link {
                target: "a.md".into(),
                display: "A".into(),
                link_type: LinkKind::Wiki,
            }],
        );

        g.remove_note("a.md");
        assert!(g.get_backlinks("a.md").is_empty());
        assert!(g.get_forward_links("a.md").is_empty());
        // b still exists
        assert_eq!(g.node_count(), 1);
    }

    #[test]
    fn graph_no_node_returns_empty() {
        let g = LinkGraph::new();
        assert!(g.get_backlinks("nonexistent.md").is_empty());
        assert!(g.get_forward_links("nonexistent.md").is_empty());
    }

    #[test]
    fn db_save_and_load_links() {
        let db = Database::open_in_memory().unwrap();

        // Insert a source note
        db.conn()
            .execute(
                "INSERT INTO notes (id, path, title, created_at, modified_at)
                 VALUES ('n1', 'source.md', 'Source', 0, 0)",
                [],
            )
            .unwrap();

        // Insert a target note
        db.conn()
            .execute(
                "INSERT INTO notes (id, path, title, created_at, modified_at)
                 VALUES ('n2', 'target.md', 'Target', 0, 0)",
                [],
            )
            .unwrap();

        let links = vec![
            Link {
                target: "target.md".into(),
                display: "Target".into(),
                link_type: LinkKind::Wiki,
            },
            Link {
                target: "unresolved.md".into(),
                display: "Missing".into(),
                link_type: LinkKind::Markdown,
            },
        ];

        save_links(&db, "n1", &links).unwrap();

        // Check forward links
        let forward = load_forward_links(&db, "source.md").unwrap();
        assert_eq!(forward.len(), 2);

        // Check backlinks to target
        let backlinks = load_backlinks(&db, "target.md").unwrap();
        assert_eq!(backlinks.len(), 1);
        assert_eq!(backlinks[0].source_path, "source.md");

        // Check that target_note_id was resolved for existing note
        let resolved: i32 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM links WHERE target_note_id IS NOT NULL",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(resolved, 1);
    }

    #[test]
    fn db_save_and_load_headings() {
        let db = Database::open_in_memory().unwrap();

        db.conn()
            .execute(
                "INSERT INTO notes (id, path, title, created_at, modified_at)
                 VALUES ('n1', 'test.md', 'Test', 0, 0)",
                [],
            )
            .unwrap();

        let headings = vec![
            Heading {
                level: 1,
                text: "Title".into(),
                anchor: "title".into(),
            },
            Heading {
                level: 2,
                text: "Section".into(),
                anchor: "section".into(),
            },
        ];

        save_headings(&db, "n1", &headings).unwrap();

        let loaded = load_headings(&db, "test.md").unwrap();
        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded[0].text, "Title");
        assert_eq!(loaded[1].text, "Section");
        assert_eq!(loaded[1].anchor, "section");
    }

    #[test]
    fn graph_build_from_db_includes_disconnected_notes_and_filters_dangling_edges() {
        let db = Database::open_in_memory().unwrap();

        db.conn()
            .execute(
                "INSERT INTO notes (id, path, title, created_at, modified_at)
                 VALUES ('n1', 'a.md', 'A', 0, 0)",
                [],
            )
            .unwrap();
        db.conn()
            .execute(
                "INSERT INTO notes (id, path, title, created_at, modified_at)
                 VALUES ('n2', 'b.md', 'B', 0, 0)",
                [],
            )
            .unwrap();
        db.conn()
            .execute(
                "INSERT INTO notes (id, path, title, created_at, modified_at)
                 VALUES ('n3', 'isolated.md', 'Isolated', 0, 0)",
                [],
            )
            .unwrap();

        db.conn()
            .execute(
                "INSERT INTO links (source_note_id, target_path, link_text, link_type)
                 VALUES ('n1', 'b.md', 'B', 'wiki')",
                [],
            )
            .unwrap();
        db.conn()
            .execute(
                "INSERT INTO links (source_note_id, target_path, link_text, link_type)
                 VALUES ('n2', 'missing.md', 'Missing', 'wiki')",
                [],
            )
            .unwrap();

        let graph = LinkGraph::build_from_db(&db).unwrap();
        let mut nodes = graph.all_nodes();
        nodes.sort();

        assert_eq!(nodes, vec!["a.md", "b.md", "isolated.md"]);
        assert_eq!(graph.edge_count(), 1);
        assert_eq!(graph.get_forward_links("a.md"), vec!["b.md"]);
        assert!(graph.get_forward_links("b.md").is_empty());
    }

    #[test]
    fn graph_build_from_db_resolves_extensionless_and_title_targets() {
        let db = Database::open_in_memory().unwrap();

        db.conn()
            .execute(
                "INSERT INTO notes (id, path, title, created_at, modified_at)
                 VALUES ('n1', 'source.md', 'Source', 0, 0)",
                [],
            )
            .unwrap();
        db.conn()
            .execute(
                "INSERT INTO notes (id, path, title, created_at, modified_at)
                 VALUES ('n2', 'rust.md', 'Rust', 0, 0)",
                [],
            )
            .unwrap();
        db.conn()
            .execute(
                "INSERT INTO notes (id, path, title, created_at, modified_at)
                 VALUES ('n3', 'bg/neural-networks.md', 'Невронни мрежи', 0, 0)",
                [],
            )
            .unwrap();

        db.conn()
            .execute(
                "INSERT INTO links (source_note_id, target_path, link_text, link_type)
                 VALUES ('n1', 'rust', 'rust', 'wiki')",
                [],
            )
            .unwrap();
        db.conn()
            .execute(
                "INSERT INTO links (source_note_id, target_path, link_text, link_type)
                 VALUES ('n1', 'Невронни мрежи', 'Невронни мрежи', 'wiki')",
                [],
            )
            .unwrap();

        let graph = LinkGraph::build_from_db(&db).unwrap();
        let mut forward = graph.get_forward_links("source.md");
        forward.sort();

        assert_eq!(forward, vec!["bg/neural-networks.md", "rust.md"]);
    }

    #[test]
    fn layout_empty_graph() {
        let g = LinkGraph::new();
        let layout = g.compute_layout(800.0, 600.0);
        assert!(layout.nodes.is_empty());
        assert!(layout.edges.is_empty());
    }

    #[test]
    fn layout_single_node() {
        let mut g = LinkGraph::new();
        g.ensure_node("only.md");
        let layout = g.compute_layout(800.0, 600.0);
        assert_eq!(layout.nodes.len(), 1);
        assert_eq!(layout.nodes[0].id, "only.md");
        assert_eq!(layout.nodes[0].label, "only");
        assert!(layout.edges.is_empty());
    }

    #[test]
    fn layout_produces_positions_in_bounds() {
        let mut g = LinkGraph::new();
        g.update_note(
            "a.md",
            &[
                Link {
                    target: "b.md".into(),
                    display: "B".into(),
                    link_type: LinkKind::Wiki,
                },
                Link {
                    target: "c.md".into(),
                    display: "C".into(),
                    link_type: LinkKind::Wiki,
                },
            ],
        );
        g.update_note(
            "b.md",
            &[Link {
                target: "c.md".into(),
                display: "C".into(),
                link_type: LinkKind::Wiki,
            }],
        );

        let w = 800.0;
        let h = 600.0;
        let layout = g.compute_layout(w, h);

        assert_eq!(layout.nodes.len(), 3);
        assert_eq!(layout.edges.len(), 3); // a->b, a->c, b->c

        for node in &layout.nodes {
            assert!(node.x >= 0.0 && node.x <= w, "x out of bounds: {}", node.x);
            assert!(node.y >= 0.0 && node.y <= h, "y out of bounds: {}", node.y);
        }
    }

    #[test]
    fn layout_label_strips_directory_and_extension() {
        let mut g = LinkGraph::new();
        g.ensure_node("Programming/rust.md");
        g.ensure_node("AI/neural-networks.md");

        let layout = g.compute_layout(800.0, 600.0);
        let labels: Vec<&str> = layout.nodes.iter().map(|n| n.label.as_str()).collect();
        assert!(labels.contains(&"rust"));
        assert!(labels.contains(&"neural-networks"));
    }

    #[test]
    fn layout_connected_nodes_closer_than_disconnected() {
        let mut g = LinkGraph::new();
        // a and b are connected, c is isolated
        g.update_note(
            "a.md",
            &[Link {
                target: "b.md".into(),
                display: "B".into(),
                link_type: LinkKind::Wiki,
            }],
        );
        g.update_note(
            "b.md",
            &[Link {
                target: "a.md".into(),
                display: "A".into(),
                link_type: LinkKind::Wiki,
            }],
        );
        g.ensure_node("c.md");

        let layout = g.compute_layout(800.0, 600.0);
        let pos: HashMap<&str, (f64, f64)> = layout
            .nodes
            .iter()
            .map(|n| (n.id.as_str(), (n.x, n.y)))
            .collect();

        let (ax, ay) = pos["a.md"];
        let (bx, by) = pos["b.md"];
        let (cx, cy) = pos["c.md"];

        let dist_ab = ((ax - bx).powi(2) + (ay - by).powi(2)).sqrt();
        let dist_ac = ((ax - cx).powi(2) + (ay - cy).powi(2)).sqrt();

        // Connected nodes should be closer to each other
        assert!(
            dist_ab < dist_ac,
            "connected a-b ({dist_ab:.1}) should be closer than disconnected a-c ({dist_ac:.1})"
        );
    }

    #[test]
    fn db_save_links_replaces_old() {
        let db = Database::open_in_memory().unwrap();

        db.conn()
            .execute(
                "INSERT INTO notes (id, path, title, created_at, modified_at)
                 VALUES ('n1', 'source.md', 'Source', 0, 0)",
                [],
            )
            .unwrap();

        let links_v1 = vec![Link {
            target: "old.md".into(),
            display: "Old".into(),
            link_type: LinkKind::Wiki,
        }];
        save_links(&db, "n1", &links_v1).unwrap();

        let links_v2 = vec![Link {
            target: "new.md".into(),
            display: "New".into(),
            link_type: LinkKind::Wiki,
        }];
        save_links(&db, "n1", &links_v2).unwrap();

        let forward = load_forward_links(&db, "source.md").unwrap();
        assert_eq!(forward.len(), 1);
        assert_eq!(forward[0].target, "new.md");
    }
}
