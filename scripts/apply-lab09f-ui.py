from pathlib import Path


def replace_once(path_name: str, old: str, new: str) -> None:
    path = Path(path_name)
    text = path.read_text()
    if old not in text:
        raise SystemExit(f'missing Lab 09F UI anchor in {path_name}: {old[:180]!r}')
    path.write_text(text.replace(old, new, 1))


workspace = 'src/MeasuredNetworkWorkspace.tsx'
replace_once(
    workspace,
    "import { ingestNetworkDiagnosticsReportV2 } from './measurement/networkDiagnosticsAdapter.ts';\n",
    "import { ingestNetworkDiagnosticsReportV2 } from './measurement/networkDiagnosticsAdapter.ts';\nimport {\n  DEFAULT_LOOPBACK_BRIDGE_ORIGIN,\n  connectLoopbackBridge,\n  fetchLoopbackBridgeReport,\n  type LoopbackBridgeConnection,\n  type LoopbackBridgeStatus,\n} from './measurement/loopbackBridge.ts';\n",
)
replace_once(
    workspace,
    "  const [nowMs, setNowMs] = useState(() => Date.now());\n",
    "  const [nowMs, setNowMs] = useState(() => Date.now());\n  const [bridgeOrigin, setBridgeOrigin] = useState(DEFAULT_LOOPBACK_BRIDGE_ORIGIN);\n  const [bridgeStatus, setBridgeStatus] = useState<LoopbackBridgeStatus>('disconnected');\n  const [bridgeConnection, setBridgeConnection] = useState<LoopbackBridgeConnection | null>(null);\n  const [bridgeError, setBridgeError] = useState<string | null>(null);\n",
)
replace_once(
    workspace,
    "  const clear = () => {\n",
    "  const connectBridge = async () => {\n    if (bridgeStatus === 'connecting') return;\n    setBridgeError(null);\n    setBridgeStatus('connecting');\n    try {\n      const connection = await connectLoopbackBridge(bridgeOrigin);\n      setBridgeConnection(connection);\n      setBridgeOrigin(connection.origin);\n      setBridgeStatus('connected');\n    } catch (reason) {\n      const message = reason instanceof Error ? reason.message : 'Unable to connect to the local Network Diagnostics bridge.';\n      setBridgeConnection(null);\n      setBridgeStatus(/handshake|schema|version|identity|report path|capabilit/i.test(message) ? 'rejected' : 'unavailable');\n      setBridgeError(message);\n    }\n  };\n\n  const refreshBridgeReport = async () => {\n    if (bridgeConnection === null || bridgeStatus !== 'connected') return;\n    setBridgeError(null);\n    try {\n      const next = await fetchLoopbackBridgeReport(bridgeConnection);\n      onMeasuredStateChange(next.state);\n      setFileName('LOCAL BRIDGE · REPORT V2');\n      setNowMs(Date.now());\n      chooseBestCategory(next.state);\n    } catch (reason) {\n      setBridgeError(reason instanceof Error ? reason.message : 'Unable to load a report from the local bridge.');\n    }\n  };\n\n  const disconnectBridge = () => {\n    setBridgeConnection(null);\n    setBridgeStatus('disconnected');\n    setBridgeError(null);\n  };\n\n  const clear = () => {\n",
)
replace_once(
    workspace,
    "    data-measured-loaded={measuredState ? 'true' : 'false'}\n",
    "    data-measured-loaded={measuredState ? 'true' : 'false'}\n    data-bridge-status={bridgeStatus}\n",
)
replace_once(
    workspace,
    "    <AnimatePresence mode=\"wait\" initial={false}>\n",
    "    <section className=\"measured-bridge\" aria-label=\"Optional local Network Diagnostics bridge\">\n      <div className=\"measured-bridge-copy\">\n        <span>OPTIONAL LOCAL BRIDGE</span>\n        <strong>EXPLICIT LOOPBACK CONNECTION</strong>\n        <p>No scanning or background polling. Connect performs one handshake against a loopback-only endpoint; Refresh Report is the separate action that requests one report through the existing validation path.</p>\n      </div>\n      <label className=\"measured-bridge-origin\">\n        <span>BRIDGE ORIGIN</span>\n        <input value={bridgeOrigin} disabled={bridgeStatus === 'connecting' || bridgeStatus === 'connected'} onChange={(event) => setBridgeOrigin(event.currentTarget.value)} spellCheck={false} aria-label=\"Local bridge origin\" />\n      </label>\n      <div className=\"measured-bridge-state\">\n        <span>STATE</span>\n        <strong className={`state-${bridgeStatus}`}>{bridgeStatus.toUpperCase()}</strong>\n        {bridgeConnection && <small>{bridgeConnection.handshake.application} · BRIDGE {bridgeConnection.handshake.bridgeVersion}</small>}\n      </div>\n      <div className=\"measured-bridge-actions\">\n        {bridgeStatus !== 'connected' ? <button type=\"button\" disabled={bridgeStatus === 'connecting'} onClick={() => void connectBridge()}>{bridgeStatus === 'connecting' ? 'CONNECTING…' : 'CONNECT'}</button> : <>\n          <button type=\"button\" onClick={() => void refreshBridgeReport()}>REFRESH REPORT</button>\n          <button className=\"bridge-disconnect\" type=\"button\" onClick={disconnectBridge}>DISCONNECT</button>\n        </>}\n      </div>\n      {bridgeError && <p className=\"measured-bridge-error\"><strong>BRIDGE {bridgeStatus === 'connected' ? 'REPORT REJECTED' : bridgeStatus.toUpperCase()}</strong><span>{bridgeError}</span>{measuredState && <small>PREVIOUS VALID MEASUREMENT REMAINS ACTIVE.</small>}</p>}\n    </section>\n\n    <AnimatePresence mode=\"wait\" initial={false}>\n",
)
replace_once(
    workspace,
    "<div><strong>NO LOCAL MEASUREMENT LOADED</strong><p>Import a Network Diagnostics Suite report-v2 JSON file. HOPSCOTCH will not probe localhost, upload the file, or invent measurements for sections that were not captured.</p></div>",
    "<div><strong>NO LOCAL MEASUREMENT LOADED</strong><p>Import a Network Diagnostics Suite report-v2 JSON file or explicitly connect the optional loopback bridge above. HOPSCOTCH does not scan localhost, poll in the background, upload reports, or invent measurements for sections that were not captured.</p></div>",
)

