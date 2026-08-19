import fs from 'node:fs';

const path = 'src/NetworkBuilder.tsx';
let source = fs.readFileSync(path, 'utf8');

const oldMemo = "[challenge, challengeEvidence, challengeHypothesis, addressing, ethernet, routing, acl, nat]);";
const newMemo = "[challenge, challengeEvidence, challengeHypothesis, addressing, ethernet, routing, acl, nat, dhcp]);";
if (source.includes(oldMemo)) source = source.replace(oldMemo, newMemo);
else if (!source.includes(newMemo)) throw new Error('Unable to update DHCP challenge score dependencies.');

const oldPanel = "{!stressLabel&&<BuilderDhcpPanel ethernet={ethernet}";
const newPanel = "{!stressLabel&&<BuilderDhcpPanel key={challenge?.verification.kind==='dhcp-configuration'?challenge.id:'builder-dhcp'} ethernet={ethernet}";
if (source.includes(oldPanel)) source = source.replace(oldPanel, newPanel);
else if (!source.includes(newPanel)) throw new Error('Unable to add DHCP challenge panel remount key.');

fs.writeFileSync(path, source);
console.log('Fixed Track J DHCP live score dependencies and initial client focus.');
