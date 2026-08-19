import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDefaultBuilderAddressing } from '../src/builder/addressing.ts';
import { createDefaultBuilderAclConfig } from '../src/builder/acl.ts';
import {
  applyBuilderLayoutOperation,
  builderAuthoringSiteBounds,
  bulkRenameBuilderInterfaces,
  bulkRenameBuilderNodes,
  bulkUpdateBuilderEthernetLinks,
  bulkUpdateBuilderInternalLinks,
  copyBuilderTopologySelection,
  createBuilderAuthoringBranch,
  createBuilderAuthoringHistory,
  createBuilderAuthoringSite,
  createBuilderAuthoringSnapshot,
  pasteBuilderTopologySelection,
  recordBuilderAuthoringSnapshot,
  redoBuilderAuthoringHistory,
  undoBuilderAuthoringHistory,
} from '../src/builder/authoring.ts';
import { createDefaultBuilderDhcpConfig } from '../src/builder/dhcp.ts';
import { createDefaultBuilderEthernetConfig } from '../src/builder/ethernet.ts';
import { createDefaultBuilderIpv6Config } from '../src/builder/ipv6.ts';
import { createDefaultBuilderLinkProfiles } from '../src/builder/link-characteristics.ts';
import { defaultBuilderGraph, defaultBuilderLayout } from '../src/builder/model.ts';
import { createDefaultBuilderNatConfig } from '../src/builder/nat.ts';
import { createDefaultBuilderRoutingConfig } from '../src/builder/routing.ts';

const graph = defaultBuilderGraph;
const addressing = createDefaultBuilderAddressing(graph);
const ethernet = createDefaultBuilderEthernetConfig();
const snapshot = createBuilderAuthoringSnapshot({
  graph,
  addressing,
  routing: createDefaultBuilderRoutingConfig(),
  ethernet,
  linkProfiles: createDefaultBuilderLinkProfiles(graph),
  acl: createDefaultBuilderAclConfig(),
  nat: createDefaultBuilderNatConfig(graph),
  dhcp: createDefaultBuilderDhcpConfig(ethernet),
  ipv6: createDefaultBuilderIpv6Config(graph, addressing),
  sourceId: 'client',
  destinationId: 'app',
  layout: defaultBuilderLayout,
});

const firstLink = graph.links[0];
assert.ok(firstLink);
const selected = [firstLink.a, firstLink.b];
const changedGraph = bulkUpdateBuilderInternalLinks(graph, selected, { cost: Math.min(99, firstLink.cost + 3) });
const changedSnapshot = createBuilderAuthoringSnapshot({ ...snapshot, graph: changedGraph });
let history = createBuilderAuthoringHistory(snapshot);
history = recordBuilderAuthoringSnapshot(history, changedSnapshot);
assert.equal(history.entries.length, 2);
assert.equal(history.index, 1);
const undone = undoBuilderAuthoringHistory(history);
assert.ok(undone.snapshot);
assert.equal(undone.snapshot.graph.links.find((link) => link.id === firstLink.id)?.cost, firstLink.cost);
const redone = redoBuilderAuthoringHistory(undone.history);
assert.ok(redone.snapshot);
assert.equal(redone.snapshot.graph.links.find((link) => link.id === firstLink.id)?.cost, Math.min(99, firstLink.cost + 3));

const clipboard = copyBuilderTopologySelection(graph, defaultBuilderLayout, selected);
assert.ok(clipboard);
assert.equal(clipboard.nodes.length, 2);
assert.equal(clipboard.links.some((link) => link.id === firstLink.id), true);
const pasted = pasteBuilderTopologySelection(graph, defaultBuilderLayout, clipboard);
assert.equal(pasted.selectedNodeIds.length, 2);
assert.ok(pasted.selectedNodeIds.every((id) => !graph.nodes.some((node) => node.id === id)));
assert.ok(pasted.graph.nodes.filter((node) => pasted.selectedNodeIds.includes(node.id)).every((node) => node.builtin === false));
assert.equal(pasted.graph.links.length, graph.links.length + clipboard.links.length);

const aligned = applyBuilderLayoutOperation(defaultBuilderLayout, selected, 'align-center-y');
assert.equal(aligned[selected[0]].y, aligned[selected[1]].y);
const site = createBuilderAuthoringSite([], 'EDGE SITE', selected)[0];
const bounds = builderAuthoringSiteBounds(site, defaultBuilderLayout);
assert.ok(bounds && bounds.nodeCount === 2 && bounds.width > 0 && bounds.height > 0);

