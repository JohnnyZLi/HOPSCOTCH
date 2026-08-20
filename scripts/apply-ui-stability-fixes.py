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
    '  right: max(32px, calc((100vw - min(1500px, calc(100vw - 64px))) / 2));\n  bottom: 112px;\n  width: min(330px, calc(100% - 64px));',
    '  right: max(206px, calc((100vw - min(1500px, calc(100vw - 64px))) / 2 + 174px));\n  bottom: 112px;\n  width: min(330px, calc(100% - 64px));',
)

replace_once(
    'src/JourneyTheater.css',
    '.journey-stage-meta{display:flex;gap:28px;padding:11px 14px;border-bottom:1px solid rgba(255,255,255,.065);background:rgba(4,8,12,.56)}.journey-stage-meta>div{display:grid;gap:3px}.journey-stage-meta strong{color:#d1dde2;font-size:.6rem;letter-spacing:.055em}',
    '.journey-stage-meta{display:flex;gap:28px;padding:11px 14px;border-bottom:1px solid rgba(255,255,255,.065);background:rgba(4,8,12,.56)}.journey-stage-meta>div{display:grid;flex:1 1 0;min-width:0;gap:3px}.journey-stage-meta>div:first-child{flex:0 0 8.6rem}.journey-stage-meta strong{overflow:hidden;text-overflow:ellipsis;color:#d1dde2;font-size:.6rem;letter-spacing:.055em;white-space:nowrap}.journey-stage-meta>div:first-child strong{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}',
)

replace_once(
    'package.json',
    '&& npm run test:scenario-gallery-contract && npm run test:product-integration-contract && npm run build',
    '&& npm run test:scenario-gallery-contract && npm run test:product-integration-contract && npm run test:ui-stability-contract && npm run build',
)

replace_once(
    'package.json',
    '    "test:product-integration-contract": "node scripts/product-integration-contract-check.mjs"\n',
    '    "test:product-integration-contract": "node scripts/product-integration-contract-check.mjs",\n    "test:ui-stability-contract": "node scripts/ui-stability-contract-check.mjs"\n',
)
