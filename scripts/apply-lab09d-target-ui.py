from pathlib import Path

workspace = Path('src/MeasuredNetworkWorkspace.tsx')
text = workspace.read_text()
replacements = [
    (
        "  const [selectedCategory, setSelectedCategory] = useState<NativeMeasurementCategory>('interface');\n  const [nowMs, setNowMs] = useState(() => Date.now());",
        "  const [selectedCategory, setSelectedCategory] = useState<NativeMeasurementCategory>('interface');\n  const [selectedTargetKey, setSelectedTargetKey] = useState<string | null>(null);\n  const [nowMs, setNowMs] = useState(() => Date.now());",
    ),
    (
        "  const selectedGroups = useMemo(() => groupFacts(selectedFacts), [selectedFacts]);\n  const freshness = ingestion ? measuredFreshnessAt(ingestion.state, nowMs) : null;",
        "  const selectedGroups = useMemo(() => groupFacts(selectedFacts), [selectedFacts]);\n  const activeTargetGroup = selectedGroups.find((group) => targetKey(group.target) === selectedTargetKey) ?? selectedGroups[0] ?? null;\n  const freshness = ingestion ? measuredFreshnessAt(ingestion.state, nowMs) : null;",
    ),
    (
        "    setSelectedCategory(first ?? 'interface');\n  };",
        "    setSelectedCategory(first ?? 'interface');\n    setSelectedTargetKey(null);\n  };",
    ),
    (
        "    setSelectedCategory('interface');\n  };",
        "    setSelectedCategory('interface');\n    setSelectedTargetKey(null);\n  };",
    ),
    (
        "return <button key={category} type=\"button\" className={selectedCategory === category ? 'active' : ''} onClick={() => setSelectedCategory(category)}>",
        "return <button key={category} type=\"button\" className={selectedCategory === category ? 'active' : ''} onClick={() => { setSelectedCategory(category); setSelectedTargetKey(null); }}>",
    ),
]
for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Lab 09D target UX anchor missing: {old[:200]!r}')
    text = text.replace(old, new, 1)
old_block = """          {selectedGroups.length === 0 ? <div className=\"measured-category-empty\"><strong>NO {categoryCopy.label.toUpperCase()} FACTS</strong><span>This report did not provide a whitelisted measurement in this category. HOPSCOTCH will not fill the gap from simulation.</span></div> : <div className=\"measured-target-groups\">
            {selectedGroups.map((group) => <article key={targetKey(group.target)} className=\"measured-target-group\">
              <header><div><span>TARGET SCOPE</span><strong>{targetLabel(group.target)}</strong></div><small>{group.facts.length} FACT{group.facts.length === 1 ? '' : 'S'}</small></header>
              <div className=\"measured-fact-list\">{group.facts.map((fact) => <div key={fact.id} className={`measured-fact state-${fact.availability}`} data-fact-id={fact.id}>
                <div><span>{fact.subject}</span><small>{fact.availability.toUpperCase()} · {new Date(fact.observedAt).toLocaleTimeString()}</small></div>
                <strong>{formatValue(fact.value, fact.unit)}</strong>
                <p>{fact.note}</p>
              </div>)}</div>
            </article>)}
          </div>}
"""
new_block = """          <div className=\"measured-scene-body\">
            {selectedGroups.length > 1 && <nav className=\"measured-target-selector\" aria-label={`${categoryCopy.label} target scopes`}>
              {selectedGroups.map((group) => {
                const key = targetKey(group.target);
                const active = activeTargetGroup !== null && targetKey(activeTargetGroup.target) === key;
                return <button key={key} type=\"button\" className={active ? 'active' : ''} onClick={() => setSelectedTargetKey(key)}>
                  <span>{targetLabel(group.target)}</span><b>{group.facts.length}</b>
                </button>;
              })}
            </nav>}
            {selectedGroups.length === 0 ? <div className=\"measured-category-empty\"><strong>NO {categoryCopy.label.toUpperCase()} FACTS</strong><span>This report did not provide a whitelisted measurement in this category. HOPSCOTCH will not fill the gap from simulation.</span></div> : activeTargetGroup && <div className=\"measured-target-groups\">
              <article key={targetKey(activeTargetGroup.target)} className=\"measured-target-group\">
                <header><div><span>TARGET SCOPE</span><strong>{targetLabel(activeTargetGroup.target)}</strong></div><small>{activeTargetGroup.facts.length} FACT{activeTargetGroup.facts.length === 1 ? '' : 'S'}</small></header>
                <div className=\"measured-fact-list\">{activeTargetGroup.facts.map((fact) => <div key={fact.id} className={`measured-fact state-${fact.availability}`} data-fact-id={fact.id}>
                  <div><span>{fact.subject}</span><small>{fact.availability.toUpperCase()} · {new Date(fact.observedAt).toLocaleTimeString()}</small></div>
                  <strong>{formatValue(fact.value, fact.unit)}</strong>
                  <p>{fact.note}</p>
                </div>)}</div>
              </article>
            </div>}
          </div>
"""
if old_block not in text:
    raise SystemExit('Lab 09D target-group render block missing')
