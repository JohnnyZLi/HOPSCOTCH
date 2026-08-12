# Lab 09E — Measured evidence sidecars

Lab 09E reuses validated `LOCAL MEASURED` facts inside existing Journey semantic phases without allowing those facts to become simulated Journey truth.

The integration is intentionally one-way:

```text
validated measured snapshot
          ↓
 measured scene compatibility
          ↓
 optional evidence sidecar

Journey config → canonical events → reducer → SemanticScene
                (unchanged)
```

Measured evidence never enters the Journey builder, modifier pipeline, event log, reducer, or semantic scene props.

## Target compatibility first

Before UI integration, 09E adds a pure compatibility model with three outcomes:

- `MATCHED TARGET`
- `LOCAL CONTEXT`
- `OTHER TARGET`

The matcher imports no Journey code. Callers provide only the active semantic scene, simulated hostname, and simulated documentation destination address.

### Routing

- a specific IPv4 prefix containing the simulated destination may be `MATCHED TARGET`
- the default route `0.0.0.0/0` stays `LOCAL CONTEXT`; it is not proof of the simulated forwarding path
- interface/untargeted facts are `LOCAL CONTEXT`
- unrelated prefixes/hosts are `OTHER TARGET`

### DNS

- exact hostname/service-host matches may be `MATCHED TARGET`
- resolver-IP facts are `LOCAL CONTEXT`; the resolver is not the destination
- other host/service targets are `OTHER TARGET`

### Transport

- exact hostname/service host or exact destination IP may be `MATCHED TARGET`
- interface/untargeted observations remain `LOCAL CONTEXT`
- category equality alone never creates a target match
- throughput measured against another service such as `speed.example.test` remains `OTHER TARGET` for an `example.test` Journey

Ambiguous or malformed target forms fail closed to `OTHER TARGET`.

## Session-only evidence slot

The measured workspace originally owned its imported state locally. To make measured context available after navigating to other labs, Lab 09E lifts only the validated 09B `MeasuredSnapshotState | null` into `App` memory.

The slot contains no raw report bytes, filename, Journey configuration, events, modifiers, reducer state, or persistence key.

Lab 09 remains the import/clear surface. A successful 09C import replaces the session slot; invalid replacements do not. Clear removes it everywhere. Reload clears it because no browser persistence is added.

## Journey sidecar boundary

The Journey receives measured state only as an optional presentation prop. The existing `SemanticScene` call remains driven solely by:

- simulated `JourneyState`
- simulated hostname
- simulated documentation destination address

A separate `MeasuredEvidenceSidecar` reads the measured slot and compatibility model. It appears only during routing, DNS, or transport phases with relevant measured facts.

The sidecar reserves its own visual space beneath the semantic scene rather than drawing over or modifying the simulated route/DNS/transport visualization.

## Sidecar language

Every sidecar states:

- `LOCAL MEASURED`
- compatibility: `MATCHED TARGET`, `LOCAL CONTEXT`, or `OTHER TARGET`
- capture freshness
- `LOCAL HOST · NOT GLOBAL`
- explicit fact target
- `SIMULATED STORY UNCHANGED`

At most a few high-priority measured facts are shown. Other-target facts remain counted but hidden rather than being mixed into the active target evidence.

If only mismatched measured targets exist, the sidecar shows a compact mismatch notice instead of displaying their values as if they support the current Journey.

## Validation boundary

The pure compatibility contract proves normalization/matching behavior and that evidence classification leaves a composed QUIC Journey plus reducer state deep- and byte-identical.

The permanent session/sidecar source passes the full TypeScript, existing model/regression, native-measurement, measured-workspace, measured-scene, session-boundary, and production-build gate. `SemanticScene` remains simulation-only in source while the separate sidecar receives optional measured presentation state.

The permanent compatibility-only Chrome profiler now exercises a cross-lab flow: import a real report through Lab 09, exit into Journey, validate routing `LOCAL CONTEXT`, DNS/transport `MATCHED TARGET`, change to a mismatched hostname and require `OTHER TARGET` with measured values hidden, then Clear in Lab 09 and require the Journey sidecar to disappear. The same flow enforces horizontal-overflow and document-scroll invariants on desktop, exact 390 px mobile, and reduced motion under Chrome default, SwiftShader, and WebGL-disabled modes. Firefox/Gecko remains green through the existing semantic compatibility runner.

### Exact production-artifact audit

Clean source head `9511bea` produced CI artifact `hopscotch-dist` with digest `sha256:937dda6fc056df0a7fbdb4e22a71780d03abd0eef392452c8fa42163d7d4fc87`.

The exact built Vite HTML/CSS/JS bytes were audited directly in Linux Chromium rather than through a dev server:

- desktop 1440: routing sidecar = `LOCAL CONTEXT`; DNS/transport = `MATCHED TARGET`; mismatched transport = `OTHER TARGET`; zero horizontal overflow and runtime errors
- exact 390 px mobile: sidecar stacks below the semantic scene without horizontal overflow; matched values remain readable; mismatch exposes no measured values
- reduced-motion 1280: the same local/matched/mismatch classifications render synchronously with `scrollWidth === innerWidth`, `scrollY === 0`, and zero runtime errors
- the measured speed-test target remains hidden from the `example.test` Journey transport sidecar
- mismatch language explicitly says the measured facts remain separate from the active hostname
- `SIMULATED STORY UNCHANGED` remains visible in all three compatibility states

The local Playwright screenshot driver may scroll the document when it must bring an off-screen mobile causal-rail button into view before clicking it; that driver-induced scroll is not product auto-follow. The permanent CDP compatibility runner clicks events without browser scroll-into-view and independently enforces `scrollY === 0` for routing, DNS, transport, mismatch, and cleared-Journey states.

## Shared architecture state

ROADMAP, ARCHITECTURE, and README are synchronized to the implemented behavior. The measured/native roadmap now marks target-scoped reuse inside existing semantic scenes complete. The remaining native direction is optional local transport/discovery that must feed the same validated Network Diagnostics → native measurement → measured-state path.

## Still out of scope

- automatic localhost discovery/transport
- live polling/background collection
- measured facts inserted into canonical Journey events
- drawing a continuous measured route from separate diagnostic targets
- declaring measured/public/simulated sources globally agree or disagree

The final merge gate is one ordinary read-only CI + Performance + Compatibility pass on this exact permanent tree.