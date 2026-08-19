from pathlib import Path

p = Path('src/BuilderAuthoringPanel.tsx')
s = p.read_text()
old = 'export function BuilderAuthoringPanel(props: BuilderAuthoringPanelProps) {'
new = 'export default function BuilderAuthoringPanel(props: BuilderAuthoringPanelProps) {'
if old not in s:
    raise SystemExit('BuilderAuthoringPanel export marker missing')
p.write_text(s.replace(old, new, 1))

p = Path('src/NetworkBuilder.tsx')
s = p.read_text()
old = "const BuilderAuthoringPanel = lazy(() => import('./BuilderAuthoringPanel.tsx').then((module) => ({ default: module.BuilderAuthoringPanel })));"
new = "const BuilderAuthoringPanel = lazy(() => import('./BuilderAuthoringPanel.tsx'));"
if old not in s:
    raise SystemExit('NetworkBuilder lazy authoring adapter marker missing')
p.write_text(s.replace(old, new, 1))

p = Path('scripts/builder-authoring-contract-check.mjs')
s = p.read_text()
needle = "assert.match(networkBuilderSource, /lazy\\(\\(\\) => import\\('\\.\\/BuilderAuthoringPanel\\.tsx'\\)/, 'the entire Track B authoring shell must remain outside the initial NetworkBuilder chunk');\n"
replacement = needle + "assert.doesNotMatch(networkBuilderSource, /BuilderAuthoringPanel\\.tsx'\\)\\.then/, 'the outer authoring lazy boundary must use the module default directly instead of shipping a startup adapter');\n"
if needle not in s:
    raise SystemExit('outer lazy contract marker missing')
p.write_text(s.replace(needle, replacement, 1))
