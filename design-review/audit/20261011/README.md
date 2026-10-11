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

## Implemented repairs, pending deployed visual recheck

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
