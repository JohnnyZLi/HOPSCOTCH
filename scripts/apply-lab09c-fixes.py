from pathlib import Path

adapter = Path('src/measurement/networkDiagnosticsAdapter.ts')
text = adapter.read_text()
old_routing = """    const route = requiredRecord(entry, `deepDiagnostics.routing.entries[${index}]`);
    const destination = requiredString(route.destination, `deepDiagnostics.routing.entries[${index}].destination`);
    const routeTarget = target('prefix', destination);
    const prefix = `route-${index}-${safeIdPart(destination)}`;
    pushString(facts, `${prefix}-family`, 'route', `route ${destination} address family`, observedAt, route.addressFamily, 'Source-reported local route address family.', routeTarget);
    pushBoolean(facts, `${prefix}-default`, 'route', `route ${destination} is default`, observedAt, route.isDefault, 'Source-reported default-route flag.', routeTarget);
    pushNumber(facts, `${prefix}-metric`, 'route', `route ${destination} metric`, observedAt, route.metric, 'count', 'Source-reported local route metric; no cross-platform metric equivalence is implied.', routeTarget);
    pushString(facts, `${prefix}-interface`, 'route', `route ${destination} interface`, observedAt, route.interfaceName, 'Source-reported egress interface for this local route.', routeTarget);
    if (allowAddresses) pushString(facts, `${prefix}-gateway`, 'route', `route ${destination} gateway`, observedAt, route.gateway, 'Local gateway address included only because the report explicitly permits local addresses.', routeTarget);
"""
new_routing = """    const route = requiredRecord(entry, `deepDiagnostics.routing.entries[${index}]`);
    const destination = requiredString(route.destination, `deepDiagnostics.routing.entries[${index}].destination`);
    const disclosedDestination = allowAddresses ? destination : null;
    const routeLabel = disclosedDestination ?? `entry ${index + 1}`;
    const routeTarget = target('prefix', disclosedDestination);
    const prefix = allowAddresses ? `route-${index}-${safeIdPart(destination)}` : `route-${index}`;
    pushString(facts, `${prefix}-family`, 'route', `route ${routeLabel} address family`, observedAt, route.addressFamily, 'Source-reported local route address family.', routeTarget);
    pushBoolean(facts, `${prefix}-default`, 'route', `route ${routeLabel} is default`, observedAt, route.isDefault, 'Source-reported default-route flag.', routeTarget);
    pushNumber(facts, `${prefix}-metric`, 'route', `route ${routeLabel} metric`, observedAt, route.metric, 'count', 'Source-reported local route metric; no cross-platform metric equivalence is implied.', routeTarget);
    pushString(facts, `${prefix}-interface`, 'route', `route ${routeLabel} interface`, observedAt, route.interfaceName, 'Source-reported egress interface for this local route.', routeTarget);
    if (allowAddresses) pushString(facts, `${prefix}-gateway`, 'route', `route ${routeLabel} gateway`, observedAt, route.gateway, 'Local gateway address included only because the report explicitly permits local addresses.', routeTarget);
"""
if old_routing not in text:
    raise SystemExit('routing patch anchor missing')
text = text.replace(old_routing, new_routing, 1)
old_local_sig = "function mapLocalLink(facts: NativeMeasurementFact[], value: unknown, observedAt: string): void {"
new_local_sig = "function mapLocalLink(facts: NativeMeasurementFact[], value: unknown, observedAt: string, allowAddresses: boolean): void {"
if old_local_sig not in text:
    raise SystemExit('local-link signature anchor missing')
text = text.replace(old_local_sig, new_local_sig, 1)
old_local_target = """  const targetName = requiredString(link.target, 'localLink.target');
  const port = optionalFiniteNumber(link.port, 'localLink.port');
  const linkTarget = target('service', port === null ? targetName : `${targetName}:${port}`);
"""
new_local_target = """  const targetName = requiredString(link.target, 'localLink.target');
  const port = optionalFiniteNumber(link.port, 'localLink.port');
  const linkTarget = allowAddresses ? target('service', port === null ? targetName : `${targetName}:${port}`) : null;
"""
if old_local_target not in text:
    raise SystemExit('local-link target anchor missing')
text = text.replace(old_local_target, new_local_target, 1)
old_call = "  mapLocalLink(facts, report.root.localLink, observedAt);"
new_call = "  mapLocalLink(facts, report.root.localLink, observedAt, allowLocalAddresses);"
if old_call not in text:
    raise SystemExit('local-link call anchor missing')
text = text.replace(old_call, new_call, 1)
adapter.write_text(text)

contract = Path('scripts/network-diagnostics-ingestion-contract-check.mjs')
text = contract.read_text()
for old, new in [
    ("route-0-0-0-0-0-gateway", "route-0-0-0-0-0-0-gateway"),
    ("route-0-0-0-0-0-family", "route-0-0-0-0-0-0-family"),
]:
    text = text.replace(old, new)
old_privacy = """  'route-0-0-0-0-0-0-gateway',
  'trace-hop-1-address',
"""
new_privacy = """  'route-0-0-0-0-0-0-gateway',
  'route-0-0-0-0-0-0-family',
  'trace-hop-1-address',
"""
if old_privacy not in text:
    raise SystemExit('privacy route anchor missing')
text = text.replace(old_privacy, new_privacy, 1)
old_after_privacy = """assert.equal(privacyIds.has('gateway-ping-median-ms'), true, 'gateway timing remains useful even when gateway address is withheld');
assert.equal(privacySnapshot.warnings.some((line) => line.includes('Local address-valued facts are withheld')), true);
"""
new_after_privacy = """assert.equal(privacyIds.has('route-0-family'), true, 'route semantics remain inspectable with the destination prefix withheld');
assert.equal(factById('local-link-download')?.target?.value, 'nas.local:5201');
assert.equal(privacySnapshot.facts.find((candidate) => candidate.id === 'local-link-download')?.target, null, 'LAN target identity must be withheld with local addresses');
assert.equal(privacyIds.has('gateway-ping-median-ms'), true, 'gateway timing remains useful even when gateway address is withheld');
assert.equal(privacySnapshot.warnings.some((line) => line.includes('Local address-valued facts are withheld')), true);
"""
if old_after_privacy not in text:
    raise SystemExit('privacy post-anchor missing')
text = text.replace(old_after_privacy, new_after_privacy, 1)
contract.write_text(text)
