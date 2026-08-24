import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('../src/MeasuredNetworkWorkspace.tsx', import.meta.url), 'utf8');
const wrapper = readFileSync(new URL('../src/JourneyTheater.tsx', import.meta.url), 'utf8');
const journey = readFileSync(new URL('../src/JourneyTheaterV2.tsx', import.meta.url), 'utf8');
const sidecar = readFileSync(new URL('../src/MeasuredEvidenceSidecar.tsx', import.meta.url), 'utf8');
const model = readFileSync(new URL('../src/journey/model.ts', import.meta.url), 'utf8');
const modifiers = readFileSync(new URL('../src/journey/modifiers.ts', import.meta.url), 'utf8');

assert.match(app, /const \[measuredSession, setMeasuredSession\] = useState<MeasuredSnapshotState \| null>\(null\)/, 'App must own one session-only measured projection slot');
assert.match(app, /measuredState=\{measuredSession\}/, 'App must pass measured session state to presentation consumers');
assert.match(app, /onMeasuredStateChange=\{setMeasuredSession\}/, 'Lab 09 must be the explicit measured session replace/clear surface');
assert.doesNotMatch(app, /NativeMeasurementSnapshot|NetworkDiagnosticsIngestion/, 'App must not retain raw native report/snapshot ingestion objects');
assert.doesNotMatch(app, /localStorage|sessionStorage/, 'App measured session must remain reload-ephemeral');

assert.match(workspace, /onMeasuredStateChange\(next\.state\)/, 'valid 09C import must publish only the 09B measured-state projection');
assert.match(workspace, /onMeasuredStateChange\(null\)/, 'Clear must remove session evidence everywhere');
assert.doesNotMatch(workspace, /setIngestion\(/, 'workspace must not retain a parallel local truth store');

assert.match(wrapper, /MeasuredSnapshotState/, 'Journey wrapper may accept measured state only as a presentation prop type');
assert.match(journey, /<MeasuredEvidenceSidecar measuredState=\{measuredState\}/, 'Journey must render a separate measured evidence sidecar');
assert.match(journey, /<SemanticScene state=\{state\} hostname=\{scenario\.hostname\} address=\{scenario\.destinationAddress\} packetProjection=\{packetProjection\} physicalProjection=\{physicalProjection\} onSelectPacketLayer=\{inspectPacketLayer\}\/>/, 'SemanticScene must remain driven only by simulated Journey state plus its deterministic packet and physical projections');
assert.doesNotMatch(journey, /<SemanticScene[^>]*measured(State|Evidence)/, 'measured values must never enter SemanticScene props');
assert.match(journey, /state\.scale === 'routing'.*'routing'.*state\.scale === 'transport'.*'transport'.*state\.protocol === 'DNS'.*'dns'/s, 'measured sidecar must be limited to routing/DNS/transport phases');

assert.match(sidecar, /measuredEvidenceForScene/, 'sidecar must classify evidence through the pure target-compatibility model');
assert.match(sidecar, /SIMULATED STORY UNCHANGED/, 'sidecar must state the simulation boundary visibly');
assert.match(sidecar, /LOCAL HOST · NOT GLOBAL/, 'sidecar must state local/global scope visibly');
assert.match(sidecar, /compatibility === 'other-target'.*journey-measured-mismatch/s, 'other-target-only evidence must render a mismatch notice rather than measured values');
assert.doesNotMatch(sidecar, /evidence\.otherTarget\.map/, 'other-target measured values must never be rendered as supporting evidence');
assert.match(sidecar, /sorted\.slice\(0, 3\)/, 'sidecar must remain compact rather than becoming a second report ledger');

for (const source of [model, modifiers]) {
  assert.doesNotMatch(source, /measurement\/|MeasuredSnapshotState|LOCAL MEASURED/, 'Journey model/modifier truth must not import or consume measured-state code');
}

console.log('Measured session sidecar contract passed: App stores only session-memory 09B state, SemanticScene stays simulation-only, and mismatched measured values remain hidden.');