const renamedGraph = bulkRenameBuilderNodes(graph, selected, 'LAB-');
assert.deepEqual(renamedGraph.nodes.filter((node) => selected.includes(node.id)).map((node) => node.label), ['LAB-1', 'LAB-2']);
const renamedAddressing = bulkRenameBuilderInterfaces(graph, addressing, selected, 'eth');
for (const segment of Object.values(renamedAddressing.segments)) {
  for (const iface of segment.interfaces) if (selected.includes(iface.nodeId)) assert.match(iface.name, /^eth\d+$/);
}
assert.throws(() => bulkRenameBuilderInterfaces(graph, addressing, selected, 'xe-'), /ethN notation/, 'bulk authoring must preserve the canonical routed-interface naming contract');

const accessLink = ethernet.links.find((link) => link.mode === 'access');
assert.ok(accessLink);
const alternateVlan = ethernet.vlans.find((vlan) => vlan.id !== accessLink.accessVlan);
assert.ok(alternateVlan);
const ethernetBulk = bulkUpdateBuilderEthernetLinks(ethernet, [accessLink.id], { accessVlan: alternateVlan.id });
assert.equal(ethernetBulk.links.find((link) => link.id === accessLink.id)?.accessVlan, alternateVlan.id);
const branch = createBuilderAuthoringBranch([], 'FAILOVER TEST', changedSnapshot)[0];
assert.equal(branch.label, 'FAILOVER TEST');
assert.notEqual(branch.snapshot, changedSnapshot);
assert.equal(branch.snapshot.graph.links.find((link) => link.id === firstLink.id)?.cost, Math.min(99, firstLink.cost + 3));

const networkBuilderSource = readFileSync('src/NetworkBuilder.tsx', 'utf8');
const panelWrapperSource = readFileSync('src/BuilderAuthoringPanel.tsx', 'utf8');
const panelContentSource = readFileSync('src/BuilderAuthoringPanelContent.tsx', 'utf8');
assert.match(networkBuilderSource, /BuilderAuthoringPanel/, 'Network Builder must mount the Track B authoring surface');
assert.match(networkBuilderSource, /lazy\(\(\) => import\('\.\/BuilderAuthoringPanel\.tsx'\)/, 'the entire Track B authoring shell must remain outside the initial NetworkBuilder chunk');
assert.doesNotMatch(networkBuilderSource, /BuilderAuthoringPanel\.tsx'\)\.then/, 'the outer authoring lazy boundary must use the module default directly instead of shipping a startup adapter');
assert.match(networkBuilderSource, /restoreCanonicalBuilderConfig\(scenario\)/, 'scenario restore and Track B undo/branch restore must share one canonical configuration-application boundary');
assert.match(networkBuilderSource, /builder-canvas-viewport/, 'Builder canvas must expose a camera viewport for zoom/focus');
assert.match(networkBuilderSource, /builder-marquee/, 'Builder canvas must expose marquee selection');
assert.doesNotMatch(networkBuilderSource, /builder-site-bound/, 'presentation-only site bounds belong in the lazy authoring minimap, not the always-loaded main canvas');
assert.match(panelContentSource, /siteBounds\.map\(/, 'lazy authoring minimap must project site grouping bounds');
assert.match(panelWrapperSource, /lazy\(\(\) => import\('\.\/BuilderAuthoringPanelContent\.tsx'\)/, 'heavy authoring tools must remain behind a lazy boundary');
assert.match(panelContentSource, /searchBuilderTopology\(/, 'authoring search UI must consume the shipped deterministic topology-search engine');
assert.match(panelContentSource, /compareBuilderScenarios\(/, 'scenario compare UI must consume the shipped deterministic compare engine');
assert.match(panelContentSource, /RESTORE BASELINE/, 'authoring workspace must expose a clean baseline restore path');
assert.match(panelContentSource, /SHOW ROUTED INTERFACE NAMES/, 'authoring workspace must expose interface-name visibility');
assert.match(panelContentSource, /value="ethN" readOnly/, 'bulk interface authoring must present the canonical ethN contract instead of implying unsupported vendor prefixes');
assert.match(panelContentSource, /SAVE TEMPLATE/, 'authoring workspace must expose reusable topology templates');
assert.match(panelContentSource, /SET ACCESS VLAN/, 'authoring workspace must expose bulk VLAN edits');

console.log('Track B authoring contract passed: bounded canonical undo/redo, topology copy/paste, deterministic alignment, site bounds, reusable graph fragments, canonical ethN bulk interface renumbering, bulk device/routed-link/Ethernet-VLAN edits, canonical branch snapshots, lazy authoring UI, topology search integration, scenario compare integration, camera/marquee hooks, and clean-baseline semantics.');
