import { useEffect, useMemo, useState } from 'react';
import { parseBuilderAllowedVlans } from './builder/ethernet.ts';
import {
  applyBuilderLayoutOperation,
  builderAuthoringSiteBounds,
  bulkRenameBuilderInterfaces,
  bulkRenameBuilderNodes,
  bulkUpdateBuilderEthernetLinks,
  bulkUpdateBuilderInternalLinks,
  builderAuthoringSnapshotKey,
  copyBuilderTopologySelection,
  createBuilderAuthoringBranch,
  createBuilderAuthoringHistory,
  createBuilderAuthoringSite,
  createBuilderAuthoringSnapshot,
  createBuilderAuthoringTemplate,
  listStoredBuilderAuthoringTemplates,
  pasteBuilderTopologySelection,
  recordBuilderAuthoringSnapshot,
  redoBuilderAuthoringHistory,
  saveStoredBuilderAuthoringTemplates,
  undoBuilderAuthoringHistory,
  type BuilderAuthoringBranch,
  type BuilderAuthoringSnapshot,
  type BuilderAuthoringTemplate,
  type BuilderLayoutOperation,
} from './builder/authoring.ts';
import { compareBuilderScenarios, isBuilderScenarioDiffEmpty, type BuilderScenarioDiff } from './builder/scenario-compare.ts';
import { searchBuilderTopology } from './builder/topology-search.ts';
import type { BuilderAuthoringPanelProps } from './BuilderAuthoringPanel.tsx';
import './BuilderAuthoringPanel.css';

function diffCount(diff: BuilderScenarioDiff): number {
  return diff.devices.length + diff.links.length + diff.configurationObjects.length + diff.fields.length;
}

function pathLabel(path: readonly string[]): string {
  return path.length === 0 ? 'ROOT' : path.join(' › ').toUpperCase();
}

function branchSnapshot(branches: readonly BuilderAuthoringBranch[], id: string, baseline: BuilderAuthoringSnapshot, current: BuilderAuthoringSnapshot): BuilderAuthoringSnapshot {
  if (id === 'baseline') return baseline;
  if (id === 'current') return current;
  return branches.find((branch) => branch.id === id)?.snapshot ?? current;
}

