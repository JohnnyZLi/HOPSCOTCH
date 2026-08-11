from pathlib import Path

path = Path('scripts/performance-profile.mjs')
text = path.read_text()

def replace_once(old: str, new: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f'missing performance harness patch anchor: {old[:140]!r}')
    text = text.replace(old, new, 1)

replace_once(
    "  const storageShim = `<script>(()=>{try{sessionStorage.setItem('__hopscotch_perf__','1');sessionStorage.removeItem('__hopscotch_perf__')}catch{const values=new Map();Object.defineProperty(window,'sessionStorage',{configurable:true,value:{getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),clear:()=>values.clear()}})}})();<\\/script>`;\n  const inlineScript = `<script type=\"module\">${script.toString('utf8').replaceAll('</script>', '<\\\\/script>')}<\\/script>`;\n  const inlineStyle = `<style>${css.toString('utf8').replaceAll('</style>', '<\\\\/style>')}</style>`;\n  html = html\n    .replace(scriptMatch[0], `${storageShim}${inlineScript}`)\n    .replace(cssMatch[0], inlineStyle)\n    .replace(/<link\\b[^>]*\\brel=\"icon\"[^>]*>/i, '');\n  return {\n    html,\n    bundle:",
    "  const scriptText = script.toString('utf8');\n  const inlineStyle = `<style>${css.toString('utf8').replaceAll('</style>', '<\\\\/style>')}</style>`;\n  html = html\n    .replace(scriptMatch[0], '')\n    .replace(cssMatch[0], inlineStyle)\n    .replace(/<link\\b[^>]*\\brel=\"icon\"[^>]*>/i, '');\n  return {\n    html,\n    scriptText,\n    bundle:",
)
replace_once(
    'async function loadProfile(cdp, productionHtml, profile) {',
    'async function loadProfile(cdp, artifact, profile) {',
)
replace_once(
    "  await cdp.call('Page.setDocumentContent', { frameId, html: productionHtml });\n  await waitForExpression(cdp, 'Boolean(document.querySelector(\".journey-workspace\"))');",
    "  await cdp.call('Page.setDocumentContent', { frameId, html: artifact.html });\n  await cdp.evaluate(`(()=>{try{sessionStorage.setItem('__hopscotch_perf__','1');sessionStorage.removeItem('__hopscotch_perf__')}catch{const values=new Map();Object.defineProperty(window,'sessionStorage',{configurable:true,value:{getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),clear:()=>values.clear()}})}})()`);\n  await cdp.evaluate(artifact.scriptText);\n  await waitForExpression(cdp, 'Boolean(document.querySelector(\".journey-workspace\"))');",
)
replace_once(
    'async function seekStress(cdp, productionHtml) {',
    'async function seekStress(cdp, artifact) {',
)
replace_once(
    '  await loadProfile(cdp, productionHtml, profile);',
    '  await loadProfile(cdp, artifact, profile);',
)
replace_once(
    '    for (const profile of profiles) report.profiles.push(await loadProfile(cdp, artifact.html, profile));\n    report.seekStress = await seekStress(cdp, artifact.html);',
    '    for (const profile of profiles) report.profiles.push(await loadProfile(cdp, artifact, profile));\n    report.seekStress = await seekStress(cdp, artifact);',
)

path.write_text(text)
