from pathlib import Path

path = Path('src/builder/scenario-compare.ts')
text = path.read_text()
old_type = "export type BuilderScenarioConfigurationSnapshot = Pick<\n  BuilderScenario,\n  (typeof BUILDER_SCENARIO_CONFIGURATION_FIELDS)[number]\n>;"
new_type = "export type BuilderScenarioConfigurationSnapshot = Omit<Pick<\n  BuilderScenario,\n  (typeof BUILDER_SCENARIO_CONFIGURATION_FIELDS)[number]\n>, 'services'> & { services?: BuilderScenario['services'] };"
if old_type in text:
    text = text.replace(old_type, new_type, 1)
elif new_type not in text:
    raise RuntimeError('scenario compare snapshot type anchor missing')
old_projection = "    ipv6: snapshot.ipv6,\n    sourceId: snapshot.sourceId,"
new_projection = "    ipv6: snapshot.ipv6,\n    services: snapshot.services ?? [],\n    sourceId: snapshot.sourceId,"
if old_projection in text:
    text = text.replace(old_projection, new_projection, 1)
elif new_projection not in text:
    raise RuntimeError('scenario compare projection anchor missing')
path.write_text(text)
print('Normalized optional authoring hosted services in scenario comparison.')
