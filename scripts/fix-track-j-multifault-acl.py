from pathlib import Path


def replace_once(path, old, new):
    p=Path(path); text=p.read_text(); count=text.count(old)
    if count!=1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old[:100]!r}')
    p.write_text(text.replace(old,new,1))

# Make the second fault a genuinely distinct downstream policy location.
# EDGE performs PAT, so CORE sees the translated overload address rather than
# the original CLIENT address. Match that canonical post-NAT tuple explicitly.
path=Path('src/builder/challenges.ts')
text=path.read_text()
if "const translatedSource=natBoundary.overloadAddress;" not in text:
    replace_once('src/builder/challenges.ts',
        "  const destinationAddress=interfacesForBuilderNode(healthy.addressing,'app')[0]?.address;\n  if(!sourceAddress||!destinationAddress)throw new Error('The composed challenge requires canonical CLIENT and APP IPv4 addresses.');\n  const blockingRule:BuilderAclRule={id:`challenge-multi-acl-${hash.toString(16).padStart(8,'0')}`,routerId:'edge',order:5,action:'deny',protocol:'icmp',sourcePrefix:`${sourceAddress}/32`,destinationPrefix:`${destinationAddress}/32`,destinationPort:null,description:'Track J composed objective ICMP deny'};",
        "  const destinationAddress=interfacesForBuilderNode(healthy.addressing,'app')[0]?.address;\n  const natBoundary=healthy.nat.boundaries.find((entry)=>entry.routerId==='edge'&&entry.enabled);\n  if(!sourceAddress||!destinationAddress||!natBoundary)throw new Error('The composed challenge requires canonical CLIENT/APP IPv4 addresses and the enabled EDGE NAT boundary.');\n  const translatedSource=natBoundary.overloadAddress;\n  const blockingRule:BuilderAclRule={id:`challenge-multi-acl-${hash.toString(16).padStart(8,'0')}`,routerId:'core',order:5,action:'deny',protocol:'icmp',sourcePrefix:`${translatedSource}/32`,destinationPrefix:`${destinationAddress}/32`,destinationPort:null,description:'Track J composed post-NAT objective ICMP deny'};")
    replace_once('src/builder/challenges.ts',
        "  const secondaryFault:BuilderAclDenyChallengeFault={kind:'acl-objective-deny',boundary:'POLICY',plane:'routed',nodeId:'edge',blockingRule};",
        "  const secondaryFault:BuilderAclDenyChallengeFault={kind:'acl-objective-deny',boundary:'POLICY',plane:'routed',nodeId:'core',blockingRule};")

# Contract: prove the locations are distinct and that either repair order still
# leaves a real objective failure after only one canonical fault is restored.
contract=Path('scripts/builder-challenge-contract-check.mjs')
ct=contract.read_text()
marker="  const initial=runPing(c.broken,302);assert.equal(runPing(c.healthy,301).success,true);assert.equal(initial.success,false);assert.equal(builderChallengeRepairStage(c,c.broken.addressing,c.broken.ethernet,c.broken.routing,c.broken.acl,c.broken.nat,c.broken.dhcp,c.broken.linkProfiles,c.broken.services??[]),'NONE');\n"
if "secondary-first repair must leave the primary failure active" not in ct:
    insert=marker+"  assert.notEqual(c.fault.nodeId,c.secondaryFault.nodeId,'composed faults must require inspection of two distinct device locations');\n  const secondaryFirst=structuredClone(c.broken);secondaryFirst.acl=deleteBuilderAclRule(secondaryFirst.graph,secondaryFirst.acl,c.secondaryFault.blockingRule.id);\n  assert.equal(builderChallengeRepairStage(c,secondaryFirst.addressing,secondaryFirst.ethernet,secondaryFirst.routing,secondaryFirst.acl,secondaryFirst.nat,secondaryFirst.dhcp,secondaryFirst.linkProfiles,secondaryFirst.services??[]),'SECONDARY_ONLY');\n  assert.equal(runPing(secondaryFirst,305).success,false,'secondary-first repair must leave the primary failure active');\n"
    if marker not in ct: raise SystemExit('challenge contract insertion marker missing')
    contract.write_text(ct.replace(marker,insert,1))

# Keep the Track J document chronological: the closeout boundary belongs after
# the ninth slice rather than between the second and third slices.
doc=Path('docs/TRACKJ.md'); dt=doc.read_text()
old_closeout="""## Track J closeout boundary

Track J is closed as the bounded deterministic troubleshooting product track. The shipped catalog covers gateway/addressing, VLAN/trunk/STP, static routing, OSPF participation, ACL, NAT/PAT, DHCP options, IPv6 PMTU/ND evidence, DNS naming, transport listeners, BGP import policy, and bounded two-fault composition.

Deeper protocol-specific cases remain valid future depth, but they are no longer blockers for Track J. Native-VLAN edge cases, DHCP relay, additional PMTUD variants, BGP best-path/relationship-policy puzzles, and larger procedural generators belong in later depth tracks or the moonshot roadmap.

Difficulty must continue to come from canonical topology, composition, observability, and protocol state—not hidden facts, answer-only state, or misleading text. The long-horizon procedural challenge generator remains Track S3 in `ROADMAP-MOONSHOTS.md`.


"""
if old_closeout in dt:
    dt=dt.replace(old_closeout,'',1)
dt=dt.replace('missing CLIENT default gateway → objective-specific EDGE ACL deny','missing CLIENT default gateway → objective-specific CORE post-NAT ACL deny')
dt=dt.replace('disabled OSPF participation on EDGE → objective-specific EDGE ACL deny','disabled OSPF participation on EDGE → objective-specific CORE post-NAT ACL deny')
if '## Post-closeout depth' not in dt:
    dt=dt.rstrip()+"""

## Post-closeout depth

Track J is closed as the bounded deterministic troubleshooting product track. The shipped catalog covers gateway/addressing, VLAN/trunk/STP, static routing, OSPF participation, ACL, NAT/PAT, DHCP options, IPv6 PMTU/ND evidence, DNS naming, transport listeners, BGP import policy, and bounded two-fault composition.

Deeper protocol-specific cases remain valid future depth, but they are no longer Track J blockers. Native-VLAN edge cases, DHCP relay, additional PMTUD variants, BGP best-path/relationship-policy puzzles, and larger procedural generators belong in later depth tracks or the moonshot roadmap.

Difficulty must continue to come from canonical topology, composition, observability, and protocol state—not hidden facts, answer-only state, or misleading text. The long-horizon procedural challenge generator remains Track S3 in `ROADMAP-MOONSHOTS.md`.
"""
doc.write_text(dt+'\n')

# ROADMAP: Track J is a completed-track section; keep exactly one active
# "Current priority order" heading, immediately before Track K.
road=Path('docs/ROADMAP.md'); rt=road.read_text()
old="""## Current priority order

Captured evidence, application truth, causal replay, authoring, enterprise depth, data-plane realism, routing policy, provider overlays, native/public evidence correlation, and deterministic troubleshooting practice are now closed product tracks.

### Completed active track — Track J troubleshooting challenges
"""
new="""### Completed active track — Track J troubleshooting challenges

Captured evidence, application truth, causal replay, authoring, enterprise depth, data-plane realism, routing policy, provider overlays, native/public evidence correlation, and deterministic troubleshooting practice are now closed product tracks.
"""
if old in rt: rt=rt.replace(old,new,1)
road.write_text(rt)

print('Hardened composed post-NAT policy fault, repair-order contract, and Track J closeout docs.')
