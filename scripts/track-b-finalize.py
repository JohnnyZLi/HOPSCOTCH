from pathlib import Path
import re

# 1) Keep the entire authoring shell outside NetworkBuilder's initial chunk.
p = Path('src/NetworkBuilder.tsx')
s = p.read_text()
s = s.replace(
    "import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';",
    "import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';",
    1,
)
s = s.replace("import { BuilderAuthoringPanel } from './BuilderAuthoringPanel.tsx';\n", '', 1)
marker = "import './NetworkBuilder.css';\n"
insert = marker + "\nconst BuilderAuthoringPanel = lazy(() => import('./BuilderAuthoringPanel.tsx').then((module) => ({ default: module.BuilderAuthoringPanel })));\n"
if marker not in s:
    raise SystemExit('NetworkBuilder CSS marker missing')
s = s.replace(marker, insert, 1)
old = "          {!stressLabel&&<BuilderAuthoringPanel snapshot={displayedAuthoringSnapshot} view={authoringView} historical={isHistorical} onViewChange={setAuthoringView} onApplySnapshot={applyAuthoringSnapshot} onCommitGraph={commitAuthoringGraph} onCommitAddressing={commitAuthoringAddressing} onCommitEthernet={commitAuthoringEthernet} onSetLayout={setAuthoringLayout} onFocusDevice={focusAuthoringDevice} onMessage={setMessage}/>}\n"
new = "          {!stressLabel&&<Suspense fallback={null}><BuilderAuthoringPanel snapshot={displayedAuthoringSnapshot} view={authoringView} historical={isHistorical} onViewChange={setAuthoringView} onApplySnapshot={applyAuthoringSnapshot} onCommitGraph={commitAuthoringGraph} onCommitAddressing={commitAuthoringAddressing} onCommitEthernet={commitAuthoringEthernet} onSetLayout={setAuthoringLayout} onFocusDevice={focusAuthoringDevice} onMessage={setMessage}/></Suspense>}\n"
if old not in s:
    raise SystemExit('authoring panel render marker missing')
s = s.replace(old, new, 1)
p.write_text(s)

# 2) Make the existing canonical ethN constraint explicit instead of presenting a fake vendor-prefix affordance.
p = Path('src/BuilderAuthoringPanelContent.tsx')
s = p.read_text()
s = s.replace("  const [interfacePrefix, setInterfacePrefix] = useState('eth');\n", '', 1)
old = '''        <div className="builder-authoring-inline"><input value={interfacePrefix} onChange={(event)=>setInterfacePrefix(event.currentTarget.value)} placeholder="Interface prefix"/><button type="button" disabled={disabled || view.selection.length===0} onClick={()=>withMessage(()=>onCommitAddressing(bulkRenameBuilderInterfaces(snapshot.graph,snapshot.addressing,view.selection,interfacePrefix),`BULK INTERFACES · interface names updated on ${view.selection.length} selected routed devices.`))}>RENAME INTERFACES</button></div>'''
new = '''        <div className="builder-authoring-inline"><input value="ethN" readOnly aria-label="Canonical routed interface naming"/><button type="button" disabled={disabled || view.selection.length===0} onClick={()=>withMessage(()=>onCommitAddressing(bulkRenameBuilderInterfaces(snapshot.graph,snapshot.addressing,view.selection,'eth'),`BULK INTERFACES · canonical ethN names renumbered on ${view.selection.length} selected routed devices.`))}>RENUMBER INTERFACES</button></div>'''
if old not in s:
    raise SystemExit('interface bulk editor marker missing')
s = s.replace(old, new, 1)
p.write_text(s)

# 3) Permanently assert the two-level authoring lazy boundary and canonical interface UX.
p = Path('scripts/builder-authoring-contract-check.mjs')
s = p.read_text()
needle = "assert.match(networkBuilderSource, /BuilderAuthoringPanel/, 'Network Builder must mount the Track B authoring surface');\n"
replacement = needle + "assert.match(networkBuilderSource, /lazy\\(\\(\\) => import\\('\\.\\/BuilderAuthoringPanel\\.tsx'\\)/, 'the entire Track B authoring shell must remain outside the initial NetworkBuilder chunk');\n"
if needle not in s:
    raise SystemExit('authoring contract NetworkBuilder marker missing')
s = s.replace(needle, replacement, 1)
needle = "assert.match(panelContentSource, /SHOW ROUTED INTERFACE NAMES/, 'authoring workspace must expose interface-name visibility');\n"
replacement = needle + "assert.match(panelContentSource, /value=\"ethN\" readOnly/, 'bulk interface authoring must present the canonical ethN contract instead of implying unsupported vendor prefixes');\n"
if needle not in s:
    raise SystemExit('authoring contract interface marker missing')
s = s.replace(needle, replacement, 1)
p.write_text(s)

# 4) Close Track B in the active roadmap and promote Track C without duplicating its checklist.
p = Path('docs/ROADMAP.md')
s = p.read_text()
completed_b = '''### Completed active track — Track B Builder authoring environment

Track B makes the existing Builder model practical to author at scale without creating editor-only network truth.

- [x] bounded undo/redo over canonical configuration snapshots with runtime-state reset on restore
- [x] modifier + marquee multi-select, routed topology copy/paste, alignment, and distribution
- [x] named presentation-only sites plus reusable browser-local routed topology templates
- [x] topology-search UI consuming the shipped deterministic search engine, stable zoom/focus targets, minimap, annotations, and routed interface-name visibility
- [x] bulk canonical device-label, `ethN` interface-renumbering, routed-link cost/state, Ethernet access-VLAN, trunk-allowed-VLAN, and Ethernet link-state edits
- [x] clean authoring baseline plus bounded in-session named branch snapshots and restore
- [x] scenario compare UI consuming the shipped deterministic canonical-configuration compare engine
- [x] two-level lazy authoring boundary so the full editor is closed by default and does not become initial Builder startup cost

Selection, camera, sites, annotations, clipboard state, templates, undo cursor, and branch catalog remain authoring/session metadata. Scenario schema stays v9. `docs/TRACKB.md` is the architecture and validation record.

'''
anchor = '---\n\n## Current priority order\n'
if anchor not in s:
    raise SystemExit('roadmap current-priority anchor missing')
s = s.replace(anchor, completed_b + anchor, 1)
pattern = re.compile(r"## Current priority order\n.*?### Track E — data-plane realism", re.S)
priority = '''## Current priority order

With captured evidence, end-to-end application truth, causal replay, and the Builder authoring environment closed, the next highest-value work is deeper enterprise network behavior on top of those shared foundations.

### 1. Track C — enterprise Layer 2 / Layer 3 depth

- [ ] RSTP with explicit faster role/state transitions
- [ ] LACP / EtherChannel with logical bundle vs physical-member truth
- [ ] LLDP-style derived neighbor state
- [ ] Layer-3 switches, SVIs, routed switch ports, access/distribution/core designs
- [ ] vendor-neutral VRRP-style first-hop redundancy
- [ ] VRFs with genuinely separate routing tables and overlapping address space
- [ ] native/tagged/untagged VLAN behavior only when it preserves current VLAN truth

---

## Remaining regular tracks

These remain real product work. They should follow Track C unless a bounded dependency requires a different order.

### Track E — data-plane realism'''
s, count = pattern.subn(priority, s, count=1)
if count != 1:
    raise SystemExit('roadmap Track B/Track C priority block not found exactly once')
p.write_text(s)
