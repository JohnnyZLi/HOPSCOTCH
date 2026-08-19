import fs from 'node:fs';
const path='src/NetworkBuilder.tsx';
const text=fs.readFileSync(path,'utf8');
const before="const pathMtuBytes = pmtuAdded?.mtuBytes ?? ipv6Result.attempts.at(-1)?.pathMtuBytes ?? null;";
const after="const pathMtuBytes = pmtuAdded?.delivered === true ? pmtuAdded.mtuBytes : null;";
if(!text.includes(before)&&!text.includes(after))throw new Error('PMTU evidence anchor not found.');
fs.writeFileSync(path,text.replace(before,after));
console.log('Hardened PMTU evidence to require a delivered Packet Too Big event.');
