# Track L — Explain This Network

Track L closes HOPSCOTCH's deterministic explanation layer.

The core rule is unchanged:

> explanation reacts to canonical truth; explanation never creates network truth.

Track L does not add another routing table, forwarding engine, ACL evaluator, protocol state machine, packet simulator, application simulator, or evidence source. Existing Builder engines remain authoritative. Track L first projects their supplied configuration/state/outcome/event objects into a structured cause/effect fact graph, then renders that graph at different wording depths.

## Shipped surface

The lazy `EXPLAIN` Builder workspace supports seven explanation targets:

1. **NETWORK** — topology, current source/destination objective, IPv4 forwarding, OSPF, BGP, ACL, NAT/PAT, and the latest causal event.
2. **ROUTE** — why the selected router uses a route for the current destination, including canonical FIB candidates, selected prefix/source/AD/metric/next hop, losing contenders, outgoing link state, and related route/topology events.
3. **OSPF** — why an adjacency is `FULL` or `DOWN`, with explicit router enablement, link state, area, canonical adjacency reason, and matching convergence/topology events.
4. **POLICY** — the current ICMP policy trace over the existing FIB, exact ACL rule/default decisions, deny location when present, and NAT-boundary context.
5. **PACKET** — why a recorded Ping/Traceroute attempt produced its immutable outcome, including request path, responder/status, deterministic drop link, PMTU, NAT translation, and canonical probe/policy/NAT events. The explanation does not rerun the old packet.
6. **APPLICATION** — why a recorded application transaction succeeded or stopped at its first broken truth boundary, reusing Track A causal diagnosis and Track D canonical stages/events.
7. **EVENT** — the exact `causeId` chain already recorded by the Builder event journal.

The workspace is lazy-loaded and absent from stress Builder.

## Structured facts before prose

`src/builder/explain.ts` defines a versioned Track L contract:

- schema `hopscotch.builder.explain`
- deterministic `BuilderExplainFact[]`
- stable cause links through `causeFactIds`
- exact `BuilderExplainCitation[]`
- canonical-reference strings such as `config:acl:<rule-id>`, `state:fib:<router-id>`, `state:ospf:adjacency:<id>`, `outcome:probe:<id>:attempt:<index>`, `outcome:application:<id>:stage:<id>`, and `event:<id>`
- provenance remains `SIMULATED`
- truth authority is explicitly `CANONICAL_BUILDER`

Natural-language output is generated only after the fact graph exists. Changing explanation depth does not change facts, citations, network state, selected routes, packet outcomes, protocol state, or provenance.

## Explanation levels

The same fact/citation graph can be rendered as:

- **NOVICE** — plain-language dependency and failure-boundary wording.
- **OPERATIONAL** — concise troubleshooting wording with the first failing or terminal fact emphasized.
- **PROTOCOL DETAIL** — fact IDs, categories, cause links, exact route/protocol attributes, and evidence references.

These are presentation levels, not simulation modes.

## Exact evidence references

Every rendered fact points to one or more explicit evidence references. Evidence is classified as:

- `CONFIG`
- `STATE`
- `EVENT`
- `OUTCOME`

Track L never cites a made-up source. For recorded probe/application outcomes, immutable result objects are the evidence authority. For current or historical route/OSPF/policy explanations, the supplied live or Time Machine Builder snapshot is the authority. Historical explanation therefore remains read-only and uses the same staged control/RIB/FIB truth graphs as the rest of Time Machine.

## AI boundary

Track L includes a machine-readable query pack:

`hopscotch.builder.explain.query-pack` v1

It contains only the structured facts and citations plus explicit capability constraints.

Allowed advisory uses:

- summarize cited facts
- answer questions from cited facts
- compare cited facts

Forbidden authority:

- decide routing
- decide forwarding
- decide policy
- mutate canonical state
- invent evidence or provenance

An AI can sit above this contract later without becoming part of the simulator's control or data plane. If AI output conflicts with canonical facts, the canonical facts win.

## Historical behavior

Track L accepts the same `BuilderDeviceWorkbenchInput` used by existing Builder inspection surfaces. In Time Machine:

- OSPF reads the historical control graph.
- route selection reads the historical FIB graph while the route-table state remains tied to the staged snapshot.
- policy reads the historical FIB projection.
- probe/application explanations inspect the outcome objects present at that historical point.
- event explanations use the journal truncated to that historical sequence.

No explanation action mutates live or historical truth.

## Determinism and contracts

The focused Track L contract verifies:

- deterministic fact/citation IDs and ordering
- route explanation delegates canonical selection to the existing routing engine
- OSPF adjacency facts use existing control-plane state and exact reasons
- policy facts use existing ACL trace output
- packet explanations interpret recorded probe outcomes without changing them
- application explanations reuse Track A causal diagnosis / Track D stages
- event explanations preserve canonical `causeId` ordering
- NOVICE / OPERATIONAL / PROTOCOL DETAIL change wording but preserve the same structured facts and citations
- AI query packs are advisory-only and contain no mutation/decision capability
- supplied canonical inputs remain immutable

## Track L completion criteria

Track L is complete when all of the following are true:

- [x] structured cause/effect facts exist before natural-language rendering
- [x] explanations cite exact canonical configuration, state, outcomes, and events
- [x] route selection, packet/drop outcome, OSPF adjacency state/change, policy result, application failure/success, network overview, and causal events are explainable
- [x] novice / operational / protocol-detail wording preserves identical facts and truth
- [x] AI-facing fact packs are explicitly advisory and cannot decide or mutate network truth
- [x] live and Time Machine explanation share the same canonical snapshot boundary
- [x] explanation UI remains lazy and absent from stress Builder

There is deliberately no vendor-specific prose engine and no LLM dependency in Track L. Those would be consumers of this layer, not replacements for it.
