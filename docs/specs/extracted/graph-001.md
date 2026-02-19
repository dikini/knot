# Link Graph Engine

## Metadata
- ID: `COMP-GRAPH-001`
- Source: `extracted`
- Component: `graph`
- Depth: `standard`
- Extracted: `2026-02-19`
- Concerns: [CAP, REL]

## Source Reference
- Codebase: `src-tauri/src/`
- Entry Points:
  - `graph.rs` (LinkGraph, persistence functions)
  - `commands/notes.rs` (get_graph_layout command)
- Lines Analyzed: ~885

## Confidence Assessment
| Requirement | Confidence | Evidence | Needs Review |
|-------------|------------|----------|--------------|
| FR-1: Build graph from database | high | Implementation + tests | no |
| FR-2: Add/update note links | high | Implementation + tests | no |
| FR-3: Remove note from graph | high | Implementation + tests | no |
| FR-4: Get backlinks | high | Implementation + tests | no |
| FR-5: Get forward links | high | Implementation + tests | no |
| FR-6: Compute graph layout | high | Implementation + tests | no |
| FR-7: Get neighbors at depth | high | Implementation + tests | no |
| FR-8: Persist links to database | high | Implementation + tests | no |
| FR-9: Persist headings to database | high | Implementation + tests | no |
| FR-10: Load backlinks from database | high | Implementation + tests | no |

## Contract

### Functional Requirements

**FR-1**: Build link graph from database links
- Evidence: `graph.rs:85-114`, `graph.rs:347-349`, `graph.rs:85-114`
- Confidence: high
- Query: Joins `links` and `notes` tables
- Behavior: Creates nodes for all notes, edges for all links

**FR-2**: Update graph when note changes
- Evidence: `graph.rs:145-150`, test `graph_update_replaces_links`
- Confidence: high
- Behavior:
  - Removes old outgoing edges for the note
  - Adds new edges based on parsed links
- Note: Called during `save_note`

**FR-3**: Remove a note and all its edges from the graph
- Evidence: `graph.rs:153-159`, test `graph_remove_note`
- Confidence: high
- Behavior: Removes node, rebuilds node_map due to petgraph index swaps

**FR-4**: Get all notes that link TO a given note (backlinks)
- Evidence: `graph.rs:172-181`, test `graph_add_and_query`
- Confidence: high
- Returns: Vec of source note paths
- Direction: Incoming edges in directed graph

**FR-5**: Get all notes that a given note links TO (forward links)
- Evidence: `graph.rs:184-193`, test `graph_add_and_query`
- Confidence: high
- Returns: Vec of target note paths
- Direction: Outgoing edges in directed graph

**FR-6**: Compute force-directed graph layout
- Evidence: `graph.rs:217-344`, tests `layout_empty_graph`, `layout_single_node`, etc.
- Confidence: high
- Algorithm: Fruchterman-Reingold force-directed layout
- Parameters: `width: f64`, `height: f64` - canvas dimensions
- Iterations: 100 with cooling schedule
- Forces: Repulsive (node-node), Attractive (edge-connected nodes)
- Returns: `GraphLayout { nodes, edges }` with x,y positions

**FR-7**: Get neighbors at a specified depth
- Evidence: `graph.rs:357-386`, test `layout_connected_nodes_closer_than_disconnected`
- Confidence: high
- Parameters: `path: &str`, `depth: usize`
- Returns: Vec of neighbor note paths (excluding start node)
- Behavior: BFS traversal up to depth levels

**FR-8**: Persist links to database
- Evidence: `graph.rs:407-435`, test `db_save_and_load_links`
- Confidence: high
- Behavior:
  - Deletes existing links for source note
  - Inserts new links
  - Resolves target_note_id for existing target notes

**FR-9**: Persist headings to database
- Evidence: `graph.rs:439-459`, test `db_save_and_load_headings`
- Confidence: high
- Behavior:
  - Deletes existing headings for note
  - Inserts new headings with position

**FR-10**: Load backlinks from database
- Evidence: `graph.rs:462-489`, test `db_save_and_load_links`
- Confidence: high
- Returns: Vec of `NoteLink` with source, target, display text, link type

**FR-11**: Load forward links from database
- Evidence: `graph.rs:492-519`
- Confidence: high
- Returns: Vec of `NoteLink`

**FR-12**: Load headings from database
- Evidence: `graph.rs:522-543`, test `db_save_and_load_headings`
- Confidence: high
- Returns: Vec of `Heading` structs

### Interface (Rust)

