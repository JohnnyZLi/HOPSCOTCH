import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(text, before, after, label) {
  const index = text.indexOf(before);
  if (index < 0) throw new Error(`Track D integration marker not found: ${label}`);
  if (text.indexOf(before, index + before.length) >= 0) throw new Error(`Track D integration marker is ambiguous: ${label}`);
  return `${text.slice(0, index)}${after}${text.slice(index + before.length)}`;
}

const applicationPath = 'src/builder/application.ts';
let application = readFileSync(applicationPath, 'utf8');
application = replaceOnce(
  application,
  "    const transportProfile = raw.kind === 'https' ? (raw.transportProfile === 'quic-h3' ? 'quic-h3' : 'tcp-h2') : raw.transportProfile === 'quic-h3' ? 'quic-h3' : raw.transportProfile === 'tcp-h2' ? 'tcp-h2' : null;",
  "    const transportProfile: JourneyTransportProfile | null = raw.kind === 'https' ? (raw.transportProfile === 'quic-h3' ? 'quic-h3' : 'tcp-h2') : raw.transportProfile === 'quic-h3' ? 'quic-h3' : raw.transportProfile === 'tcp-h2' ? 'tcp-h2' : null;",
  'Journey transport literal type',
);
application = replaceOnce(
  application,
  "          const destinationResolution = resolveBuilderArp(destinationAccess.config, destinationAccess.routerId, destinationAccess.vlanId, destinationAddress, arpCache); arpCache = destinationResolution.cache; l2.destinationResolution = destinationResolution.resolution;",
  "          const destinationResolution = resolveBuilderArp(destinationAccess.config, destinationAccess.routerId, destinationAccess.vlanId, destinationAddress as string, arpCache); arpCache = destinationResolution.cache; l2.destinationResolution = destinationResolution.resolution;",
  'ARP destination address narrowing',
);
writeFileSync(applicationPath, application);

const builderPath = 'src/NetworkBuilder.tsx';
let builder = readFileSync(builderPath, 'utf8');
builder = replaceOnce(
  builder,
  "import { BuilderTimeMachine } from './BuilderTimeMachine.tsx';",
  "import { BuilderTimeMachine } from './BuilderTimeMachine.tsx';\nimport { BuilderApplicationPanel } from './BuilderApplicationPanel.tsx';",
  'BuilderApplicationPanel import',
);
builder = replaceOnce(
  builder,
  'sourceId, destinationId, layout, selectedNodeId, selectedLinkId, ethernetSourceId',
  'sourceId, destinationId, layout, linkProfiles, selectedNodeId, selectedLinkId, ethernetSourceId',
  'render-state link profiles',
);
const panel = `          {!stressLabel&&<BuilderApplicationPanel\n            context={{ graph, addressing, routing, ethernet, linkProfiles, acl, nat, natSessions, dhcp, dhcpLeases, dhcpSequence, ipv6, ipv6ControlState, ipv6RoutingDepth, arpCache }}\n            sourceNodeId={sourceId}\n            historical={isHistorical}\n            onSessionState={(next)=>{ setArpCache(next.arpCache); setNatSessions(next.natSessions); setDhcpLeases(next.dhcpLeases); setIpv6ControlState(next.ipv6ControlState); }}\n            onMessage={setMessage}\n          />}\n`;
const ethernetMarker = '          <div className={`builder-ethernet-stage';
const ethernetIndex = builder.indexOf(ethernetMarker);
if (ethernetIndex < 0) throw new Error('Track D integration marker not found: Ethernet stage');
if (builder.includes('data-track-d="shared-application-transaction"')) throw new Error('Track D application panel appears to be integrated already.');
builder = `${builder.slice(0, ethernetIndex)}${panel}${builder.slice(ethernetIndex)}`;
writeFileSync(builderPath, builder);

const packagePath = 'package.json';
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
pkg.scripts['test:builder-application-contract'] = 'node scripts/builder-application-contract-check.mjs';
const dhcpToken = 'npm run test:builder-dhcp-contract';
if (!pkg.scripts.check.includes('test:builder-application-contract')) {
  if (!pkg.scripts.check.includes(dhcpToken)) throw new Error('Track D integration marker not found: package check DHCP token');
  pkg.scripts.check = pkg.scripts.check.replace(dhcpToken, `${dhcpToken} && npm run test:builder-application-contract`);
}
writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log('Track D integration patch applied: type fixes, Builder product surface, and permanent contract registration.');