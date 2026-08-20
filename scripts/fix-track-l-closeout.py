from pathlib import Path


def replace_if_present(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    if old in text:
        file_path.write_text(text.replace(old, new, 1))


# Related canonical event chains remain their own causal chains. A state/outcome
# fact must never be represented as the cause of an earlier recorded event.
replace_if_present(
    'src/builder/explain.ts',
    "function appendEventFacts(builder: FactBuilder, input: BuilderDeviceWorkbenchInput, event: BuilderWorkbenchEvent | null, causeId: string | null = null): void {\n  if (!event) return;\n  const chain = eventChain(input.events, event.id);\n  let previous = causeId;",
    "function appendEventFacts(builder: FactBuilder, input: BuilderDeviceWorkbenchInput, event: BuilderWorkbenchEvent | null, _relatedFactId: string | null = null): void {\n  if (!event) return;\n  const chain = eventChain(input.events, event.id);\n  let previous: string | null = null;",
)

# Aggregate failures are warnings; the first concrete broken dimension/attempt
# remains the first BAD fact used by operational prose.
replace_if_present(
    'src/builder/explain.ts',
    "builder.add('packet.probe', 'OUTCOME', `${probe.kind.toUpperCase()} #${probe.sequence}`, 'overall result', `${probe.success ? 'PASS' : 'FAIL'} · ${probe.plane}`, probe.success ? 'good' : 'bad', [], [probeCitation]);",
    "builder.add('packet.probe', 'OUTCOME', `${probe.kind.toUpperCase()} #${probe.sequence}`, 'overall result', `${probe.success ? 'PASS' : 'FAIL'} · ${probe.plane}`, probe.success ? 'good' : 'warn', [], [probeCitation]);",
)
replace_if_present(
    'src/builder/explain.ts',
    "builder.add('application.transaction', 'OUTCOME', `${transaction.service.label} #${transaction.sequence}`, 'overall result', transaction.success ? 'SUCCESS' : `FAIL · ${transaction.firstBrokenBoundary ?? 'UNKNOWN'}`, transaction.success ? 'good' : 'bad', [], [transactionCitation]);",
    "builder.add('application.transaction', 'OUTCOME', `${transaction.service.label} #${transaction.sequence}`, 'overall result', transaction.success ? 'SUCCESS' : `FAIL · ${transaction.firstBrokenBoundary ?? 'UNKNOWN'}`, transaction.success ? 'good' : 'warn', [], [transactionCitation]);",
)

contract_path = Path('scripts/builder-explain-contract-check.mjs')
contract = contract_path.read_text()
if "import { readFileSync } from 'node:fs';" not in contract:
    contract = contract.replace("import assert from 'node:assert/strict';\n", "import assert from 'node:assert/strict';\nimport { readFileSync } from 'node:fs';\n", 1)

validation_helper = """
function assertGrounded(explanation) {
  const factIds = new Set(explanation.facts.map((fact) => fact.id));
  const citationIds = new Set(explanation.citations.map((citation) => citation.id));
  assert.equal(factIds.size, explanation.facts.length, `${explanation.topic}: fact ids must be unique`);
  assert.equal(citationIds.size, explanation.citations.length, `${explanation.topic}: citation ids must be unique`);
  for (const fact of explanation.facts) {
    assert.ok(fact.citationIds.length > 0, `${explanation.topic}:${fact.id} must cite canonical evidence`);
    for (const id of fact.citationIds) assert.ok(citationIds.has(id), `${explanation.topic}:${fact.id} references missing citation ${id}`);
    for (const id of fact.causeFactIds) assert.ok(factIds.has(id), `${explanation.topic}:${fact.id} references missing cause fact ${id}`);
  }
}
"""
if 'function assertGrounded(explanation)' not in contract:
    anchor = "function primaryAddress(addressing, nodeId) {\n"
    index = contract.index(anchor)
    contract = contract[:index] + validation_helper + "\n" + contract[index:]

if 'for (const explanation of [novice, operational, protocol, route, adjacency, policy, packet, applicationExplanation, eventExplanation]) assertGrounded(explanation);' not in contract:
    anchor = "const queryPack = createBuilderExplanationQueryPack(packet);\n"
    grounding = "for (const explanation of [novice, operational, protocol, route, adjacency, policy, packet, applicationExplanation, eventExplanation]) assertGrounded(explanation);\nassert.match(packet.summary, /TTL 64/, 'operational packet prose must surface the concrete failed attempt rather than stopping at aggregate FAIL');\nassert.match(applicationExplanation.summary, /ROUTING/, 'operational application prose must surface the first broken causal dimension');\n\n"
    contract = contract.replace(anchor, grounding + anchor, 1)

if "const networkBuilderSource = readFileSync('src/NetworkBuilder.tsx', 'utf8');" not in contract:
    anchor = "assert.deepEqual(input, before, 'Track L explanations must never mutate supplied canonical Builder truth');\n"
    static_checks = """const networkBuilderSource = readFileSync('src/NetworkBuilder.tsx', 'utf8');
const explainPanelSource = readFileSync('src/BuilderExplainPanel.tsx', 'utf8');
assert.match(networkBuilderSource, /lazy\(\(\) => import\('\.\/BuilderExplainPanel\.tsx'\)\)/, 'Track L workspace must remain a lazy Builder chunk');
assert.match(networkBuilderSource, /!stressLabel&&explainOpen&&<Suspense/, 'Track L workspace must stay absent from stress Builder DOM');
assert.match(networkBuilderSource, /setExplainOpen\(false\);setCliOpen/, 'opening Terminal must close Explain so Builder heading workspaces do not stack');
for (const topic of ['network', 'route', 'adjacency', 'policy', 'packet', 'application', 'event']) assert.match(explainPanelSource, new RegExp(`id: '${topic}'`), `Explain panel must expose ${topic} topic`);
assert.match(explainPanelSource, /COPY FACT PACK/, 'Explain panel must expose the advisory machine-readable fact pack');

"""
    contract = contract.replace(anchor, static_checks + anchor, 1)

contract_path.write_text(contract)
