from pathlib import Path

path = Path('scripts/apply-track-j-dns-transport.py')
text = path.read_text()
text = text.replace("if(node.kind==='router'){\n\"", "if(node.kind==='router'){\\n\"")
text = text.replace(
    "replace_once(workbench,\n\"import type { BuilderAddressing } from './addressing.ts';\\n\",\n\"import type { BuilderAddressing } from './addressing.ts';\\nimport type { BuilderHostedService } from './application.ts';\\n\")",
    "replace_once(workbench,\n\"import type { BuilderApplicationTransaction } from './application.ts';\\n\",\n\"import type { BuilderApplicationTransaction, BuilderHostedService } from './application.ts';\\n\")",
)
path.write_text(text)
print('Repaired embedded Workbench quoting and import anchor in Track J helper.')
