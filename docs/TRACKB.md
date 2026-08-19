# Track B — Builder authoring environment

Track B closes the gap between HOPSCOTCH's canonical Builder models and a practical topology-authoring workflow.

The central rule is unchanged:

> **Editor state may change how a network is selected, arranged, grouped, found, or compared. It may not become a second network model.**

Routing, addressing, Ethernet/VLAN, ACL, NAT, DHCP, IPv6, and link behavior continue to come from the existing canonical Builder models and validators. Track B only adds authoring mechanics around them.

---

## Product surface

### Bounded undo / redo

Authoring history stores bounded deep snapshots of canonical Builder configuration plus layout/source/destination selection.

- maximum 40 history entries
- undo restores the previous canonical configuration snapshot
- redo restores the next snapshot
- editing after undo truncates the abandoned redo branch
- restoring a snapshot clears session-only runtime observations such as ARP/NAT/DHCP/probe/application state so stale runtime truth cannot survive a configuration rewind
- historical time-machine mode remains read-only and does not write into authoring history

Undo/redo history is session-only. It is not serialized into Builder scenario JSON.

### Multi-select, marquee, copy / paste, and layout

Routed devices support modifier selection plus canvas marquee selection.

Selected routed subgraphs can be copied and pasted:

- copied links are only links whose two endpoints are both selected
- pasted nodes/links receive deterministic collision-free IDs
- pasted objects are regular non-builtin canonical Builder objects
- paste goes through the existing graph reconciliation path
- existing Builder node/link ceilings remain enforced

Multi-selected devices can be aligned left/right/top/bottom/center or distributed horizontally/vertically. Layout operations change presentation geometry only; they do not alter forwarding truth.

### Search, focus, camera, and minimap

The authoring workspace consumes the already-shipped deterministic `topology-search.ts` engine.

- search results retain the engine's exact/prefix/substring ranking
- selecting a result focuses the same routed device and uses the engine's stable zoom target
- an SVG minimap is derived directly from canonical graph + layout
- RESET VIEW restores the neutral camera
- optional routed interface labels and bounded device annotations improve editing without entering scenario truth

The heavy authoring workspace is closed by default and lazy-loaded only after **OPEN AUTHORING**. Canvas selection state remains lightweight.

### Sites and templates

**Sites** are authoring presentation groups over routed device IDs. They provide named canvas bounds and collapsible group detail in the authoring workspace. Site membership never changes network behavior.

**Templates** are reusable routed topology fragments:

- saved from a current routed selection
- stored under a dedicated browser-local authoring key
- bounded to 16 templates
- inserted through the same canonical graph reconciliation path as paste
- not serialized into scenario network truth

Track B does not claim that site collapse changes or aggregates simulated topology. Collapse is an authoring-detail control only.

### Bulk canonical edits

Bulk controls mutate existing canonical models rather than editor copies.

Current bounded operations include:

- routed device labels
- routed interface renumbering under the existing canonical `ethN` interface-name contract
- internal routed-link cost and up/down state
- Ethernet access VLAN assignment
- Ethernet trunk allowed-VLAN sets
- Ethernet link up/down state

The existing validators remain authoritative. Track B deliberately does not relax interface naming or VLAN/routing constraints simply to make the bulk editor accept more syntax.

### Clean baseline, snapshots, branches, and compare

An authoring session can retain a clean baseline and capture up to 16 in-session branch snapshots.

- RESTORE BASELINE restores the clean canonical configuration
- SET NEW BASELINE intentionally starts a new comparison baseline
- SNAPSHOT CURRENT records a named canonical configuration snapshot
- RESTORE switches the live Builder configuration to that snapshot
- branch timestamps and names are authoring metadata only

The compare UI consumes the existing deterministic `scenario-compare.ts` engine. It compares canonical persisted configuration by stable object IDs and intentionally ignores visual layout.

These branches are bounded in-session authoring snapshots. They are not Git branches and are not persisted inside scenario JSON.

---

## Truth boundaries

### Canonical network truth

Undo/redo and branch snapshots contain the same canonical configuration families already used by Builder:

- graph
- IPv4 addressing
- routing / OSPF / BGP configuration
- Ethernet/VLAN configuration
- link characteristics
- ACL
- NAT
- DHCP
- IPv6 configuration
- source and destination selection

Applying a snapshot uses the existing Builder reconciliation and runtime reset boundaries.

### Authoring presentation/session state

The following remain outside simulated network truth:

- multi-selection
- Ethernet editor selection
- clipboard
- camera/zoom
- sites
- annotations
- interface-label visibility
- saved template catalog
- undo/redo cursor
- branch names/timestamps/catalog

Scenario schema remains **v9**. Track B does not add editor metadata to the scenario contract.

---

## Performance architecture

Track B is intentionally split so authoring breadth does not become startup cost.

- `BuilderAuthoringPanel.tsx` is a small shell
- `BuilderAuthoringPanelContent.tsx` is dynamically imported only when the workspace is opened
- authoring snapshot helpers use clone-only/lightweight dependencies so the lazy chunk does not force protocol engines into shared startup chunks
- stress Builder does not mount the authoring workspace
- camera presentation must not widen existing performance budgets

No performance or DOM ceiling is widened for Track B.

---

## Permanent acceptance contract

`npm run test:builder-authoring-contract` verifies:

- bounded canonical undo/redo
- redo-branch replacement after subsequent editing
- deterministic topology copy/paste
- existing Builder node/link ceilings
- deterministic alignment/site bounds
- reusable topology fragments
- canonical `ethN` interface renumbering and rejection of unsupported names
- routed-link and Ethernet/VLAN bulk edits
- branch snapshot cloning
- lazy authoring boundary
- canvas camera + marquee hooks
- topology search UI consuming the shipped search engine
- scenario compare UI consuming the shipped compare engine
- baseline restore semantics

The contract is part of `npm run check` and therefore runs with the rest of the Builder, Journey, measured-evidence, and captured-evidence contracts.

---

## Track B closeout

Track B is complete when the exact merge candidate passes:

1. full repository `npm run check`,
2. the unchanged production performance budgets,
3. Chrome default rendering,
4. Chrome with GPU disabled,
5. Chrome SwiftShader compatibility,
6. Firefox semantic compatibility,
7. real PCAP/PCAPNG capture replay compatibility.

After closeout, enterprise L2/L3 depth in **Track C** becomes the next regular product priority. Track C must use the same authoring, time-machine, application, packet, and causal-inspection foundations rather than adding protocol-specific side tools.
