# Public design review

The complete October 10 candidate is served at `/review/`. The four studies are
isolated static pages, alongside the current React application. Their editable
source, canonical fixture bundles, and historical audit material are in `source/`.
They are design studies, with reference projections still awaiting integration.

## Build and edit

- Edit the HTML, CSS, and JS under `source/complete-review/`.
- Run `npm run review:build` (Python 3, standard library only).
- Run `npm run review:check` and commit the source, generated `public/review/`
  pages, and `build-manifest.json` together.
- `npm run build` verifies the hashes before Vite copies the static pages. The
  Cloudflare production build needs only its existing Node toolchain.
- `/review/viewport.html` hosts each actual page at selectable CSS viewport
  widths/heights. It preserves the same iframe when resized. This is a browser
  layout inspection aid, not physical phone, touch, or Safari emulation.

The Python assembler also writes local fragment intermediates to `dist/` for
the existing synthetic tests. Run these from `design-review/source/` after a build:

```sh
node complete-review/check-source-semantics.mjs
node complete-review/check-network-framing.mjs
node complete-review/check-bounded-composition.mjs
node complete-review/check-composition-motion.mjs
node complete-review/check-related-motion.mjs
```

Historical scripts/receipts are preserved for provenance. Some contain original
workspace paths and should not be mistaken for current portable automation or
browser acceptance. Tests using the synthetic DOM do not prove rendered layout,
glyph placement, or compositor behavior.

## Provenance and rollout

- Production baseline: `be21750003cf3c097c917ae4340c78a0035ccbc6`.
- Candidate source: private review commit
  `f59853c13d950c2268044ff37b79ae145bd2477f`.
- The four assembled fragments match that candidate byte for byte at import.
- The user authorized public `/review` publication on October 11, 2026. This
  supersedes the old private-preview-only instruction in the archived candidate
  note. It does not establish visual acceptance or replace the main application.
- Use the repository's existing PR → required checks → main → Cloudflare
  Workers Builds workflow. No additional deployment mechanism is introduced.
- To roll back this isolated review publication, revert its merge commit through
  the same workflow. The main application and API logic are not changed here.

## Acceptance work

1. Visually inspect TCP/TLS construction, source-glyph scanning, retained values,
   release, and final states in light/dark at 320/390/1024/1440 CSS pixels.
2. Exercise pause/disclosures, interrupted playback, seek/replay, long TLS values,
   and height changes; fix observed issues and record screenshots.
3. Finish Journey/DNS operation semantics, GRE/MPLS persistent inner-packet
   identity, and Connected workspace controls/canonical selection returns.
4. Audit Builder attachments, arrows, titles, dense records, and transitions.
5. Integrate reusable verified presentation into the real application while
   preserving editors, modifiers, sharing, sidecars, scenario branches, evidence
   bytes, event identity, and canonical time.
6. Run the required production checks plus the visual matrix. Record physical
   Safari/iPhone, assistive-technology, hardware-performance, and owner acceptance
   separately. Replace the default experience only after acceptance.

The source-semantics contract also runs in `npm run check`. It verifies that local
TCP/TLS presentations use canonical state and preserve the complete source.

The live review is the visual inspection surface. The historical private Site
remains a recovery reference until the migration has been accepted.
