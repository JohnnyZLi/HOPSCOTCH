import fs from 'node:fs';

function replaceOnce(path, search, replacement) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, found ${count}: ${search.slice(0, 120)}`);
  fs.writeFileSync(path, source.replace(search, replacement));
}

const model = 'src/journey/model.ts';
const modifiers = 'src/journey/modifiers.ts';
const pkg = 'package.json';

replaceOnce(
  model,
  "import { applyJourneyModifiers } from './modifiers.ts';",
  "import { applyJourneyModifiers, impairmentProfileForModifiers } from './modifiers.ts';",
);

replaceOnce(
  model,
  "export type JourneyImpairmentProfile = 'clean' | 'single-loss' | 'latency-spike' | 'route-failure';",
  "export type JourneyModifierId = 'route-failure' | 'single-loss' | 'latency-spike';\nexport type JourneyImpairmentProfile = 'clean' | JourneyModifierId | 'composed';",
);

replaceOnce(
  model,
  "export interface JourneyScenarioConfig {\n  transportProfile: JourneyTransportProfile;\n  dnsProfile: JourneyDnsProfile;\n  impairmentProfile: JourneyImpairmentProfile;\n}",
  "export interface JourneyScenarioConfig {\n  transportProfile: JourneyTransportProfile;\n  dnsProfile: JourneyDnsProfile;\n  impairmentProfile: JourneyImpairmentProfile;\n  modifierIds?: JourneyModifierId[];\n}",
);

replaceOnce(
  model,
  "  impairmentProfile: JourneyImpairmentProfile;\n  appliedModifierIds: string[];",
  "  impairmentProfile: JourneyImpairmentProfile;\n  modifierIds: JourneyModifierId[];\n  appliedModifierIds: JourneyModifierId[];",
);

replaceOnce(
  model,
  "  impairmentProfile: JourneyImpairmentProfile;\n  impairmentState: JourneyImpairmentState;",
  "  impairmentProfile: JourneyImpairmentProfile;\n  modifierIds: JourneyModifierId[];\n  impairmentState: JourneyImpairmentState;",
);

replaceOnce(
  model,
  "  const modifierResult = applyJourneyModifiers(baseEvents, normalizedConfig);\n  const events = modifierResult.events;\n\n  return {\n    id: `url-journey:${hostname}:${normalizedConfig.transportProfile}:${normalizedConfig.dnsProfile}:${normalizedConfig.impairmentProfile}`,",
  "  const modifierResult = applyJourneyModifiers(baseEvents, normalizedConfig);\n  const events = modifierResult.events;\n  const modifierIds = modifierResult.appliedModifierIds;\n  const impairmentProfile = impairmentProfileForModifiers(modifierIds);\n  const impairmentKey = impairmentProfile === 'composed' ? modifierIds.join('+') : impairmentProfile;\n\n  return {\n    id: `url-journey:${hostname}:${normalizedConfig.transportProfile}:${normalizedConfig.dnsProfile}:${impairmentKey}`,",
);

replaceOnce(
  model,
  "    impairmentProfile: normalizedConfig.impairmentProfile,\n    appliedModifierIds: modifierResult.appliedModifierIds,",
  "    impairmentProfile,\n    modifierIds,\n    appliedModifierIds: modifierIds,",
);

replaceOnce(
  model,
  "  let impairmentState: JourneyImpairmentState = scenario.impairmentProfile === 'clean' ? 'clean' : 'armed';",
  "  let impairmentState: JourneyImpairmentState = scenario.modifierIds.length === 0 ? 'clean' : 'armed';",
);

replaceOnce(
  model,
  "    impairmentProfile: scenario.impairmentProfile,\n    impairmentState,",
  "    impairmentProfile: scenario.impairmentProfile,\n    modifierIds: scenario.modifierIds,\n    impairmentState,",
);

replaceOnce(
  modifiers,
  "  JourneyImpairmentProfile,\n  JourneyProvenance,",
  "  JourneyImpairmentProfile,\n  JourneyModifierId,\n  JourneyProvenance,",
);

replaceOnce(
  modifiers,
  "  appliedModifierIds: string[];",
  "  appliedModifierIds: JourneyModifierId[];",
);

replaceOnce(
  modifiers,
  "interface JourneyModifier {\n  id: string;\n  order: number;\n  appliesTo(profile: JourneyImpairmentProfile): boolean;\n  apply(events: JourneyEvent[], context: JourneyModifierContext): JourneyModifierResult;\n}",
  "interface JourneyModifier {\n  id: JourneyModifierId;\n  order: number;\n  apply(events: JourneyEvent[], context: JourneyModifierContext): JourneyModifierResult;\n}\n\nconst JOURNEY_MODIFIER_ORDER: readonly JourneyModifierId[] = ['route-failure', 'single-loss', 'latency-spike'];\nconst JOURNEY_MODIFIER_SET = new Set<JourneyModifierId>(JOURNEY_MODIFIER_ORDER);\n\nexport function normalizeJourneyModifierIds(values: readonly unknown[]): JourneyModifierId[] {\n  const selected = new Set<JourneyModifierId>();\n  for (const value of values) {\n    if (typeof value !== 'string' || !JOURNEY_MODIFIER_SET.has(value as JourneyModifierId)) {\n      throw new Error(`Unknown Journey modifier: ${String(value)}.`);\n    }\n    selected.add(value as JourneyModifierId);\n  }\n  return JOURNEY_MODIFIER_ORDER.filter((id) => selected.has(id));\n}\n\nexport function resolveJourneyModifierIds(config: JourneyScenarioConfig): JourneyModifierId[] {\n  if (config.modifierIds !== undefined) return normalizeJourneyModifierIds(config.modifierIds);\n  if (config.impairmentProfile === 'clean') return [];\n  if (config.impairmentProfile === 'composed') throw new Error('Composed Journey config requires modifierIds.');\n  return normalizeJourneyModifierIds([config.impairmentProfile]);\n}\n\nexport function impairmentProfileForModifiers(modifierIds: readonly JourneyModifierId[]): JourneyImpairmentProfile {\n  const normalized = normalizeJourneyModifierIds(modifierIds);\n  if (normalized.length === 0) return 'clean';\n  if (normalized.length === 1) return normalized[0];\n  return 'composed';\n}",
);

for (const oldLine of [
  "  appliesTo: (profile) => profile === 'single-loss',\n",
  "  appliesTo: (profile) => profile === 'route-failure',\n",
  "  appliesTo: (profile) => profile === 'latency-spike',\n",
]) {
  replaceOnce(modifiers, oldLine, '');
}

replaceOnce(
  modifiers,
  "    const { data, packetFrame } = requireResponseAnchors(events, 'latency-spike');\n    const addedDurationMs = 1200;\n    const shifted = shiftPostAnchor(events, packetFrame.atMs, addedDurationMs);\n    return {\n      events: [...shifted, ...latencyEvents(context.config.transportProfile, data.atMs)].sort((a, b) => a.atMs - b.atMs),",
  "    const { data, packetFrame } = requireResponseAnchors(events, 'latency-spike');\n    const recovered = events.find((current) => current.kind === 'transport.recovered');\n    const latencyBaseAtMs = recovered?.atMs ?? data.atMs;\n    const addedDurationMs = 1200;\n    const shifted = shiftPostAnchor(events, packetFrame.atMs, addedDurationMs);\n    return {\n      events: [...shifted, ...latencyEvents(context.config.transportProfile, latencyBaseAtMs)].sort((a, b) => a.atMs - b.atMs),",
);

replaceOnce(
  modifiers,
  "  let events = baseEvents.map((current) => ({ ...current }));\n  let addedDurationMs = 0;\n  const appliedModifierIds: string[] = [];\n\n  for (const modifier of modifiers) {\n    if (!modifier.appliesTo(config.impairmentProfile)) continue;",
  "  let events = baseEvents.map((current) => ({ ...current }));\n  let addedDurationMs = 0;\n  const appliedModifierIds: JourneyModifierId[] = [];\n  const selectedModifierIds = new Set(resolveJourneyModifierIds(config));\n\n  for (const modifier of modifiers) {\n    if (!selectedModifierIds.has(modifier.id)) continue;",
);

replaceOnce(
  modifiers,
  "  return { events, addedDurationMs, appliedModifierIds };\n}",
  "  if (new Set(events.map((event) => event.id)).size !== events.length) throw new Error('Journey modifiers produced duplicate event IDs.');\n  if (new Set(events.map((event) => event.atMs)).size !== events.length) throw new Error('Journey modifiers produced duplicate event timestamps.');\n  if (!events.every((event, index) => index === 0 || event.atMs > events[index - 1].atMs)) throw new Error('Journey modifier events must remain strictly ordered.');\n\n  return { events, addedDurationMs, appliedModifierIds };\n}",
);

const packageJson = JSON.parse(fs.readFileSync(pkg, 'utf8'));
if (packageJson.scripts['test:journey-composition-contract']) throw new Error('Composition contract script already exists.');
packageJson.scripts['test:journey-composition-contract'] = 'node scripts/journey-composition-contract-check.mjs';
packageJson.scripts.check = packageJson.scripts.check.replace(' && npm run build', ' && npm run test:journey-composition-contract && npm run build');
fs.writeFileSync(pkg, `${JSON.stringify(packageJson, null, 2)}\n`);

console.log('Applied Lab 07C modifier-set model refactor.');
