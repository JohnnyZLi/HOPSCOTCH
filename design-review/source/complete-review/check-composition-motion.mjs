import fs from 'node:fs';
import {motionAudit,auditCount} from './check-complete.mjs';
for(const width of [320,390,1024,1440]) await motionAudit(width,{scenes:['tcp','tls']});
await motionAudit(390,{scenes:['tcp','tls'],reduced:true});
fs.writeFileSync('complete-review/composition-motion-contract.json',JSON.stringify({kind:'Emitted runtime in synthetic DOM; not browser validation',checks:auditCount(),widths:[320,390,1024,1440],reduced:true,browserVerified:false},null,2));
console.log('PASS focused motion',auditCount());
