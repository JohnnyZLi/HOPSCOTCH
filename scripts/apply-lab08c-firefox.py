from pathlib import Path

path = Path('scripts/firefox-compatibility.mjs')
text = path.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f'missing Lab 08C Firefox patch anchor: {old[:180]!r}')
    text = text.replace(old, new, 1)


replace_once(
    "  let sessionId = null;\n  let bidi = null;",
    "  let sessionId = null;\n  let bidi = null;\n  let bidiContext = null;",
)
replace_once(
    "        await bidi.call('session.subscribe', { events: ['log.entryAdded'] });\n        report.bidiLogCapture = true;",
    "        await bidi.call('session.subscribe', { events: ['log.entryAdded'] });\n        const tree = await bidi.call('browsingContext.getTree');\n        bidiContext = tree.contexts?.[0]?.context ?? null;\n        if (!bidiContext) throw new Error('Firefox BiDi did not expose a top-level browsing context.');\n        report.bidiLogCapture = true;",
)
replace_once(
    "      await webdriver('POST', '/window/rect', { width: profile.width, height: profile.height, x: 0, y: 0 });\n      await webdriver('POST', '/url', { url: `about:blank${profile.query}` });",
    "      await webdriver('POST', '/window/rect', { width: profile.width, height: profile.height, x: 0, y: 0 });\n      if (bidi && bidiContext) {\n        await bidi.call('browsingContext.setViewport', { context: bidiContext, viewport: { width: profile.width, height: profile.height }, devicePixelRatio: 1 });\n      }\n      await webdriver('POST', '/url', { url: `about:blank${profile.query}` });",
)
replace_once(
    "      if (structural.scrollWidth > structural.innerWidth) throw new Error(`${profile.id} horizontally overflows: ${structural.scrollWidth} > ${structural.innerWidth}.`);",
    "      if (structural.innerWidth !== profile.width) throw new Error(`${profile.id} viewport width ${structural.innerWidth}; expected ${profile.width}.`);\n      if (structural.scrollWidth > structural.innerWidth) throw new Error(`${profile.id} horizontally overflows: ${structural.scrollWidth} > ${structural.innerWidth}.`);",
)

path.write_text(text)
