# Home introduction

The home screen introduces the product through one interactive IPv4 packet, then offers a primary **Explore a request** action and a secondary **Build a network** link. The primary action enters the existing Journey workspace; its label describes exploration without promising automatic playback. Shared navigation uses the same plain-language destinations on desktop and mobile.

The packet is built with `buildPacket(defaultPacketConfig)`. Addresses, protocol, TTL, byte length, and transport port come from that model, and the example is explicitly labelled simulated. Selecting a field explains its role without creating another simulation or clock.

The packet uses the approved shared painter and shader. `review:build` generates the mountable painter from those sources and records it in the integrity manifest. Field buttons share the packet material rather than receiving separate glass surfaces. The wallpaper stays visible, with lower intensity behind readable home content; workspace materials remain unchanged.

Fold geometry comes from the rendered heading, content, padding, and available width. The frame reserves its expanded height so folding does not move the primary action. Hidden fields are inert, focus returns to the toggle when necessary, reduced motion settles immediately, and listeners, observers, animation frames, and graphics contexts belong to the mounted runtime scope.

Desktop uses a single-line headline when space permits. Narrow screens keep two lines and smaller field values at the smallest supported width, allowing example addresses to remain intact. Main actions are visually separate links rather than a selected-looking segmented control.

The overview browser suite checks canonical field values, shared field material, selection, focus and inert state, measured fold settlement, stable action position, reduced motion, reversal, Journey handoff, and remounting. Its viewport matrix covers both themes at 1440, 1280, 1024, 390, and 320 pixels. Human visual review additionally checks the live browser at desktop, laptop, and phone sizes before release.
