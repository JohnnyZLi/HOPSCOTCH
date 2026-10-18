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

The user approved the October 16 wallpaper homepage and its custom glass menus,
then authorized production deployment on October 17. `home-runtime.js`,
`home.html`, and `home.css` replace the connected entry screen at `/`. The
original Light/Dark wallpaper assets are local WebP files. Their refractive
edges sample the actual backdrop and share the packet material kernel and
context-recovery factory through generated `material-runtime.js`. The custom
appearance and collapsed navigation menus use one measured disclosure controller.
Appearance uses the existing persisted app preference; canonical workspace hrefs
also retain same-tab app navigation. Existing workspace models and controls are
unchanged. The overview browser gate checks both menus, header stability,
responsive bounds, keyboard dismissal, and Light/Dark/System behavior.