workspace.write_text(text.replace(old_block, new_block, 1))

css = Path('src/MeasuredNetworkWorkspace.css')
css.write_text(css.read_text() + "\n" + """.measured-scene-body{min-height:0;display:flex;flex-direction:column;overflow:hidden}.measured-target-selector{display:flex;flex:0 0 auto;gap:6px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.055);overflow-x:auto;overscroll-behavior-inline:contain}.measured-target-selector button{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:150px;max-width:260px;padding:7px 9px;border:1px solid rgba(255,255,255,.065);border-radius:4px;background:rgba(255,255,255,.012);color:#68777e;cursor:pointer}.measured-target-selector button:hover{border-color:rgba(121,242,218,.13);background:rgba(121,242,218,.02)}.measured-target-selector button.active{border-color:rgba(121,242,218,.22);background:rgba(121,242,218,.055);color:#b7dcd5}.measured-target-selector button span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:650 .47rem ui-monospace,SFMono-Regular,Menlo,monospace}.measured-target-selector button b{display:grid;place-items:center;min-width:22px;height:18px;padding:0 4px;border:1px solid rgba(255,255,255,.07);border-radius:3px;font-size:.42rem}.measured-target-groups{flex:1}@media(max-width:720px){.measured-target-selector{padding:7px}.measured-target-selector button{min-width:138px;max-width:220px}}""")

profile = Path('scripts/performance-profile.mjs')
text = profile.read_text()
text = text.replace("['LOCAL MEASURED · BOUNDED · NOT GLOBAL', 'Network Diagnostics Engine', '500 Mbps', 'NOT PROMOTED TO LOCAL MEASURED']", "['LOCAL MEASURED · BOUNDED · NOT GLOBAL', 'Network Diagnostics Engine', 'NOT PROMOTED TO LOCAL MEASURED']")
text = text.replace("['LOCAL MEASURED · BOUNDED · NOT GLOBAL', 'Network Diagnostics Engine', '500 Mbps']", "['LOCAL MEASURED · BOUNDED · NOT GLOBAL', 'Network Diagnostics Engine']")
old_wait = """  await waitForExpression(cdp, `document.body.innerText.includes('Network Diagnostics Engine') && document.body.innerText.includes('500 Mbps')`, 8000);
  const loaded = await cdp.evaluate(`(()=>({
"""
new_wait = """  await waitForExpression(cdp, `document.body.innerText.includes('Network Diagnostics Engine') && document.querySelectorAll('.measured-target-selector button').length > 1`, 8000);
  const selectedThroughput = await cdp.evaluate(`(()=>{
    const button=[...document.querySelectorAll('.measured-target-selector button')].find((candidate)=>candidate.textContent?.includes('speed.example.test'));
    if(!button)return false;
    button.click();
    return true;
  })()`);
  if (!selectedThroughput) throw new Error(`${profile.id} could not select the transfer target scope.`);
  await waitForExpression(cdp, `document.body.innerText.includes('500 Mbps')`, 8000);
  const loaded = await cdp.evaluate(`(()=>({
"""
if old_wait not in text:
    raise SystemExit('Lab 09D browser target-selection wait anchor missing')
text = text.replace(old_wait, new_wait, 1)
old_final = """  await setFileInput(cdp, '.measured-file-input', measuredFixturePath);
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='true'`, 8000);
  await waitForExpression(cdp, `document.body.innerText.includes('500 Mbps')`, 8000);
  return {
    validFactCount: loaded.factCount,
    categoryCount: loaded.categoryCount,
    rejectedReplacementPreserved: true,
    clearReturnedToEmpty: true,
  };
"""
new_final = """  await setFileInput(cdp, '.measured-file-input', measuredFixturePath);
  await waitForExpression(cdp, `document.querySelector('.measured-workspace')?.getAttribute('data-measured-loaded')==='true'`, 8000);
  await waitForExpression(cdp, `document.body.innerText.includes('Network Diagnostics Engine')`, 8000);
  return {
    validFactCount: loaded.factCount,
    categoryCount: loaded.categoryCount,
    targetScopeSelectionVerified: true,
    rejectedReplacementPreserved: true,
    clearReturnedToEmpty: true,
  };
"""
if old_final not in text:
    raise SystemExit('Lab 09D browser final reimport anchor missing')
profile.write_text(text.replace(old_final, new_final, 1))

contract = Path('scripts/measured-workspace-contract-check.mjs')
text = contract.read_text()
anchor = "assert.match(workspace, /NO CROSS-TARGET MERGE/, 'workspace must state that target-scoped measurements are not merged globally');\n"
addition = anchor + "assert.match(workspace, /measured-target-selector/, 'workspace must expose target-scope selection within multi-target categories');\nassert.match(workspace, /activeTargetGroup/, 'workspace must render one active target group at a time rather than every target ledger simultaneously');\n"
if anchor not in text:
    raise SystemExit('Lab 09D source-contract target anchor missing')
contract.write_text(text.replace(anchor, addition, 1))
