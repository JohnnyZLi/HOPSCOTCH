# Desktop workspace composition study — 26 October 2026

The owner rejected the desktop composition after the narrow-column production trial and asked for competing visual sketches, actual browser inspection, and repeated refinement. This study is separate from production. The accepted mobile layout, packet renderer, scanner, simulation and clocks have not been modified.

## Selected arrangement

Use a broad scene with a quieter inspector beside it. The scene owns the physical object and the two current endpoints. The inspector owns the current event, explanation, retained request facts, source disclosure and full inspection disclosure. Playback belongs directly under the scene and stays visible while either field collection or inspector content grows.

The request control and shared navigation stay in their established top-level positions. There is no outer dashboard card, stack of unrelated white panels, chapter sidebar, or additional simulated metric. Wallpaper remains continuous behind the workspace. In production, the existing optical renderer would be retained; the CSS glass in this sketch is illustrative.

## Comparison and refinements

1. Compared a scene/right-inspector arrangement against a full-width canvas with a lower explanation strip, using both a two-field application state and the nine-field IPv4/Ethernet stack.
2. Rejected the full-width canvas. Moving the same supporting information below the scene consumed the laptop's reading height. Even after a bounded-field revision, the full packet lost more visible rows and its trailer crowded the information strip. The narrow production stack also fails to use desktop width effectively.
3. Bounded the selected scene using the remaining viewport height. Measured envelope, heading and payload chrome determine the field viewport. Large field collections scroll internally; complete initial rows are selected from measured row boundaries. Header, separate Ethernet/FCS pieces and transport remain visible.
4. Replaced the sketch's default range styling with a quiet custom track and small thumb. Kept preview control state and speed labels consistent.
5. Widened the compact desktop inspector, preserved packet value text size, quieted its scrolling treatment, and removed duplicate provenance. Corrected the review bar's dark-theme contrast and anchored the request popover to the actual control bounds.
6. Rechecked the chosen arrangement with short intent, full packet and retained result states; Light/Dark; opened disclosures; and desktop frames at 1024×768, 1280×800, 1363×936 and 1728×1080.

## Review boundary

Source: `design-review/sketches/desktop-workspace.html` and its sibling JavaScript. The browser study has three representative states and optional preview cycling. Its intervals are review conveniences, not canonical playback timing. Source/disclosure prose is schematic. The displayed examples are synthetic.

The next implementation should adapt the existing measured composition controller to these ownership boundaries, rather than porting the sketch's placeholder state machine. Preserve source event identities, exact values, material optics, shared reading geometry and accepted motion. Use measured readable minima to decide when the inspector must become an exclusive pane; do not squeeze the packet or invent event-specific geometry.

This is the recommended visual candidate following the recorded comparison, not a claim of subjective perfection or owner acceptance. No production deployment is part of this sketch task.
