from pathlib import Path
p=Path('src/builder/enterprise.ts')
text=p.read_text()
text=text.replace("import { builderStpState, type BuilderStpState } from './stp.ts';", "import { builderStpState, type BuilderStpState } from './stp.ts';\nimport { builderEthernetPathForVlan } from './ethernet.ts';",1)
text=text.replace("  builderEthernetPathForVlan,\n} from './ethernet.ts';", "} from './ethernet.ts';",1)
p.write_text(text)