export default function BuilderAuthoringPanelContent({ snapshot, view, historical, onViewChange, onApplySnapshot, onCommitGraph, onCommitAddressing, onCommitEthernet, onSetLayout, onFocusDevice, onMessage }: BuilderAuthoringPanelProps) {
  const [history, setHistory] = useState(() => createBuilderAuthoringHistory(snapshot));
  const [templates, setTemplates] = useState<BuilderAuthoringTemplate[]>(() => listStoredBuilderAuthoringTemplates());
  const [searchQuery, setSearchQuery] = useState('');
  const [siteName, setSiteName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [devicePrefix, setDevicePrefix] = useState('NODE-');
  const [interfacePrefix, setInterfacePrefix] = useState('eth');
  const [linkCost, setLinkCost] = useState('10');
  const [accessVlan, setAccessVlan] = useState('10');
  const [allowedVlans, setAllowedVlans] = useState('10,20');
  const [compareBefore, setCompareBefore] = useState('baseline');
  const [compareAfter, setCompareAfter] = useState('current');
  const snapshotKey = useMemo(() => builderAuthoringSnapshotKey(snapshot), [snapshot]);

  useEffect(() => {
    if (historical) return;
    setHistory((current) => recordBuilderAuthoringSnapshot(current, snapshot));
    if (!view.baseline) onViewChange({ ...view, baseline: createBuilderAuthoringSnapshot(snapshot) });
  }, [snapshotKey, historical]);

  useEffect(() => {
    const nodeIds = new Set(snapshot.graph.nodes.map((node) => node.id));
    const ethernetLinks = new Set(snapshot.ethernet.links.map((link) => link.id));
    const selection = view.selection.filter((id) => nodeIds.has(id));
    const ethernetLinkSelection = view.ethernetLinkSelection.filter((id) => ethernetLinks.has(id));
    const sites = view.sites.map((site) => ({ ...site, nodeIds: site.nodeIds.filter((id) => nodeIds.has(id)) })).filter((site) => site.nodeIds.length > 0);
    const annotations = Object.fromEntries(Object.entries(view.annotations).filter(([id]) => nodeIds.has(id)));
    if (selection.length !== view.selection.length || ethernetLinkSelection.length !== view.ethernetLinkSelection.length || sites.length !== view.sites.length || Object.keys(annotations).length !== Object.keys(view.annotations).length) {
      onViewChange({ ...view, selection, ethernetLinkSelection, sites, annotations });
    }
  }, [snapshot.graph, snapshot.ethernet]);

  const baseline = view.baseline ?? snapshot;
  const searchResults = useMemo(() => searchBuilderTopology(snapshot.graph, snapshot.layout, searchQuery).slice(0, 8), [snapshot.graph, snapshot.layout, searchQuery]);
  const compareSnapshotBefore = branchSnapshot(view.branches, compareBefore, baseline, snapshot);
  const compareSnapshotAfter = branchSnapshot(view.branches, compareAfter, baseline, snapshot);
  const scenarioDiff = useMemo(() => compareBuilderScenarios(compareSnapshotBefore, compareSnapshotAfter), [compareSnapshotBefore, compareSnapshotAfter]);
  const primarySelection = view.selection[0] ?? null;
  const annotation = primarySelection ? view.annotations[primarySelection] ?? '' : '';
  const siteBounds = view.sites.flatMap((site) => { const bounds = builderAuthoringSiteBounds(site, snapshot.layout); return bounds ? [bounds] : []; });
  const disabled = historical;
  const canUndo = history.index > 0;
  const canRedo = history.index < history.entries.length - 1;

  const setView = (patch: Partial<typeof view>) => onViewChange({ ...view, ...patch });
  const withMessage = (action: () => void, failurePrefix = 'AUTHORING REJECTED') => {
    try { action(); } catch (error) { onMessage(`${failurePrefix} · ${error instanceof Error ? error.message : 'Invalid authoring operation.'}`); }
  };

  const undo = () => {
    const step = undoBuilderAuthoringHistory(history);
    if (!step.snapshot) return;
    setHistory(step.history);
    onApplySnapshot(step.snapshot, 'UNDO · restored the previous canonical Builder configuration snapshot.');
  };
  const redo = () => {
    const step = redoBuilderAuthoringHistory(history);
    if (!step.snapshot) return;
    setHistory(step.history);
    onApplySnapshot(step.snapshot, 'REDO · restored the next canonical Builder configuration snapshot.');
  };
  const copy = () => {
    const clipboard = copyBuilderTopologySelection(snapshot.graph, snapshot.layout, view.selection);
    if (!clipboard) { onMessage('COPY · select at least one routed device.'); return; }
    setView({ clipboard });
    onMessage(`COPY · ${clipboard.nodes.length} device${clipboard.nodes.length === 1 ? '' : 's'} and ${clipboard.links.length} internal link${clipboard.links.length === 1 ? '' : 's'} captured as authoring clipboard state.`);
  };
  const paste = () => withMessage(() => {
    if (!view.clipboard) throw new Error('Copy a routed selection first.');
    const result = pasteBuilderTopologySelection(snapshot.graph, snapshot.layout, view.clipboard);
    onCommitGraph(result.graph, result.layout, `PASTE · ${result.selectedNodeIds.length} copied device${result.selectedNodeIds.length === 1 ? '' : 's'} added through canonical graph reconciliation.`);
    setView({ selection: result.selectedNodeIds });
  });
  const applyLayout = (operation: BuilderLayoutOperation) => {
    const layout = applyBuilderLayoutOperation(snapshot.layout, view.selection, operation);
    onSetLayout(layout, `LAYOUT · ${operation.replaceAll('-', ' ').toUpperCase()} applied to ${view.selection.length} selected device${view.selection.length === 1 ? '' : 's'}. Network truth is unchanged.`);
  };
  const createSite = () => withMessage(() => {
    const sites = createBuilderAuthoringSite(view.sites, siteName, view.selection);
    setView({ sites }); setSiteName(''); onMessage(`SITE · ${sites.at(-1)?.label ?? 'SITE'} groups ${view.selection.length} selected routed device${view.selection.length === 1 ? '' : 's'} as presentation metadata only.`);
  });
  const saveTemplate = () => withMessage(() => {
    const next = createBuilderAuthoringTemplate(templates, templateName, snapshot.graph, snapshot.layout, view.selection);
    setTemplates(saveStoredBuilderAuthoringTemplates(next)); setTemplateName(''); onMessage(`TEMPLATE · ${next.at(-1)?.label ?? 'template'} saved locally from the current routed selection.`);
  });
  const instantiateTemplate = (template: BuilderAuthoringTemplate) => withMessage(() => {
    const result = pasteBuilderTopologySelection(snapshot.graph, snapshot.layout, template);
    onCommitGraph(result.graph, result.layout, `TEMPLATE · ${template.label} instantiated through the canonical graph model.`);
    setView({ selection: result.selectedNodeIds });
  });
  const snapshotBranch = () => withMessage(() => {
    const branches = createBuilderAuthoringBranch(view.branches, branchName, snapshot);
    setView({ branches }); setBranchName(''); onMessage(`BRANCH SNAPSHOT · ${branches.at(-1)?.label ?? 'branch'} captured from the current canonical configuration.`);
  });

  return <section className={`builder-authoring-panel ${historical ? 'is-historical' : ''}`} aria-label="Builder authoring tools">
    <div className="builder-authoring-title"><div><span>AUTHORING</span><strong>EDIT / FIND / BRANCH</strong></div><small>{historical ? 'HISTORICAL · READ ONLY' : `${view.selection.length} SELECTED · HISTORY ${history.index + 1}/${history.entries.length}`}</small></div>

    <div className="builder-authoring-toolbar">
      <button type="button" disabled={disabled || !canUndo} onClick={undo}>UNDO</button><button type="button" disabled={disabled || !canRedo} onClick={redo}>REDO</button>
      <button type="button" disabled={disabled || view.selection.length === 0} onClick={copy}>COPY</button><button type="button" disabled={disabled || !view.clipboard} onClick={paste}>PASTE</button>
      <button type="button" disabled={disabled} onClick={() => setView({ selection: snapshot.graph.nodes.map((node) => node.id) })}>SELECT ALL</button><button type="button" disabled={disabled} onClick={() => setView({ selection: [] })}>CLEAR</button>
      <button type="button" onClick={() => setView({ camera: { x: 50, y: 50, scale: 1 } })}>RESET VIEW</button>
    </div>

    <div className="builder-authoring-grid">
      <section className="builder-authoring-card builder-authoring-search"><div className="builder-authoring-card-title"><span>FIND</span><strong>TOPOLOGY SEARCH</strong></div>
        <input value={searchQuery} onChange={(event) => setSearchQuery(event.currentTarget.value)} placeholder="router, endpoint, id…" aria-label="Search routed topology"/>
        <div className="builder-authoring-results">{searchQuery.trim() && searchResults.length === 0 ? <small>NO MATCHES</small> : searchResults.map((result) => <button type="button" key={result.deviceId} onClick={() => { onFocusDevice(result.deviceId); setView({ selection: [result.deviceId], camera: { x: result.zoomTarget.x, y: result.zoomTarget.y, scale: 1.7 } }); }}><b>{result.label}</b><span>{result.deviceId} · {result.kind.toUpperCase()}</span><small>{result.matchKind.toUpperCase()} · {result.matchedField.toUpperCase()}</small></button>)}</div>
        <svg className="builder-authoring-minimap" viewBox="0 0 100 100" role="img" aria-label="Topology minimap">{snapshot.graph.links.map((link) => { const a=snapshot.layout[link.a], b=snapshot.layout[link.b]; return a&&b?<line key={link.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>:null; })}{snapshot.graph.nodes.map((node) => { const point=snapshot.layout[node.id]; return point?<circle key={node.id} cx={point.x} cy={point.y} r={view.selection.includes(node.id)?2.5:1.5} onClick={() => { onFocusDevice(node.id); setView({ selection:[node.id], camera:{x:point.x,y:point.y,scale:1.7} }); }}/>:null; })}</svg>
      </section>

      <section className="builder-authoring-card"><div className="builder-authoring-card-title"><span>ARRANGE</span><strong>MULTI-SELECT LAYOUT</strong></div>
        <div className="builder-authoring-button-grid">{(['align-left','align-center-x','align-right','align-top','align-center-y','align-bottom','distribute-x','distribute-y'] as BuilderLayoutOperation[]).map((operation)=><button type="button" key={operation} disabled={disabled || view.selection.length<2} onClick={()=>applyLayout(operation)}>{operation.replaceAll('-',' ').toUpperCase()}</button>)}</div>
        <label className="builder-authoring-check"><input type="checkbox" checked={view.showInterfaces} onChange={(event)=>setView({showInterfaces:event.currentTarget.checked})}/> SHOW ROUTED INTERFACE NAMES</label>
        <label>ANNOTATION<input disabled={disabled || !primarySelection} maxLength={96} value={annotation} placeholder={primarySelection?'Selected-device note':'Select one routed device'} onChange={(event)=>{if(!primarySelection)return; const text=event.currentTarget.value.slice(0,96); setView({annotations:{...view.annotations,[primarySelection]:text}});}}/></label>
      </section>

      <section className="builder-authoring-card"><div className="builder-authoring-card-title"><span>REUSE</span><strong>SITES + TEMPLATES</strong></div>
        <div className="builder-authoring-inline"><input value={siteName} onChange={(event)=>setSiteName(event.currentTarget.value)} placeholder="Site name"/><button type="button" disabled={disabled || view.selection.length===0} onClick={createSite}>CREATE SITE</button></div>
        <div className="builder-authoring-sites">{view.sites.map((site)=><details key={site.id} open={!site.collapsed}><summary><button type="button" disabled={disabled} onClick={(event)=>{event.preventDefault();setView({sites:view.sites.map((entry)=>entry.id===site.id?{...entry,collapsed:!entry.collapsed}:entry)});}}>{site.collapsed?'EXPAND':'COLLAPSE'}</button><b>{site.label}</b><small>{site.nodeIds.length} DEVICES</small></summary><div>{site.nodeIds.map((id)=><button type="button" key={id} onClick={()=>{onFocusDevice(id);setView({selection:[id]});}}>{snapshot.graph.nodes.find((node)=>node.id===id)?.label??id}</button>)}</div></details>)}</div>
        <div className="builder-authoring-inline"><input value={templateName} onChange={(event)=>setTemplateName(event.currentTarget.value)} placeholder="Template name"/><button type="button" disabled={disabled || view.selection.length===0} onClick={saveTemplate}>SAVE TEMPLATE</button></div>
        <div className="builder-authoring-template-list">{templates.map((template)=><div key={template.id}><span><b>{template.label}</b><small>{template.nodes.length} DEV · {template.links.length} LINKS</small></span><button type="button" disabled={disabled} onClick={()=>instantiateTemplate(template)}>INSERT</button><button type="button" disabled={disabled} onClick={()=>{const next=templates.filter((entry)=>entry.id!==template.id);setTemplates(saveStoredBuilderAuthoringTemplates(next));}}>×</button></div>)}</div>
        {siteBounds.length>0&&<small>{siteBounds.length} SITE BOUND{siteBounds.length===1?'':'S'} PROJECTED ON CANVAS · COLLAPSE CHANGES AUTHORING DETAIL ONLY, NEVER NETWORK STATE.</small>}
      </section>

      <section className="builder-authoring-card"><div className="builder-authoring-card-title"><span>BULK</span><strong>CANONICAL PROPERTIES</strong></div>
        <div className="builder-authoring-inline"><input value={devicePrefix} onChange={(event)=>setDevicePrefix(event.currentTarget.value)} placeholder="Device label prefix"/><button type="button" disabled={disabled || view.selection.length===0} onClick={()=>withMessage(()=>onCommitGraph(bulkRenameBuilderNodes(snapshot.graph,view.selection,devicePrefix),null,`BULK DEVICE LABELS · ${view.selection.length} selected routed devices renamed.`))}>RENAME DEVICES</button></div>
        <div className="builder-authoring-inline"><input value={interfacePrefix} onChange={(event)=>setInterfacePrefix(event.currentTarget.value)} placeholder="Interface prefix"/><button type="button" disabled={disabled || view.selection.length===0} onClick={()=>withMessage(()=>onCommitAddressing(bulkRenameBuilderInterfaces(snapshot.graph,snapshot.addressing,view.selection,interfacePrefix),`BULK INTERFACES · interface names updated on ${view.selection.length} selected routed devices.`))}>RENAME INTERFACES</button></div>
        <div className="builder-authoring-inline"><input type="number" min="1" max="1000000" value={linkCost} onChange={(event)=>setLinkCost(event.currentTarget.value)}/><button type="button" disabled={disabled || view.selection.length<2} onClick={()=>withMessage(()=>onCommitGraph(bulkUpdateBuilderInternalLinks(snapshot.graph,view.selection,{cost:Number(linkCost)}),null,'BULK LINKS · internal routed-link costs updated for the current selection.'))}>SET LINK COST</button></div>
        <div className="builder-authoring-toolbar compact"><button type="button" disabled={disabled || view.selection.length<2} onClick={()=>withMessage(()=>onCommitGraph(bulkUpdateBuilderInternalLinks(snapshot.graph,view.selection,{failed:true}),null,'BULK LINKS · selected internal routed links set DOWN.'))}>LINKS DOWN</button><button type="button" disabled={disabled || view.selection.length<2} onClick={()=>withMessage(()=>onCommitGraph(bulkUpdateBuilderInternalLinks(snapshot.graph,view.selection,{failed:false}),null,'BULK LINKS · selected internal routed links restored UP.'))}>LINKS UP</button></div>
        <div className="builder-authoring-ethernet-links">{snapshot.ethernet.links.map((link)=><label key={link.id}><input type="checkbox" disabled={disabled} checked={view.ethernetLinkSelection.includes(link.id)} onChange={(event)=>setView({ethernetLinkSelection:event.currentTarget.checked?[...view.ethernetLinkSelection,link.id]:view.ethernetLinkSelection.filter((id)=>id!==link.id)})}/><span>{link.id}</span><small>{link.mode.toUpperCase()} · {link.mode==='access'?`VLAN ${link.accessVlan}`:`${link.allowedVlans?.join(',')}`}</small></label>)}</div>
        <div className="builder-authoring-inline"><input value={accessVlan} onChange={(event)=>setAccessVlan(event.currentTarget.value)} placeholder="Access VLAN"/><button type="button" disabled={disabled || view.ethernetLinkSelection.length===0} onClick={()=>withMessage(()=>{const selected=view.ethernetLinkSelection.filter((id)=>snapshot.ethernet.links.find((link)=>link.id===id)?.mode==='access'); if(selected.length===0)throw new Error('Select at least one access Ethernet link.'); onCommitEthernet(bulkUpdateBuilderEthernetLinks(snapshot.ethernet,selected,{accessVlan:Number(accessVlan)}),`BULK VLAN · ${selected.length} access links moved to VLAN ${accessVlan}.`);})}>SET ACCESS VLAN</button></div>
        <div className="builder-authoring-inline"><input value={allowedVlans} onChange={(event)=>setAllowedVlans(event.currentTarget.value)} placeholder="10,20"/><button type="button" disabled={disabled || view.ethernetLinkSelection.length===0} onClick={()=>withMessage(()=>{const selected=view.ethernetLinkSelection.filter((id)=>snapshot.ethernet.links.find((link)=>link.id===id)?.mode==='trunk'); if(selected.length===0)throw new Error('Select at least one trunk Ethernet link.'); const allowed=parseBuilderAllowedVlans(allowedVlans,snapshot.ethernet); onCommitEthernet(bulkUpdateBuilderEthernetLinks(snapshot.ethernet,selected,{allowedVlans:allowed}),`BULK TRUNK · ${selected.length} trunk links now allow VLANs ${allowed.join(', ')}.`);})}>SET TRUNK VLANS</button></div>
        <div className="builder-authoring-toolbar compact"><button type="button" disabled={disabled || view.ethernetLinkSelection.length===0} onClick={()=>withMessage(()=>onCommitEthernet(bulkUpdateBuilderEthernetLinks(snapshot.ethernet,view.ethernetLinkSelection,{failed:true}),'BULK ETHERNET · selected links set DOWN.'))}>ETH DOWN</button><button type="button" disabled={disabled || view.ethernetLinkSelection.length===0} onClick={()=>withMessage(()=>onCommitEthernet(bulkUpdateBuilderEthernetLinks(snapshot.ethernet,view.ethernetLinkSelection,{failed:false}),'BULK ETHERNET · selected links restored UP.'))}>ETH UP</button></div>
      </section>

      <section className="builder-authoring-card builder-authoring-branches"><div className="builder-authoring-card-title"><span>BRANCH</span><strong>SNAPSHOT + COMPARE</strong></div>
        <div className="builder-authoring-toolbar compact"><button type="button" disabled={disabled} onClick={()=>onApplySnapshot(baseline,'BASELINE · restored the clean authoring-session baseline.')}>RESTORE BASELINE</button><button type="button" disabled={disabled} onClick={()=>setView({baseline:createBuilderAuthoringSnapshot(snapshot),branches:[]})}>SET NEW BASELINE</button></div>
        <div className="builder-authoring-inline"><input value={branchName} onChange={(event)=>setBranchName(event.currentTarget.value)} placeholder="Snapshot / branch name"/><button type="button" disabled={disabled} onClick={snapshotBranch}>SNAPSHOT CURRENT</button></div>
        <div className="builder-authoring-branch-list">{view.branches.map((branch)=><div key={branch.id}><span><b>{branch.label}</b><small>{new Date(branch.createdAt).toLocaleString()}</small></span><button type="button" disabled={disabled} onClick={()=>onApplySnapshot(branch.snapshot,`BRANCH · restored ${branch.label}.`)}>RESTORE</button><button type="button" disabled={disabled} onClick={()=>setView({branches:view.branches.filter((entry)=>entry.id!==branch.id)})}>×</button></div>)}</div>
        <div className="builder-authoring-compare-selectors"><label>BEFORE<select value={compareBefore} onChange={(event)=>setCompareBefore(event.currentTarget.value)}><option value="baseline">BASELINE</option><option value="current">CURRENT</option>{view.branches.map((branch)=><option key={branch.id} value={branch.id}>{branch.label}</option>)}</select></label><label>AFTER<select value={compareAfter} onChange={(event)=>setCompareAfter(event.currentTarget.value)}><option value="baseline">BASELINE</option><option value="current">CURRENT</option>{view.branches.map((branch)=><option key={branch.id} value={branch.id}>{branch.label}</option>)}</select></label></div>
        <div className={`builder-authoring-diff ${isBuilderScenarioDiffEmpty(scenarioDiff)?'empty':''}`}><strong>{isBuilderScenarioDiffEmpty(scenarioDiff)?'NO CANONICAL CONFIG CHANGES':`${diffCount(scenarioDiff)} CHANGE GROUPS`}</strong><small>{scenarioDiff.devices.length} DEVICES · {scenarioDiff.links.length} LINKS · {scenarioDiff.configurationObjects.length} CONFIG OBJECTS · {scenarioDiff.fields.length} FIELDS</small>{scenarioDiff.devices.slice(0,4).map((change)=><p key={`device-${change.collectionPath.join('.')}-${change.id}`}><b>{change.change.toUpperCase()} DEVICE · {String(change.id)}</b>{change.fields.slice(0,2).map((field)=>pathLabel(field.path)).join(' · ')}</p>)}{scenarioDiff.links.slice(0,4).map((change)=><p key={`link-${change.collectionPath.join('.')}-${change.id}`}><b>{change.change.toUpperCase()} LINK · {String(change.id)}</b>{change.fields.slice(0,2).map((field)=>pathLabel(field.path)).join(' · ')}</p>)}{scenarioDiff.fields.slice(0,6).map((field)=><p key={field.path.join('.')}><b>{field.change.toUpperCase()} · {pathLabel(field.path)}</b>{String(field.before??'∅')} → {String(field.after??'∅')}</p>)}</div>
      </section>
    </div>
    <small className="builder-authoring-boundary">UNDO / REDO + BRANCHES STORE CANONICAL BUILDER CONFIGURATION SNAPSHOTS · SEARCH / CAMERA / SITES / ANNOTATIONS / SELECTION ARE AUTHORING PRESENTATION STATE · SCENARIO COMPARE REUSES THE DETERMINISTIC CONFIG-COMPARE ENGINE AND INTENTIONALLY IGNORES VISUAL LAYOUT.</small>
  </section>;
}