```rust
/// A node in the graph layout with computed position.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub x: f64,
    pub y: f64,
}

/// An edge in the graph layout.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
}

/// Complete graph layout data for visualization.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphLayout {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

/// A link record as stored in the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteLink {
    pub source_path: String,
    pub target: String,
    pub display: String,
    pub link_type: LinkKind,
}

/// In-memory directed graph of note relationships.
pub struct LinkGraph {
    graph: DiGraph<String, LinkKind>,
    node_map: HashMap<String, NodeIndex>,
}

impl LinkGraph {
    pub fn new() -> Self;
    pub fn build_from_db(db: &Database) -> Result<Self>;
    pub fn from_vault(db: &Database) -> Result<Self>;
    pub fn ensure_node(&mut self, path: &str) -> NodeIndex;
    pub fn update_note(&mut self, source_path: &str, links: &[Link]);
    pub fn remove_note(&mut self, path: &str);
    pub fn get_backlinks(&self, path: &str) -> Vec<String>;
    pub fn get_forward_links(&self, path: &str) -> Vec<String>;
    pub fn all_nodes(&self) -> Vec<String>;
    pub fn node_count(&self) -> usize;
    pub fn edge_count(&self) -> usize;
    pub fn compute_layout(&self, width: f64, height: f64) -> GraphLayout;
    pub fn layout(&self, width: f64, height: f64) -> GraphLayout; // alias
    pub fn neighbors(&self, path: &str, depth: usize) -> Vec<String>;
    pub fn backlinks(&self, path: &str) -> Vec<(String, String)>; // with context
    pub fn forward_links(&self, path: &str) -> Vec<(String, String)>;
}

// Persistence functions
pub fn save_links(db: &Database, note_id: &str, links: &[Link]) -> Result<()>;
pub fn save_headings(db: &Database, note_id: &str, headings: &[Heading]) -> Result<()>;
pub fn load_backlinks(db: &Database, note_path: &str) -> Result<Vec<NoteLink>>;
pub fn load_forward_links(db: &Database, note_path: &str) -> Result<Vec<NoteLink>>;
pub fn load_headings(db: &Database, note_path: &str) -> Result<Vec<Heading>>;

// Tauri Command
#[tauri::command]
pub async fn get_graph_layout(
    width: f64,
    height: f64,
    state: State<'_, AppState>
) -> Result<GraphLayout, String>;
```

### Interface (TypeScript)

```typescript
export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

// API function
export async function getGraphLayout(
  width: number,
  height: number
): Promise<GraphLayout>;
```

### Behavior

**Given** notes A→B and B→A linking each other
**When** `get_backlinks("A")` is called
**Then** returns `["B"]`

**Given** notes A→B and A→C
**When** `get_forward_links("A")` is called
**Then** returns `["B", "C"]`

**Given** note A links to B, then updated to link to C
**When** graph is updated
**Then** edge A→B is removed, edge A→C is added

**Given** 3 connected notes in graph
**When** `compute_layout(800, 600)` is called
**Then** returns positions within bounds [0,800] x [0,600]

**Given** connected nodes A-B and isolated node C
**When** layout is computed
**Then** A and B are closer together than either is to C

## Design Decisions (Inferred)

| Decision | Evidence | Confidence |
|----------|----------|------------|
| petgraph DiGraph for in-memory graph | `graph.rs:11`, `graph.rs:65` | high |
| LinkKind stored as edge weight | `graph.rs:65`, `graph.rs:128-131` | high |
| HashMap for path→NodeIndex lookup | `graph.rs:67` | high |
| Fruchterman-Reingold for layout | `graph.rs:217` | high |
| 100 iterations with linear cooling | `graph.rs:246-248` | medium |
| Ideal distance k = sqrt(area/n) | `graph.rs:227` | high |
| Circular initial placement | `graph.rs:233-244` | medium |
| 30px padding from bounds | `graph.rs:300-302` | low |
| Links/headings persisted to SQLite | `graph.rs:407-459` | high |
| target_note_id resolved for existing notes | `graph.rs:426-432` | high |

## Uncertainties

- [ ] Is 100 iterations sufficient for large graphs? No dynamic adjustment
- [ ] How does layout perform with 1000+ notes? Not tested
- [ ] Should unresolved links (target doesn't exist) be treated differently?
- [ ] Graph is rebuilt on every note rename/delete - performance concern?
- [ ] Layout is computed on demand - should it be cached?
- [ ] No user-customizable layout parameters (cooling, iterations, forces)

## Acceptance Criteria (Derived from Tests)

- [ ] Graph can be built and queried (`graph_add_and_query`)
- [ ] Updating a note replaces its links (`graph_update_replaces_links`)
- [ ] Removing a note removes it and its edges (`graph_remove_note`)
- [ ] Non-existent node returns empty backlinks/forward links (`graph_no_node_returns_empty`)
- [ ] Links can be saved and loaded from database (`db_save_and_load_links`)
- [ ] Headings can be saved and loaded from database (`db_save_and_load_headings`)
- [ ] Empty graph produces empty layout (`layout_empty_graph`)
- [ ] Single node produces single node layout (`layout_single_node`)
- [ ] Layout positions are within specified bounds (`layout_produces_positions_in_bounds`)
- [ ] Labels strip directory and extension (`layout_label_strips_directory_and_extension`)
- [ ] Connected nodes are closer than disconnected ones (`layout_connected_nodes_closer_than_disconnected`)
- [ ] Saving links replaces old ones (`db_save_links_replaces_old`)

## Related
- Extracted from: `src-tauri/src/graph.rs`, `src-tauri/src/commands/notes.rs`
- Depends on: petgraph crate, `COMP-DATABASE-001`, `COMP-MARKDOWN-001`
- Used by: `COMP-VAULT-001`, Frontend graph visualization
