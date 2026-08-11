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

## Current validation boundary

The pure compatibility contract proves normalization/matching behavior and that evidence classification leaves a composed QUIC Journey plus reducer state deep- and byte-identical.

The session/React integration is promoted only after the full TypeScript/model/regression/build suite accepts it. The temporary promotion run captures TypeScript diagnostics as an artifact on failure so integration errors are fixed against exact compiler output rather than by guesswork. Permanent source/browser contracts and exact production-artifact visual validation are added before merge.

## Still out of scope

- automatic localhost discovery/transport
- live polling/background collection
- measured facts inserted into canonical Journey events
- drawing a continuous measured route from separate diagnostic targets
- declaring measured/public/simulated sources globally agree or disagree
