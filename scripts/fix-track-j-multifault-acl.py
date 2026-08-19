from pathlib import Path

path=Path('src/builder/challenges.ts')
text=path.read_text()
old="const blockingRule:BuilderAclRule={id:`challenge-multi-acl-${hash.toString(16).padStart(8,'0')}`,routerId:'core',order:5,action:'deny',protocol:'icmp',sourcePrefix:`${sourceAddress}/32`,destinationPrefix:`${destinationAddress}/32`,destinationPort:null,description:'Track J composed objective ICMP deny'};"
new="const blockingRule:BuilderAclRule={id:`challenge-multi-acl-${hash.toString(16).padStart(8,'0')}`,routerId:'edge',order:5,action:'deny',protocol:'icmp',sourcePrefix:`${sourceAddress}/32`,destinationPrefix:`${destinationAddress}/32`,destinationPort:null,description:'Track J composed objective ICMP deny'};"
if old not in text:
    raise SystemExit('Expected composed ACL rule was not generated.')
text=text.replace(old,new,1)
old="const secondaryFault:BuilderAclDenyChallengeFault={kind:'acl-objective-deny',boundary:'POLICY',plane:'routed',nodeId:'core',blockingRule};"
new="const secondaryFault:BuilderAclDenyChallengeFault={kind:'acl-objective-deny',boundary:'POLICY',plane:'routed',nodeId:'edge',blockingRule};"
if old not in text:
    raise SystemExit('Expected composed secondary fault was not generated.')
path.write_text(text.replace(old,new,1))

doc=Path('docs/TRACKJ.md')
doc_text=doc.read_text()
doc_text=doc_text.replace('missing CLIENT default gateway → objective-specific CORE ACL deny','missing CLIENT default gateway → objective-specific EDGE ACL deny')
doc_text=doc_text.replace('disabled OSPF participation on EDGE → objective-specific CORE ACL deny','disabled OSPF participation on EDGE → objective-specific EDGE ACL deny')
doc.write_text(doc_text)

print('Moved composed ACL fault to EDGE pre-NAT policy evaluation.')
