from pathlib import Path
p=Path('src/builder/ethernet.ts')
text=p.read_text()
text=text.replace("import { builderStpState, cloneBuilderStpConfig, createDefaultBuilderStpConfig, validateBuilderStpConfig, type BuilderStpConfig } from './stp.ts';", "import { builderStpState, createDefaultBuilderStpConfig, validateBuilderStpConfig, type BuilderStpConfig } from './stp.ts';",1)
start=text.index('function cloneInterface(')
end=text.index('\n\nexport function createEmptyBuilderEthernetConfig',start)
replacement="export function cloneBuilderEthernetConfig(config: BuilderEthernetConfig): BuilderEthernetConfig {\n  return structuredClone(config);\n}"
text=text[:start]+replacement+text[end:]
p.write_text(text)
