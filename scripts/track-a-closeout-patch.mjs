import { readFileSync, writeFileSync } from 'node:fs';

const path='src/builder/canonical-events.ts';
let text=readFileSync(path,'utf8');
const before="  const priorIds=new Set(before.applicationHistory.map((transaction)=>transaction.id));\n  const transactions=after.applicationHistory.filter((transaction)=>!priorIds.has(transaction.id));";
const after="  const priorIds=new Set((before.applicationHistory??[]).map((transaction)=>transaction.id));\n  const transactions=(after.applicationHistory??[]).filter((transaction)=>!priorIds.has(transaction.id));";
if(!text.includes(before))throw new Error('Track A legacy application-history marker not found.');
text=text.replace(before,after);
writeFileSync(path,text);
console.log('Track A legacy event fixture compatibility applied.');
