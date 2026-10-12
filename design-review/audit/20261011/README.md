# Public review audit — 11 October 2026

Baseline: production commit `15e18034a09174c9f043595235b51242e667e34d`,
published through PR #199. Inspection used live Chrome on the public `/review`
pages. The viewport page supplies actual CSS widths/heights through the same
iframe, preserving the document during resize. This is desktop Chrome, not a
physical phone or Safari test. Moving screenshots are samples with gaps.

## Observations

- Desktop TCP shows the packet, playback, and retained ACK/expected-byte values
  together. In the 390 × 844 light run, the SYN/ACK value visibly travels into
  the labelled retained dock.
- Opening the narrow explanation pauses playback. The observed source event
  and phase remain stable while the explanation is read.
- A paused 390 → 320 resize preserves `data-5` at 2000 ms. Active resizing can
  move the console title above the visible viewport; the source event continues.
- At 320 × 640, the fixed minimum reader height can push the bottom of the card
  outside the frame. The common font stays legible, but the composition needs
  to derive its minimum from the actual lens and text geometry.
- Narrow dark TLS shows the reader camera advancing through ClientHello's long
  cipher list. The skinny lens follows the displayed source text, and the
  certificate/application-state dock stays visible. The 1024-pixel light run
  shows the complete dense card beside playback.
- TCP's local fast-recovery event displays Sequence / Acknowledgment / Flags /
  Data length and scans “Reno · illustrated”, hiding the actual threshold change.
  See `tcp-congestion-before.jpg`.
- TLS completion displays Protection: local / Actor: local / Phase: complete.
  Its dock says valid / Ready, but the final object does not explain the channel
  outcome. See `tls-outcome-before.jpg`.

Immediate screenshots after actions sometimes contain the previous compositor
frame even when the accessibility tree has updated. Settled follow-up images
were used before classifying a persistent defect.

## Implemented repairs — deployed in PR #200

- Data-driven state-field formatting uses consecutive canonical TCP states to
  show actual congestion-window/threshold transitions and recovery phase.
  The reader targets changed fields; wire packets retain wire fields.
- TLS local operations show certificate/key-schedule state. The final card shows
  application readiness, server certificate state, and negotiated application
  protocol. Negotiated cipher/group and the symbolic key classes/transcript
  remain available in the full state disclosure.
- The bounded reader minimum derives from the measured lens, line height, and
  card padding. It does not reduce the common font.
- Active viewport resize realigns the composition after the existing event/phase
  remapping, keeping playback and its destinations visible together.
- A source-semantics contract verifies actual before/after state values, meaningful
  local fields, valid read targets, and complete source immutability at four widths.
  It runs in the normal application validation command.

No source event, state, timestamp, packet byte, or canonical fixture bundle was
edited. This focused audit does not establish acceptance for all workspaces,
scenario variants, continuous frames, Safari, physical devices, or accessibility.

## Deployed recheck

Production commit: `a52479111b0598e46fd8f4d68ab798c98a5618ae`. All required
GitHub checks and the Cloudflare production build succeeded. Live observations:

- The 390-pixel light TCP fast-recovery card now shows 6 MSS cwnd and the actual
  12 MSS → 3 MSS threshold change. The reader follows the changed source fields.
- The 320 × 640 dark retransmit view fits its controls, retained-state dock, and
  bounded source-glyph reader. The common field font remains unchanged.
- Active resize from 320 × 640 to 390 × 844 keeps the composition top within
  one CSS pixel of the viewport top; the source sequence continues through
  recovery and forward progress.
- The final 390 × 844 dark TLS card shows Application traffic: Ready, Server
  certificate: Valid, Application protocol: h2, while retaining the channel dock.
  It stays visible when playback completes. See `tls-outcome-after.jpg`.
- Opening the full-state disclosure exposes TLS 1.3,
  TLS_AES_128_GCM_SHA256, X25519, symbolic key classes, and the exact transcript.

## Additional observations and Builder repair

The wider live pass reconfirmed two open design failures: Journey DNS wire events
are rendered as local metadata cards, and GRE replaces the visible inner packet
instead of enclosing it. MPLS still renders operation text without persistent
payload/label choreography. These are not accepted as complete integrations.

At 390 pixels, Builder's Frame network clips CLIENT and APP. Browser DOM bounds
confirm CLIENT spans x = −74.3…−6.3 and APP x = 394.9…449.3 inside a map spanning
x = 16…359. See `builder-frame-before.jpg`. The camera uses a fixed 0.85 minimum
zoom, which prevents an actual fit.

The prepared repair uses a reusable geometric frame for the full world and the
actual selected forwarding path, including routed connection points. Zoom out
respects that derived fit and cannot jump back to 0.85. Framing contracts verify
all relevant node corners and route points fit at four widths and preserve
configuration/history/device selection. Its deployed visual recheck is pending.

The migration smoke pass also loaded the narrow Evidence and Connected studies.
In Capture, selecting TCP and captured byte 47 (`02`) selects the SYN Flags field
while preserving frame #1 and all 54 captured bytes. In Connected, opening TCP
from Journey's SYN-ACK at 5320 ms and returning restores that exact event/time and
the Details pane. The companion still presents an independent model reference;
this does not establish full workspace integration.

## Builder production recheck — PR #201

Production commit: `d8f1c08be1bfa07a3bb0b771876718a5d1cc20c7`. All required PR
checks and the Cloudflare production build passed. The 390-pixel dark view now
contains all six devices. CLIENT spans x = 64.1…96.1 and APP x = 285.3…310.9,
inside the map's x = 16…359 bounds. The forwarding-path action fits its five
selected devices horizontally. Zoom in/out changes CLIENT's displayed width
41.67 → 36.23 px, so zoom out no longer jumps up to 0.85.

Two follow-ups were observed: the full-world fit includes unused padding and
produces a smaller overview than necessary; the forwarding button sits below
the map and can leave the framed scene above the visible page. The prepared
follow-up fits actual node corners/route points and explicitly brings the map
into view after either user framing action. Automatic entry framing does not
move the page. Overview labels still require zoom or device selection for
detailed inspection at narrow widths; this is not full usability acceptance.
