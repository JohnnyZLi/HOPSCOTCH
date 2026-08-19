import fs from 'node:fs';

const path = 'src/NetworkBuilder.tsx';
let source = fs.readFileSync(path, 'utf8');
const before = 'const repaired = builderChallengeIsRepaired(challenge, addressing, ethernet, routing);';
const after = 'const repaired = builderChallengeIsRepaired(challenge, addressing, ethernet, routing, acl, nat);';
const count = source.split(before).length - 1;
if (count === 1) {
  source = source.replace(before, after);
  fs.writeFileSync(path, source);
  console.log('Updated live routed challenge repair evidence to include ACL/NAT state.');
} else if (source.includes(after)) {
  console.log('Live routed policy repair evidence is already current.');
} else {
  throw new Error(`Expected exactly one routed repair-evidence anchor, found ${count}.`);
}
