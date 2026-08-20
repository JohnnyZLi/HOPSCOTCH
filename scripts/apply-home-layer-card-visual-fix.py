from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one anchor, found {count}: {old!r}")
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    'src/styles.css',
    '''  right: max(206px, calc((100vw - min(1500px, calc(100vw - 64px))) / 2 + 174px));\n  bottom: 112px;\n  width: min(330px, calc(100% - 64px));\n  padding: 20px;''',
    '''  right: max(206px, calc((100vw - min(1500px, calc(100vw - 64px))) / 2 + 174px));\n  top: 50%;\n  bottom: auto;\n  width: min(330px, calc(100% - 64px));\n  padding: 20px;\n  translate: 0 -50%;''',
)

replace_once(
    'src/styles.css',
    '''  .layer-card {\n    bottom: 88px;\n  }''',
    '''  .layer-card {\n    top: 122px;\n    bottom: auto;\n    translate: 0;\n  }''',
)

replace_once(
    'scripts/ui-stability-contract-check.mjs',
    '''assert.ok(\n  styles.includes('right: max(32px, calc((100vw - min(1500px, calc(100vw - 64px))) / 2));'),\n  'scale rail must retain the canonical viewport/content gutter anchor',\n);\n''',
    '''assert.ok(\n  styles.includes('right: max(32px, calc((100vw - min(1500px, calc(100vw - 64px))) / 2));'),\n  'scale rail must retain the canonical viewport/content gutter anchor',\n);\nassert.ok(\n  styles.includes('top: 50%;\\n  bottom: auto;'),\n  'overview layer card must live in the scale-inspector vertical lane instead of the launch-card row',\n);\nassert.ok(\n  styles.includes('translate: 0 -50%;'),\n  'overview layer card must center against the scale rail without competing with Motion transforms',\n);\nassert.ok(\n  styles.includes('.layer-card {\\n    top: 122px;\\n    bottom: auto;\\n    translate: 0;'),\n  'short desktop layouts must pin the layer card above the compact launch deck',\n);\n''',
)

replace_once(
    'scripts/ui-stability-contract-check.mjs',
    "console.log('UI stability contract passed: overview scale/card lanes are separated and Journey timer metadata cannot reflow adjacent cells.');",
    "console.log('UI stability contract passed: overview scale/card lanes are separated vertically and horizontally, and Journey timer metadata cannot reflow adjacent cells.');",
)