css_path = Path('src/MeasuredNetworkWorkspace.css')
css = css_path.read_text()
css += "\n.measured-bridge{display:grid;grid-template-columns:minmax(250px,1.35fr) minmax(245px,.95fr) minmax(150px,.55fr) auto;align-items:center;gap:12px;padding:11px 13px;border:1px solid rgba(121,242,218,.13);border-radius:6px;background:linear-gradient(90deg,rgba(121,242,218,.04),rgba(7,11,16,.9) 46%)}.measured-bridge-copy{display:grid;gap:3px;min-width:0}.measured-bridge-copy>span,.measured-bridge-origin>span,.measured-bridge-state>span{color:#627b76;font-size:.43rem;font-weight:900;letter-spacing:.105em}.measured-bridge-copy>strong{color:#b9d8d2;font-size:.6rem;letter-spacing:.045em}.measured-bridge-copy>p{margin:0;color:#5f6e74;font-size:.49rem;line-height:1.4}.measured-bridge-origin{display:grid;gap:5px;min-width:0}.measured-bridge-origin input{width:100%;min-width:0;padding:8px 9px;border:1px solid rgba(255,255,255,.09);border-radius:4px;outline:0;background:rgba(3,7,10,.72);color:#aebec3;font:600 .54rem ui-monospace,SFMono-Regular,Menlo,monospace}.measured-bridge-origin input:focus{border-color:rgba(121,242,218,.28);box-shadow:0 0 0 2px rgba(121,242,218,.035)}.measured-bridge-origin input:disabled{opacity:.56}.measured-bridge-state{display:grid;gap:3px;min-width:0}.measured-bridge-state>strong{font-size:.55rem;letter-spacing:.07em}.measured-bridge-state>strong.state-connected{color:#91d5c7}.measured-bridge-state>strong.state-connecting{color:#c9b67c}.measured-bridge-state>strong.state-unavailable,.measured-bridge-state>strong.state-rejected{color:#d78b8b}.measured-bridge-state>strong.state-disconnected{color:#75838a}.measured-bridge-state>small{color:#56666c;font-size:.43rem;overflow-wrap:anywhere}.measured-bridge-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}.measured-bridge-actions button{padding:8px 9px;border:1px solid rgba(121,242,218,.22);border-radius:4px;background:rgba(121,242,218,.045);color:#b7e7de;font-size:.48rem;font-weight:900;letter-spacing:.065em;cursor:pointer}.measured-bridge-actions button:disabled{opacity:.45;cursor:default}.measured-bridge-actions .bridge-disconnect{color:#9b9494;border-color:rgba(255,255,255,.09);background:rgba(255,255,255,.015)}.measured-bridge-error{grid-column:1/-1;display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:0;padding-top:8px;border-top:1px solid rgba(231,107,107,.11);color:#ba8181;font-size:.49rem}.measured-bridge-error strong{color:#df9292;font-size:.44rem;letter-spacing:.09em}.measured-bridge-error small{margin-left:auto;color:#716d6d;font-size:.42rem;letter-spacing:.06em}@media(max-width:1180px){.measured-bridge{grid-template-columns:1fr 1fr}.measured-bridge-copy{grid-column:1/-1}.measured-bridge-actions{justify-content:flex-start}}@media(max-width:720px){.measured-bridge{grid-template-columns:1fr;gap:9px}.measured-bridge-copy,.measured-bridge-error{grid-column:1}.measured-bridge-actions{justify-content:flex-start}.measured-bridge-error small{margin-left:0;width:100%}}\n"
css_path.write_text(css)
