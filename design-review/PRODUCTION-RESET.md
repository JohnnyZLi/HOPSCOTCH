# Complete presentation replacement

The approved design is the complete composition from Site source commit
`f59853c13d950c2268044ff37b79ae145bd2477f`. The previous implementation hid
its header, title, controls, and disclosures inside the legacy app. That
integration is superseded by this reset.

`src/main.tsx` loads only the new app foundation and reviewed composition styles.
`src/App.tsx` owns canonical routes and paused Journey return context. It mounts
complete lifecycle, Builder, evidence, and connected entry compositions.
The earlier UI components and stylesheet layers are outside the production
import graph. They are not mounted, overlaid, or shipped as a second UI.

The generator compiles the approved source with production bindings. Protocol
and Journey frames come from the current deterministic engines. Packet bytes
and checksums come from `buildPacket`; Builder edits use current validators,
probes, and canonical history. Captures use the existing worker parser. Evidence
starts empty and acquires an explicit local import or API snapshot. The reference
Site and its reference fixtures remain separate from the production app.

Browser validation follows the replacement's actual controls and complete
compositions. It retains the required Chrome GPU, Firefox, replay, viewport,
Journey, and performance gates. The existing versioned performance budgets
are unchanged. Tests of canonical protocol, scenario, capture, and measurement
models remain in the contract suite.
